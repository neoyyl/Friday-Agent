"""
Dispatch Logger — 调度记录 + 自学习系统
========================================
每次调度记录 [请求→选谁→结果→经验]，攒满阈值自动复盘调整策略。

设计：
  - 每个调度记录完整保存
  - 使用评分（0-5）标记效果
  - 攒满 20 条触发自动复盘
  - 复盘结论影响后续匹配权重

用法:
    from services.dispatch_logger import DispatchLogger
    logger = DispatchLogger()
    
    logger.log_dispatch(task="...", mode="chain", agents=[...],
                        success=True, rating=4)
    
    insights = logger.review()  # 手动复盘
"""

import json
import logging
import os
import threading
from collections import defaultdict, Counter
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

REVIEW_THRESHOLD = 20  # 攒满多少条自动复盘


@dataclass
class DispatchLogEntry:
    """调度日志条目"""
    id: str
    timestamp: str
    task: str
    task_length: int
    mode: str                     # direct / chain / parallel / hybrid
    agents_used: list             # agent IDs
    success: bool
    rating: float                 # 0-5
    duration: float
    error: Optional[str] = None
    insight: str = ""             # 复盘经验


class DispatchLogger:
    """
    调度日志 + 自学习系统

    核心能力：
      - 记录每次调度
      - 统计各 Agent / 各模式的成功率
      - 攒满阈值自动复盘
      - 生成推荐策略
    """

    def __init__(self, data_dir: str = None):
        self.data_dir = data_dir or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data"
        )
        self._log_file = os.path.join(self.data_dir, "dispatch_log.json")
        self._insights_file = os.path.join(self.data_dir, "dispatch_insights.json")
        self._entries: list[DispatchLogEntry] = []
        self._insights: list[str] = []
        self._lock = threading.Lock()
        self._load()

    # ───────── 记录 ─────────

    def log_dispatch(self, task: str, mode: str, agents: list,
                     success: bool, rating: float = 3.0,
                     duration: float = 0.0, error: str = None) -> str:
        """记录一次调度"""
        import uuid
        entry = DispatchLogEntry(
            id=str(uuid.uuid4())[:8],
            timestamp=datetime.now().isoformat(),
            task=task[:200],
            task_length=len(task),
            mode=mode,
            agents_used=[a.get("id", str(a)) if isinstance(a, dict) else str(a)
                        for a in agents],
            success=success,
            rating=rating,
            duration=duration,
            error=error,
        )

        with self._lock:
            self._entries.append(entry)
            self._save()

            # 检查是否达到复盘阈值
            if len(self._entries) % REVIEW_THRESHOLD == 0:
                self._auto_review()

        return entry.id

    def get_stats(self) -> dict:
        """获取调度统计"""
        with self._lock:
            total = len(self._entries)
            if total == 0:
                return {"empty": True}

            success = sum(1 for e in self._entries if e.success)
            failed = total - success
            
            # 按模式统计
            by_mode = Counter(e.mode for e in self._entries)
            mode_success = {}
            for mode in by_mode:
                mode_total = sum(1 for e in self._entries if e.mode == mode)
                mode_ok = sum(1 for e in self._entries if e.mode == mode and e.success)
                mode_success[mode] = {
                    "total": mode_total,
                    "success": mode_ok,
                    "rate": f"{mode_ok/max(mode_total,1)*100:.0f}%"
                }

            # 按 Agent 统计
            agent_stats = defaultdict(lambda: {"total": 0, "success": 0, "rating_sum": 0.0})
            for e in self._entries:
                for aid in e.agents_used:
                    agent_stats[aid]["total"] += 1
                    if e.success:
                        agent_stats[aid]["success"] += 1
                    agent_stats[aid]["rating_sum"] += e.rating

            # 评分趋势
            recent = self._entries[-min(20, total):]
            recent_avg = sum(e.rating for e in recent) / max(len(recent), 1)
            old = self._entries[:max(0, total-20)]
            old_avg = sum(e.rating for e in old) / max(len(old), 1) if old else 0

            return {
                "total": total,
                "success": success,
                "failed": failed,
                "success_rate": f"{success/max(total,1)*100:.0f}%",
                "avg_rating": sum(e.rating for e in self._entries) / max(total, 1),
                "recent_avg_rating": recent_avg,
                "trend": "up" if recent_avg > old_avg else "down" if old_avg > 0 else "stable",
                "by_mode": dict(mode_success),
                "agent_stats": dict(agent_stats),
                "total_insights": len(self._insights),
            }

    # ───────── 复盘 ─────────

    def review(self) -> list[str]:
        """
        手动触发复盘。

        分析：
          - 哪种模式成功率最高
          - 哪个 Agent 表现最好
          - 常见失败原因
        返回洞察列表。
        """
        return self._auto_review()

    def _auto_review(self) -> list[str]:
        """自动复盘"""
        insights = []
        stats = self.get_stats()
        if stats.get("empty"):
            return ["暂无调度记录"]

        # 模式分析
        by_mode = stats.get("by_mode", {})
        if by_mode:
            best_mode = max(by_mode, key=lambda m: float(by_mode[m]["rate"].rstrip("%")))
            worst_mode = min(by_mode, key=lambda m: float(by_mode[m]["rate"].rstrip("%")))
            insights.append(f"最佳路由模式: {best_mode} ({by_mode[best_mode]['rate']} 成功率)")
            insights.append(f"需改进路由模式: {worst_mode} ({by_mode[worst_mode]['rate']} 成功率)")

        # Agent 分析
        agent_stats = stats.get("agent_stats", {})
        if agent_stats:
            best_agent = max(agent_stats, key=lambda a: agent_stats[a]["success"] / max(agent_stats[a]["total"], 1))
            insights.append(f"表现最佳 Agent: {best_agent}")

        # 最近失败原因
        recent_failures = [e for e in self._entries[-REVIEW_THRESHOLD:] if not e.success]
        if recent_failures:
            errors = Counter(e.error for e in recent_failures if e.error)
            if errors:
                common_error = errors.most_common(1)[0]
                insights.append(f"常见失败原因: {common_error[0]} ({common_error[1]}次)")

        # 评分趋势
        trend = stats.get("trend", "stable")
        if trend == "up":
            insights.append("评分趋势: ↑ 上升，调度策略正在优化")
        elif trend == "down":
            insights.append("评分趋势: ↓ 下降，建议调整调度策略")

        # 保存洞察
        with self._lock:
            self._insights.extend(insights)
            # 保留最近 50 条
            if len(self._insights) > 50:
                self._insights = self._insights[-50:]
            self._save_insights()

        logger.info("Auto-review complete: %d new insights", len(insights))
        return insights

    def get_insights(self) -> list[str]:
        """获取所有复盘洞察"""
        with self._lock:
            return list(self._insights)

    # ───────── 策略推荐 ─────────

    def recommend_mode(self, task: str) -> str:
        """
        根据历史推荐路由模式。

        基于：
          - 历史最佳模式
          - 任务长度
          - 最近成功率
        """
        with self._lock:
            if len(self._entries) < 5:
                return "auto"

            stats = self.get_stats()
            by_mode = stats.get("by_mode", {})

            # 选择成功率最高的模式
            if by_mode:
                scored = [(float(v["rate"].rstrip("%")), v["total"], mode)
                         for mode, v in by_mode.items() if v["total"] >= 2]
                if scored:
                    scored.sort(key=lambda x: -x[0])
                    return scored[0][2]

            return "direct"

    def recommend_agents(self, task: str) -> list[str]:
        """根据历史推荐 Agent"""
        with self._lock:
            stats = self.get_stats()
            agent_stats = stats.get("agent_stats", {})
            if not agent_stats:
                return []

            # 按成功率排序
            scored = [(a["success"] / max(a["total"], 1), a["total"], aid)
                     for aid, a in agent_stats.items() if a["total"] >= 2]
            scored.sort(key=lambda x: -x[0])
            return [aid for _, _, aid in scored[:3]]

    # ───────── 持久化 ─────────

    def _save(self):
        try:
            data = [asdict(e) for e in self._entries]
            with open(self._log_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("Failed to save dispatch log: %s", e)

    def _load(self):
        if not os.path.exists(self._log_file):
            return
        try:
            with open(self._log_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._entries = [DispatchLogEntry(**item) for item in data]
        except Exception as e:
            logger.error("Failed to load dispatch log: %s", e)

        # 加载洞察
        if os.path.exists(self._insights_file):
            try:
                with open(self._insights_file, "r", encoding="utf-8") as f:
                    self._insights = json.load(f)
            except Exception:
                pass

    def _save_insights(self):
        try:
            with open(self._insights_file, "w", encoding="utf-8") as f:
                json.dump(self._insights, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("Failed to save insights: %s", e)


# ───────── 全局单例 ─────────

_default_logger = None


def get_dispatch_logger():
    global _default_logger
    if _default_logger is None:
        _default_logger = DispatchLogger()
    return _default_logger
