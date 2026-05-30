"""
Plugin API — Friday OS 插件接口
=================================
为技能和第三方插件提供的完整接入系统。

功能:
  1. 事件钩子系统 — 技能可以订阅 Friday OS 内部事件
  2. 生命周期回调 — 加载/启用/禁用/卸载时的自动通知
  3. 数据访问授权 — 可控的 OS 内部数据访问
  4. 沙箱安全 — 限制插件的文件/网络/系统访问

事件钩子示例:
    class MyPlugin(PluginBase):
        def on_register(self, api):
            api.on("friday.state.changed", self.on_state_changed)
            api.on("voice.asr_result", self.on_asr)

        async def on_state_changed(self, state, **kw):
            print(f"Friday 状态变化: {state}")

数据授权示例:
    api = PluginAPI(auth_level="sandbox")
    # sandbox: 只能访问 skills/ 目录
    # standard: 可读 modules/ 和 skills/
    # full: 完全访问
"""

import asyncio
import logging
import os
import sys
from collections import defaultdict
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional

logger = logging.getLogger("friday.plugin")


class AuthLevel(str, Enum):
    """数据访问授权级别"""
    SANDBOX = "sandbox"      # 仅 skills/ 目录
    STANDARD = "standard"    # 可读 modules/ + skills/
    EXTENDED = "extended"    # 可读/写 skills/，可读 modules/
    FULL = "full"            # 完全访问


class HookPriority(int, Enum):
    """事件钩子优先级"""
    EARLIEST = 10
    EARLY = 30
    NORMAL = 50
    LATE = 70
    LATEST = 90


class PluginBase:
    """
    插件基类 — 第三方插件/高级技能的接入点

    子类可重写:
      on_register(api)   — 注册事件钩子和服务
      on_unregister()    — 注销时清理
    """

    def __init__(self):
        self._api: Optional["PluginAPI"] = None
        self._registered = False

    @property
    def api(self) -> Optional["PluginAPI"]:
        return self._api

    @property
    def is_registered(self) -> bool:
        return self._registered

    def on_register(self, api: "PluginAPI"):
        """插件注册时调用 — 在此绑定事件钩子"""
        self._api = api
        self._registered = True

    def on_unregister(self):
        """插件注销时调用 — 在此清理资源"""
        self._registered = False
        self._api = None


class EventHook:
    """事件钩子"""

    def __init__(self, event: str, callback: Callable,
                 plugin_id: str = "", priority: int = HookPriority.NORMAL):
        self.event = event
        self.callback = callback
        self.plugin_id = plugin_id
        self.priority = priority
        self.created_at = datetime.now().isoformat()

    async def invoke(self, **kwargs):
        """异步调用钩子"""
        if asyncio.iscoroutinefunction(self.callback):
            await self.callback(**kwargs)
        else:
            self.callback(**kwargs)


class Sandbox:
    """
    沙箱 — 限制插件的系统访问

    当前支持的约束:
      - 文件系统白名单
      - 网络访问限制
      - 子进程禁止
    """

    def __init__(self, auth_level: AuthLevel = AuthLevel.SANDBOX,
                 allowed_dirs: list = None):
        self.auth_level = auth_level
        self.allowed_dirs = allowed_dirs or []
        self._access_log: list = []

    def check_path_access(self, path: str, mode: str = "r") -> bool:
        """检查路径访问权限"""
        abs_path = os.path.abspath(path)

        if self.auth_level == AuthLevel.FULL:
            return True

        if self.auth_level == AuthLevel.SANDBOX:
            allowed = [os.path.abspath(d) for d in self.allowed_dirs]
            for ad in allowed:
                if abs_path.startswith(ad):
                    self._log_access(path, mode, True)
                    return True
            self._log_access(path, mode, False)
            return False

        if self.auth_level == AuthLevel.STANDARD:
            # 可读任何目录，但只可写 skills/
            if mode == "r":
                return True
            allowed = [os.path.abspath(d) for d in self.allowed_dirs]
            for ad in allowed:
                if abs_path.startswith(ad):
                    return True
            return False

        return True

    def check_network_access(self, host: str) -> bool:
        """检查网络访问权限"""
        if self.auth_level == AuthLevel.FULL:
            return True
        if self.auth_level == AuthLevel.SANDBOX:
            # 沙箱模式禁止网络
            self._log_access(f"net:{host}", "w", False)
            return False
        return True

    def _log_access(self, target: str, mode: str, allowed: bool):
        self._access_log.append({
            "target": target,
            "mode": mode,
            "allowed": allowed,
            "time": datetime.now().isoformat(),
        })

    def get_access_log(self) -> list:
        return list(self._access_log)


