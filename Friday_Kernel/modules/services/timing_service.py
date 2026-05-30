"""
Smart Timing Module — 智能时机判断
===================================
决定"什么时候该通知、什么时候不该打扰"。

策略：
  1. 时间段：工作时间 (9-18) / 休息时间 / 深夜免打扰
  2. 用户活跃状态：繁忙（全屏/会议）→ 推迟
  3. 消息优先级：critical > high > normal > low
  4. 冷却期：同一类型通知不重复

用法:
    from services.timing_service import TimingService
    timing = TimingService()
    timing.should_notify(priority="high")  # → True/False
    timing.get_readiness()  # → "ready" / "busy" / "quiet_hours"
"""

import logging
import time
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class Priority(str, Enum):
    """通知优先级"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class Readiness(str, Enum):
    """用户可打扰状态"""
    READY = "ready"           # 可以通知
    BUSY = "busy"             # 忙，推迟非关键通知
    QUIET_HOURS = "quiet"     # 免打扰时段
    SLEEPING = "sleeping"     # 深夜，只有 critical 通过


@dataclass
class Notification:
    """通知条目"""
    id: str
    title: str
    message: str
    priority: str = Priority.NORMAL
    category: str = "general"
    timestamp: float = 0.0
    delivered: bool = False
    source: str = "system"


class TimingService:
    """
    智能时机判断服务

    决定通知是否应该：
      - 立即发送
      - 加入队列稍后发送
      - 丢弃（低优先级重复）
    """

    def __init__(self):
        self._recent: dict[str, float] = {}  # category -> last delivered timestamp
        self._queue: list[Notification] = []
        self._cooldowns: dict[str, int] = {
            "general": 60,        # 通用通知 60s 冷却
            "disk": 300,          # 磁盘 5min
            "git": 120,           # Git 2min
            "health": 300,        # 健康检查 5min
            "system": 60,
        }

    # ───────── 用户状态检测 ─────────

    def _detect_readiness(self) -> tuple[Readiness, str]:
        """
        检测当前用户可打扰程度。
        返回 (状态, 原因)
        """
        now = datetime.now()
        hour = now.hour

        # 深夜免打扰 (23:00 - 07:00)
        if hour < 7 or hour >= 23:
            return Readiness.SLEEPING, "深夜免打扰时段"

        # 午休 (12:00 - 13:30)
        if 12 <= hour < 13.5:
            return Readiness.QUIET_HOURS, "午休时段"

        # 工作时间
        if 9 <= hour < 18:
            return Readiness.READY, "工作时间"

        # 晚间休息
        return Readiness.READY, "晚间时段"

    # 也可以从感知系统获取活跃状态
    def update_from_perception(self, perception_context: dict):
        """
        从感知系统更新用户状态。
        如果窗口全屏/会议中 → busy
        """
        pass  # 未来集成

    # ───────── 通知决策 ─────────

    def should_notify(self, priority: str = Priority.NORMAL,
                      category: str = "general",
                      message: str = "") -> tuple[bool, str]:
        """
        判断是否应该发送通知。

        返回: (should_send, reason)
        """
        readiness, reason = self._detect_readiness()

        # 冷却检查
        last_time = self._recent.get(category, 0)
        elapsed = time.time() - last_time
        cooldown = self._cooldowns.get(category, 60)

        if elapsed < cooldown:
            remaining = int(cooldown - elapsed)
            return False, f"冷却中，还剩 {remaining}s (分类: {category})"

        # 按优先级和状态决策
        if readiness == Readiness.SLEEPING:
            if priority == Priority.CRITICAL:
                return True, f"关键通知，突破免打扰 ({reason})"
            elif priority == Priority.HIGH:
                return False, f"深夜免打扰，仅关键通知通过 ({reason})"
            else:
                return False, f"深夜免打扰 ({reason})"

        if readiness == Readiness.QUIET_HOURS:
            if priority in (Priority.CRITICAL, Priority.HIGH):
                return True, f"高优先级，突破午休 ({reason})"
            else:
                self._enqueue(category, priority, message)
                return False, f"午休中，已加入队列 ({reason})"

        if readiness == Readiness.BUSY:
            if priority == Priority.CRITICAL:
                return True, f"关键通知，突破忙碌 ({reason})"
            else:
                self._enqueue(category, priority, message)
                return False, f"用户忙碌，已加入队列 ({reason})"

        # READY — 全部通过
        return True, f"可以通知 ({reason})"

    def _enqueue(self, category: str, priority: str, message: str):
        """加入通知队列"""
        import uuid
        notif = Notification(
            id=str(uuid.uuid4())[:8],
            title="",
            message=message,
            priority=priority,
            category=category,
            timestamp=time.time(),
        )
        self._queue.append(notif)
        # 队列上限
        if len(self._queue) > 50:
            self._queue = self._queue[-50:]

    # ───────── 队列管理 ─────────

    def get_queue(self, flush: bool = False) -> list[dict]:
        """获取通知队列"""
        if flush:
            items = list(self._queue)
            self._queue = []
        else:
            items = self._queue[:]
        return [{
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "priority": n.priority,
            "category": n.category,
            "time": datetime.fromtimestamp(n.timestamp).isoformat(),
        } for n in items]

    def mark_delivered(self, category: str):
        """标记某类通知已送达（更新时间戳用于冷却）"""
        self._recent[category] = time.time()

    # ───────── 状态 ─────────

    def get_readiness(self) -> dict:
        readiness, reason = self._detect_readiness()
        return {
            "readiness": readiness.value,
            "reason": reason,
            "hour": datetime.now().hour,
            "queue_length": len(self._queue),
            "cooling_categories": {
                cat: int(time.time() - last)
                for cat, last in self._recent.items()
            },
        }

    def set_cooldown(self, category: str, seconds: int):
        """设置自定义冷却时间"""
        self._cooldowns[category] = seconds


# ───────── 单例 ─────────

_instance = None

def get_timing_service():
    global _instance
    if _instance is None:
        _instance = TimingService()
    return _instance
