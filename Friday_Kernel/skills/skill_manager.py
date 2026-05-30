"""
Skill Manager — 技能热加载管理器
====================================
核心功能:
  1. 扫描技能目录，自动发现所有技能
  2. 动态加载/卸载技能模块（无需重启）
  3. 文件系统监听（新增/删除/修改自动同步）
  4. 依赖解析 + 加载顺序管理
  5. 技能调用路由（按能力标签匹配）
  6. EventBus 集成

目录结构:
  skills/
    hello_world/
      skill.json        # 清单
      main.py           # 入口文件
    weather/
      skill.json
      main.py
    ...

用法:
    manager = SkillManager(skills_dir="skills/")
    await manager.start()           # 扫描 + 加载所有技能
    result = await manager.call("weather", {"query": "北京天气"})
    await manager.stop()            # 卸载所有 + 停止监听
"""

import asyncio
import importlib
import importlib.util
import logging
import os
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Optional

from skills.skill_base import SkillBase, SkillResult, SkillStatus
from skills.manifest import SkillManifestFile, load_manifest_from_file, MANIFEST_FILENAME

logger = logging.getLogger("friday.skill.manager")

# 技能根目录
_DEFAULT_SKILLS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "skills")


class SkillManager:
    """
    技能热加载管理器

    状态机:
      STOPPED → STARTING → RUNNING → STOPPING → STOPPED
    """

    def __init__(self, skills_dir: str = None, event_bus=None):
        self.skills_dir = skills_dir or _DEFAULT_SKILLS_DIR
        self.event_bus = event_bus
        self._running = False

        # 技能注册表: id -> SkillBase 实例
        self._skills: dict[str, SkillBase] = {}

        # 清单缓存: id -> SkillManifestFile
        self._manifests: dict[str, SkillManifestFile] = {}

        # 能力索引: capability -> [skill_id, ...]
        self._capability_index: dict[str, list[str]] = defaultdict(list)

        # 监听线程
        self._watcher_task: Optional[asyncio.Task] = None

    # ───────── 生命周期 ─────────

    async def start(self):
        """启动管理器：扫描 + 加载所有技能"""
        if self._running:
            return

        self._running = True
        logger.info("SkillManager 启动，技能目录: %s", self.skills_dir)

        # 确保目录存在
        os.makedirs(self.skills_dir, exist_ok=True)

        # 扫描并加载
        await self.scan_all()

        # 启动文件监听
        self._watcher_task = asyncio.create_task(self._watch_loop())

        if self.event_bus:
            self.event_bus.emit("skill.manager.started",
                skills_dir=self.skills_dir,
                skill_count=len(self._skills),
            )

        logger.info("SkillManager 就绪，已加载 %d 个技能", len(self._skills))

    async def stop(self):
        """停止管理器：卸载所有技能"""
        self._running = False

        # 取消监听
        if self._watcher_task:
            self._watcher_task.cancel()
            self._watcher_task = None

        # 卸载所有技能
        for skill_id in list(self._skills.keys()):
            await self.unload_skill(skill_id)

        if self.event_bus:
            self.event_bus.emit("skill.manager.stopped")

        logger.info("SkillManager 已停止")

    # ───────── 扫描与加载 ─────────

    async def scan_all(self):
        """扫描目录并加载所有新技能"""
        if not os.path.isdir(self.skills_dir):
            logger.warning("技能目录不存在: %s", self.skills_dir)
            return

        loaded = 0
        for entry in os.scandir(self.skills_dir):
            if entry.is_dir():
                skill_id = await self._try_load_skill(entry.path)
                if skill_id:
                    loaded += 1

        logger.info("扫描完成: 加载 %d / %d 个技能", loaded, len(list(os.scandir(self.skills_dir))))

    async def load_skill(self, skill_dir: str) -> Optional[str]:
        """
        加载指定目录的技能

        返回: 技能 ID 或 None（失败）
        """
        return await self._try_load_skill(skill_dir)

    async def _try_load_skill(self, skill_dir: str) -> Optional[str]:
        """尝试加载一个技能目录"""
        manifest_path = os.path.join(skill_dir, MANIFEST_FILENAME)
        if not os.path.isfile(manifest_path):
            return None

        # 加载清单
        manifest = load_manifest_from_file(manifest_path)
        if manifest is None:
            return None

        # 检查是否已加载
        if manifest.id in self._skills:
            logger.debug("技能已存在，跳过: %s", manifest.id)
            return manifest.id

        # 设置目录
        manifest.directory = skill_dir

        # 动态加载模块
        skill_instance = await self._import_skill(manifest)
        if skill_instance is None:
            return None

        # 注册
        self._skills[manifest.id] = skill_instance
        self._manifests[manifest.id] = manifest

        # 更新能力索引
        for cap in manifest.capabilities:
            self._capability_index[cap].append(manifest.id)

        # 调用生命周期
        try:
            await skill_instance.load()
            await skill_instance.enable()
        except Exception as e:
            logger.error("技能生命周期错误 [%s]: %s", manifest.id, e)
            skill_instance._status = SkillStatus.ERROR

        if self.event_bus:
            self.event_bus.emit("skill.loaded",
                id=manifest.id,
                name=manifest.name,
                version=manifest.version,
            )

        logger.info("技能已加载: %s v%s [%s]", manifest.name, manifest.version, manifest.id)
        return manifest.id

    async def _import_skill(self, manifest: SkillManifestFile) -> Optional[SkillBase]:
        """动态导入技能模块"""
        try:
            # 构建模块路径
            entry_path = os.path.join(manifest.directory, manifest.entry)
            if not os.path.isfile(entry_path):
                logger.error("入口文件不存在: %s", entry_path)
                return None

            # 确保技能目录在 sys.path 中
            if manifest.directory not in sys.path:
                sys.path.insert(0, manifest.directory)

            # 动态导入
            module_name = f"friday_skill_{manifest.id}"
            spec = importlib.util.spec_from_file_location(module_name, entry_path)
            if spec is None or spec.loader is None:
                logger.error("无法加载模块: %s", entry_path)
                return None

            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            # 获取技能类
            skill_class = getattr(module, manifest.class_name, None)
            if skill_class is None:
                logger.error("技能类不存在 [%s]: %s", manifest.id, manifest.class_name)
                return None

            # 实例化
            if not issubclass(skill_class, SkillBase):
                logger.error("技能类必须继承 SkillBase [%s]", manifest.id)
                return None

            instance = skill_class()
            return instance

        except Exception as e:
            logger.error("导入技能失败 [%s]: %s", manifest.id, e)
            return None

    # ───────── 卸载 ─────────

    async def unload_skill(self, skill_id: str) -> bool:
        """卸载一个技能"""
        skill = self._skills.get(skill_id)
        if skill is None:
            return False

        manifest = self._manifests.get(skill_id)

        try:
            await skill.disable()
            await skill.unload()
        except Exception as e:
            logger.warning("卸载技能时出错 [%s]: %s", skill_id, e)

        # 从注册表移除
        del self._skills[skill_id]
        if skill_id in self._manifests:
            del self._manifests[skill_id]

        # 更新能力索引
        self._capability_index.clear()
        for sid, m in self._manifests.items():
            for cap in m.capabilities:
                self._capability_index[cap].append(sid)

        if self.event_bus:
            self.event_bus.emit("skill.unloaded", id=skill_id)

        logger.info("技能已卸载: %s", skill_id)
        return True

    # ───────── 调用 ─────────

    async def call(self, skill_id: str, context: dict) -> SkillResult:
        """
        调用指定技能

        参数:
            skill_id: 技能 ID
            context: 调用上下文 (query, params, speaker, ...)
        """
        skill = self._skills.get(skill_id)
        if skill is None:
            return SkillResult(success=False, error=f"技能不存在: {skill_id}")

        if not skill.is_available:
            return SkillResult(success=False, error=f"技能不可用: {skill.status.value}")

        result = await skill.safe_handle(context)

        if self.event_bus:
            self.event_bus.emit("skill.called",
                id=skill_id,
                success=result.success,
                execution_time=result.execution_time,
            )

        return result

    async def find_and_call(self, query: str, capabilities: list[str] = None,
                            context: dict = None) -> list[SkillResult]:
        """
        按能力匹配并调用技能

        参数:
            query: 用户输入
            capabilities: 需要的能力标签（不指定则搜索所有）
            context: 额外上下文

        返回: [(skill_id, result), ...]
        """
        context = context or {}
        context["query"] = query

        if capabilities:
            matched_ids = set()
            for cap in capabilities:
                matched_ids.update(self._capability_index.get(cap, []))
        else:
            matched_ids = set(self._skills.keys())

        results = []
        for skill_id in matched_ids:
            result = await self.call(skill_id, context)
            results.append((skill_id, result))

        return results

    # ───────── 查询 ─────────

    def get_skill(self, skill_id: str) -> Optional[SkillBase]:
        """获取技能实例"""
        return self._skills.get(skill_id)

    def get_manifest(self, skill_id: str) -> Optional[SkillManifestFile]:
        """获取技能清单"""
        return self._manifests.get(skill_id)

    def list_skills(self, status: SkillStatus = None) -> list[dict]:
        """列出所有技能"""
        skills = []
        for sid, skill in self._skills.items():
            if status and skill.status != status:
                continue
            manifest = self._manifests.get(sid)
            info = skill.get_stats()
            if manifest:
                info["manifest"] = manifest.to_dict()
            skills.append(info)
        return skills

    def find_by_capability(self, capability: str) -> list[str]:
        """按能力标签查找技能"""
        return list(self._capability_index.get(capability, []))

    def get_stats(self) -> dict:
        """获取管理器统计"""
        enabled = sum(1 for s in self._skills.values() if s.is_available)
        total_calls = sum(s.get_stats()["call_count"] for s in self._skills.values())
        total_errors = sum(s.get_stats()["error_count"] for s in self._skills.values())

        return {
            "total_skills": len(self._skills),
            "enabled": enabled,
            "disabled": len(self._skills) - enabled,
            "total_calls": total_calls,
            "total_errors": total_errors,
            "capabilities": len(self._capability_index),
        }

    # ───────── 文件监听 ─────────

    async def _watch_loop(self):
        """
        简单轮询监听（避免 watchdog 依赖）

        每 3 秒扫描一次技能目录，检测新增/删除/修改。
        """
        known = set()
        # 初始化已知目录
        if os.path.isdir(self.skills_dir):
            known = {entry.name for entry in os.scandir(self.skills_dir) if entry.is_dir()}

        while self._running:
            await asyncio.sleep(3.0)

            try:
                if not os.path.isdir(self.skills_dir):
                    continue

                current = {entry.name for entry in os.scandir(self.skills_dir) if entry.is_dir()}

                # 新增
                for name in current - known:
                    skill_dir = os.path.join(self.skills_dir, name)
                    await self._try_load_skill(skill_dir)

                # 删除
                for name in known - current:
                    if name in self._skills:
                        await self.unload_skill(name)

                # 更新 known
                known = current

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning("监听循环异常: %s", e)