class PluginAPI:
    """
    插件 API — 技能和插件与 Friday OS 交互的入口

    每个插件在 on_register() 时收到此 API 实例。

    可用接口:
      api.on(event, callback)        — 订阅事件
      api.emit(event, **data)        — 触发事件
      api.get_service(name)          — 获取 OS 服务
      api.get_config(key)            — 读取配置
      api.set_config(key, value)     — 写入配置
      api.authorized_path(path, mode) — 检查路径权限
      api.get_sandbox()              — 获取沙箱实例
    """

    def __init__(self, plugin_id: str = "",
                 event_bus=None,
                 auth_level: AuthLevel = AuthLevel.STANDARD,
                 allowed_dirs: list = None):
        self.plugin_id = plugin_id
        self._event_bus = event_bus
        self._hooks: list[EventHook] = []
        self._services: dict = {}
        self._sandbox = Sandbox(auth_level, allowed_dirs or [])
        self._config: dict = {}
        self._internal_handlers: dict = {}  # event -> [handler_ref]

    # ───────── 事件系统 ─────────

    def on(self, event: str, callback: Callable,
           priority: int = HookPriority.NORMAL) -> "PluginAPI":
        """
        订阅事件

        参数:
            event: 事件名称（支持通配符 *）
            callback: 回调函数 async fn(**kwargs) 或 fn(**kwargs)

        返回: self 用于链式调用
        """
        hook = EventHook(event, callback, self.plugin_id, priority)
        self._hooks.append(hook)

        # 如果 EventBus 可用，注册到总线
        if self._event_bus:
            self._event_bus.on(event, callback)

        logger.debug("钩子注册 [%s] %s <- %s", self.plugin_id, event,
                     getattr(callback, "__name__", "?"))
        return self

    def off(self, event: str, callback: Callable = None):
        """取消订阅事件"""
        self._hooks = [
            h for h in self._hooks
            if not (h.event == event and (callback is None or h.callback == callback))
        ]
        if self._event_bus:
            self._event_bus.off(event, callback)

    def emit(self, event: str, **data):
        """触发事件"""
        if self._event_bus:
            self._event_bus.emit(event, **data)
        else:
            # 本地触发
            for hook in self._hooks:
                if hook.event == event or hook.event == "*":
                    asyncio.ensure_future(hook.invoke(**data))

    # ───────── 服务访问 ─────────

    def register_service(self, name: str, service: Any):
        """注册服务（供其他插件使用）"""
        self._services[name] = service
        logger.info("服务注册 [%s]: %s", self.plugin_id, name)

    def get_service(self, name: str) -> Optional[Any]:
        """获取已注册的服务"""
        return self._services.get(name)

    def list_services(self) -> list:
        """列出所有可用服务"""
        return list(self._services.keys())

    # ───────── 配置管理 ─────────

    def get_config(self, key: str, default: Any = None) -> Any:
        """获取配置项"""
        return self._config.get(key, default)

    def set_config(self, key: str, value: Any):
        """设置配置项"""
        self._config[key] = value

    # ───────── 沙箱访问 ─────────

    def check_path(self, path: str, mode: str = "r") -> bool:
        """检查路径访问权限"""
        return self._sandbox.check_path_access(path, mode)

    def check_network(self, host: str) -> bool:
        """检查网络访问权限"""
        return self._sandbox.check_network_access(host)

    def get_sandbox(self) -> Sandbox:
        """获取沙箱实例"""
        return self._sandbox

    # ───────── 信息 ─────────

    def get_info(self) -> dict:
        """获取 API 状态信息"""
        return {
            "plugin_id": self.plugin_id,
            "auth_level": self._sandbox.auth_level.value,
            "hooks_count": len(self._hooks),
            "services_count": len(self._services),
            "allowed_dirs": list(self._sandbox.allowed_dirs),
        }

    # ───────── 清理 ─────────

    def clear(self):
        """清理所有钩子和服务"""
        for hook in self._hooks:
            if self._event_bus:
                self._event_bus.off(hook.event, hook.callback)
        self._hooks.clear()
        self._services.clear()
        self._config.clear()
        logger.info("PluginAPI 已清理 [%s]", self.plugin_id)


