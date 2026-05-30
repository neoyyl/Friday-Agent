"""
Skill Service — 技能系统服务层
=================================
将 SkillManager 集成到 Friday OS 服务架构中。

功能:
  - EventBus 集成（技能加载/卸载/调用事件）
  - Web API 后端（供管理面板调用）
  - 技能统计与健康检查
  - 与 Agent Registry 同步

用法:
    skill_svc = SkillService(event_bus=event_bus)
    await skill_svc.start()
    result = await skill_svc.call_skill("hello-world", {"query": "你好"})
"""

import asyncio
import logging
import os
import threading

from skills.skill_manager import SkillManager
from skills.skill_base import SkillResult, SkillStatus

logger = logging.getLogger("friday.service.skill")


class SkillService:
    """
    技能系统服务

    封装 SkillManager，提供：
      - 异步启动/停止
      - EventBus 事件广播
      - Web 友好的 REST API
    """

    def __init__(self, skills_dir: str = None, event_bus=None):
        self.event_bus = event_bus
        self._manager = SkillManager(skills_dir=skills_dir, event_bus=event_bus)
        self._loop: asyncio.AbstractEventLoop = None
        self._thread: threading.Thread = None
        self._started = False

    # ───────── 生命周期 ─────────

    def start(self):
        """启动技能服务（同步入口，内部启动异步循环）"""
        if self._started:
            return

        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

        # 等待事件循环启动
        import time
        for _ in range(20):  # 最多等待 2 秒
            if self._loop.is_running():
                break
            time.sleep(0.1)

        self._started = True

        if self.event_bus:
            self.event_bus.emit("skill.service.started")

        logger.info("SkillService 已启动")

    def _run_loop(self):
        asyncio.set_event_loop(self._loop)
        self._loop.run_until_complete(self._manager.start())
        self._loop.run_forever()

    def stop(self):
        """停止技能服务"""
        if not self._started:
            return

        async def _stop():
            await self._manager.stop()
            self._loop.stop()

        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(_stop(), self._loop)

        self._started = False
        logger.info("SkillService 已停止")

    # ───────── 技能管理 ─────────

    def call_skill(self, skill_id: str, context: dict) -> SkillResult:
        """同步调用技能"""
        if not self._loop or not self._loop.is_running():
            return SkillResult(success=False, error="SkillService 未运行")

        future = asyncio.run_coroutine_threadsafe(
            self._manager.call(skill_id, context), self._loop)
        try:
            return future.result(timeout=30)
        except Exception as e:
            return SkillResult(success=False, error=str(e))

    def load_skill(self, skill_dir: str) -> dict:
        """加载技能（返回结果字典）"""
        if not self._loop or not self._loop.is_running():
            return {"success": False, "error": "SkillService 未运行"}

        future = asyncio.run_coroutine_threadsafe(
            self._manager.load_skill(skill_dir), self._loop)
        try:
            skill_id = future.result(timeout=10)
            if skill_id:
                return {"success": True, "id": skill_id}
            return {"success": False, "error": "加载失败"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def unload_skill(self, skill_id: str) -> dict:
        """卸载技能"""
        if not self._loop or not self._loop.is_running():
            return {"success": False, "error": "SkillService 未运行"}

        future = asyncio.run_coroutine_threadsafe(
            self._manager.unload_skill(skill_id), self._loop)
        try:
            success = future.result(timeout=10)
            return {"success": success}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def scan_all(self) -> dict:
        """重新扫描技能目录"""
        if not self._loop or not self._loop.is_running():
            return {"success": False, "error": "SkillService 未运行"}

        future = asyncio.run_coroutine_threadsafe(
            self._manager.scan_all(), self._loop)
        try:
            future.result(timeout=30)
            stats = self._manager.get_stats()
            return {"success": True, "stats": stats}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ───────── 查询 ─────────

    def list_skills(self, status: str = None) -> list[dict]:
        """列出所有技能"""
        status_enum = None
        if status:
            try:
                status_enum = SkillStatus(status)
            except ValueError:
                pass
        return self._manager.list_skills(status=status_enum)

    def get_skill(self, skill_id: str) -> dict:
        """获取技能详情"""
        skill = self._manager.get_skill(skill_id)
        if not skill:
            return {}
        info = skill.get_stats()
        manifest = self._manager.get_manifest(skill_id)
        if manifest:
            info["manifest"] = manifest.to_dict()
        return info

    def get_stats(self) -> dict:
        """获取技能系统统计"""
        return self._manager.get_stats()

    def find_by_capability(self, capability: str) -> list[str]:
        """按能力查找"""
        return self._manager.find_by_capability(capability)


# ───────── 全局单例 ─────────

_default_service = None


def get_skill_service(event_bus=None):
    global _default_service
    if _default_service is None:
        _default_service = SkillService(event_bus=event_bus)
    return _default_service
