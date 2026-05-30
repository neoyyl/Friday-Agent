"""
Skill SDK — Friday OS 技能开发套件
===================================
标准技能接口定义，所有 Friday 技能必须实现此接口。

快速开始:
    from skills.skill_base import SkillBase, SkillManifest

    class MySkill(SkillBase):
        @property
        def manifest(self) -> SkillManifest:
            return SkillManifest(
                id="my-skill",
                name="我的技能",
                version="1.0.0",
                description="这是我的第一个 Friday 技能",
                author="Me",
                capabilities=["custom", "example"],
            )

        async def handle(self, context: dict) -> dict:
            # 处理技能调用
            return {"result": "hello from my skill!"}

技能生命周期:
  1. load()     — 加载时调用（初始化资源）
  2. enable()   — 启用时调用
  3. handle()   — 处理任务（核心方法）
  4. disable()  — 禁用时调用
  5. unload()   — 卸载时调用（释放资源）
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional

logger = logging.getLogger("friday.skill")


class SkillStatus(str, Enum):
    """技能状态"""
    LOADED = "loaded"           # 已加载
    ENABLED = "enabled"         # 已启用（可用）
    DISABLED = "disabled"       # 已禁用
    ERROR = "error"             # 异常
    UNLOADED = "unloaded"       # 已卸载


@dataclass
class SkillManifest:
    """
    技能清单 — 技能的元数据定义

    Attributes:
        id:          唯一标识 (如 "weather", "courier-tracking")
        name:        显示名称
        version:     SemVer 版本号
        description: 功能描述
        author:      作者
        capabilities: 能力标签（用于任务匹配）
        license:     许可证
        homepage:    项目主页
        dependencies: 依赖的其他技能 ID
        tags:        分类标签
        icon:        图标 emoji 或 URL
    """
    id: str
    name: str
    version: str = "1.0.0"
    description: str = ""
    author: str = "anonymous"
    capabilities: list = field(default_factory=list)
    license: str = "MIT"
    homepage: str = ""
    dependencies: list = field(default_factory=list)
    tags: list = field(default_factory=list)
    icon: str = "🔌"

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class SkillResult:
    """技能执行结果"""
    success: bool = True
    output: Any = None
    error: str = ""
    data: dict = field(default_factory=dict)
    execution_time: float = 0.0


class SkillBase:
    """
    Friday 技能基类 — 所有技能必须继承此类

    子类必须实现:
        manifest 属性
        handle() 方法

    可选重写:
        load()     — 资源初始化
        enable()   — 启用
        disable()  — 禁用
        unload()   — 资源释放
    """

    def __init__(self):
        self._status = SkillStatus.UNLOADED
        self._loaded_at: Optional[str] = None
        self._call_count = 0
        self._error_count = 0
        self._last_call: Optional[str] = None
        self._logger = logging.getLogger(f"friday.skill.{self.__class__.__name__}")

    # ── 子类必须实现 ──

    @property
    def manifest(self) -> SkillManifest:
        """技能清单"""
        raise NotImplementedError("子类必须实现 manifest 属性")

    async def handle(self, context: dict) -> SkillResult:
        """
        处理技能调用（核心方法）

        参数:
            context: 调用上下文
                {
                    "query": str,          # 用户输入
                    "params": dict,        # 额外参数
                    "speaker": str|None,   # 说话人
                    "memory": dict,        # 记忆上下文
                }

        返回:
            SkillResult
        """
        raise NotImplementedError("子类必须实现 handle() 方法")

    # ── 生命周期钩子（可选重写） ──

    async def load(self):
        """技能加载时调用 — 初始化资源"""
        self._status = SkillStatus.LOADED
        self._loaded_at = datetime.now().isoformat()
        self._logger.info("Skill loaded: %s v%s", self.manifest.id, self.manifest.version)

    async def enable(self):
        """技能启用时调用"""
        self._status = SkillStatus.ENABLED
        self._logger.info("Skill enabled: %s", self.manifest.id)

    async def disable(self):
        """技能禁用时调用"""
        self._status = SkillStatus.DISABLED
        self._logger.info("Skill disabled: %s", self.manifest.id)

    async def unload(self):
        """技能卸载时调用 — 释放资源"""
        self._status = SkillStatus.UNLOADED
        self._logger.info("Skill unloaded: %s", self.manifest.id)

    # ── 工具方法 ──

    @property
    def status(self) -> SkillStatus:
        return self._status

    @property
    def is_available(self) -> bool:
        return self._status == SkillStatus.ENABLED

    def get_stats(self) -> dict:
        """获取技能统计"""
        return {
            "id": self.manifest.id,
            "name": self.manifest.name,
            "version": self.manifest.version,
            "status": self._status.value,
            "loaded_at": self._loaded_at,
            "call_count": self._call_count,
            "error_count": self._error_count,
            "last_call": self._last_call,
        }

    async def safe_handle(self, context: dict) -> SkillResult:
        """
        安全的技能调用（带异常捕获 + 计时）

        自动记录调用统计，捕获异常。
        """
        start = time.time()
        self._call_count += 1
        self._last_call = datetime.now().isoformat()

        try:
            result = await self.handle(context)
            if not isinstance(result, SkillResult):
                result = SkillResult(success=True, output=str(result))
            result.execution_time = time.time() - start
            return result
        except Exception as e:
            self._error_count += 1
            self._logger.error("Skill '%s' error: %s", self.manifest.id, e)
            return SkillResult(
                success=False,
                error=str(e),
                execution_time=time.time() - start,
            )


# ───────── 工具函数 ─────────

def create_skill_result(output: Any = None, **kwargs) -> SkillResult:
    """快速创建成功结果"""
    return SkillResult(success=True, output=output, **kwargs)


def error_result(error: str) -> SkillResult:
    """快速创建错误结果"""
    return SkillResult(success=False, error=error)