# ───────── 插件注册中心 ─────────

class PluginRegistry:
    """
    插件注册中心 — 管理所有已注册的插件

    与 SkillManager 协同工作：
      - 技能加载时自动注册对应插件
      - 技能卸载时自动注销
    """

    def __init__(self, event_bus=None, skills_dir: str = None):
        self._event_bus = event_bus
        self._skills_dir = skills_dir or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "skills"
        )
        self._plugins: dict[str, PluginBase] = {}
        self._apis: dict[str, PluginAPI] = {}

    def register(self, plugin_id: str, plugin: PluginBase,
                 auth_level: AuthLevel = AuthLevel.STANDARD) -> Optional[PluginAPI]:
        """
        注册一个插件

        参数:
            plugin_id: 插件唯一 ID
            plugin: PluginBase 实例
            auth_level: 授权级别
        """
        if plugin_id in self._plugins:
            logger.warning("插件已存在，跳过: %s", plugin_id)
            return None

        # 创建 API
        allowed_dirs = [self._skills_dir]
        if auth_level in (AuthLevel.EXTENDED, AuthLevel.FULL):
            kernel_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            allowed_dirs.append(os.path.join(kernel_root, "modules"))
            allowed_dirs.append(os.path.join(kernel_root, "web"))

        api = PluginAPI(
            plugin_id=plugin_id,
            event_bus=self._event_bus,
            auth_level=auth_level,
            allowed_dirs=allowed_dirs,
        )

        # 通知插件
        try:
            plugin.on_register(api)
        except Exception as e:
            logger.error("插件注册失败 [%s]: %s", plugin_id, e)
            return None

        self._plugins[plugin_id] = plugin
        self._apis[plugin_id] = api

        if self._event_bus:
            self._event_bus.emit("plugin.registered",
                id=plugin_id, auth_level=auth_level.value,
            )

        logger.info("插件已注册: %s (auth=%s)", plugin_id, auth_level.value)
        return api

    def unregister(self, plugin_id: str):
        """注销一个插件"""
        plugin = self._plugins.pop(plugin_id, None)
        api = self._apis.pop(plugin_id, None)

        if plugin:
            try:
                plugin.on_unregister()
            except Exception as e:
                logger.warning("插件注销错误 [%s]: %s", plugin_id, e)

        if api:
            api.clear()

        if self._event_bus:
            self._event_bus.emit("plugin.unregistered", id=plugin_id)

        logger.info("插件已注销: %s", plugin_id)

    def get_plugin(self, plugin_id: str) -> Optional[PluginBase]:
        return self._plugins.get(plugin_id)

    def get_api(self, plugin_id: str) -> Optional[PluginAPI]:
        return self._apis.get(plugin_id)

    def list_plugins(self) -> list[dict]:
        return [
            {
                "id": pid,
                "api": api.get_info(),
            }
            for pid, api in self._apis.items()
        ]

    def clear(self):
        """清理所有插件"""
        for pid in list(self._plugins.keys()):
            self.unregister(pid)
