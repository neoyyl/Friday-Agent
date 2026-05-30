"""
Execution Log & Report System — 执行记录 + 报告系统
==============================================
记录所有执行（scheduler job / trigger / workflow）并生成摘要报告。

功能：
  - 统一执行日志（谁/何时/做了什么/结果）
  - 每日/每周摘要自动生成
  - Web 面板查看历史
  - EventBus 事件自动记录
"""

import json
import logging
import os
import threading
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class ExecutionRecord:
    """单条执行记录"""
    id: str
    source: str                   # scheduler / trigger / workflow / manual
    source_id: str                # job_id / trigger_id / wf_id
    source_name: str              # 人类可读名称
    action: str = ""              # 具体动作
    status: str = "unknown"       # success / failed / timeout / skipped
    result: str = ""
    error: Optional[str] = None
    duration: float = 0.0
    timestamp: str = ""
    details: dict = field(default_factory=dict)


class ExecutionLogger:
    """
    统一执行日志记录器

    自动监听 EventBus 事件并记录：
      - scheduler.job_triggered / scheduler.job_completed / scheduler.job_failed
      - trigger.fired
      - workflow.started / workflow.completed
      - notifier.*
    """

    def __init__(self, event_bus=None, data_dir: str = None):
        self.bus = event_bus
        self.data_dir = data_dir or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data"
        )
        self._log_file = os.path.join(self.data_dir, "execution_log.json")
        self._records: list[ExecutionRecord] = []
        self._lock = threading.Lock()
        self._max_records = 1000
        self._running = False
        self._listeners = []

    def start(self):
        """开始监听 EventBus 事件"""
        if self._running:
            return
        self._running = True
        os.makedirs(self.data_dir, exist_ok=True)
        self._load()

        if self.bus:
            self._listen("scheduler.job_completed", self._log_scheduler_job)
            self._listen("scheduler.job_failed", self._log_scheduler_job)
            self._listen("trigger.fired", self._log_trigger)
            self._listen("workflow.completed", self._log_workflow)
            self._listen("workflow.started", self._log_workflow)

        logger.info("Execution logger started (%d records loaded)", len(self._records))
        return self

    def _listen(self, event, callback):
        """注册 EventBus 监听"""
        self.bus.on(event, callback)
        self._listeners.append((event, callback))

    def stop(self):
        self._running = False
        self._save()
        logger.info("Execution logger stopped")

    # ───────── 事件处理器 ─────────

    def _log_scheduler_job(self, job_id=None, job_name=None, result=None,
                           error=None, **kwargs):
        event_name = kwargs.get("_event_name", "")
        status = "success" if "completed" in event_name else "failed"
        if error:
            status = "failed"
        self.record(
            source="scheduler",
            source_id=job_id or "",
            source_name=job_name or "",
            action=f"scheduler.{job_name}",
            status=status,
            result=str(result or ""),
            error=error,
        )

    def _log_trigger(self, trigger_id=None, trigger_name=None, **kwargs):
        self.record(
            source="trigger",
            source_id=trigger_id or "",
            source_name=trigger_name or "",
            action="trigger.fired",
            status="triggered",
        )

    def _log_workflow(self, instance_id=None, workflow_id=None,
                      workflow_name=None, status=None, **kwargs):
        stat = status.value if hasattr(status, 'value') else (status or "unknown")
        self.record(
            source="workflow",
            source_id=workflow_id or "",
            source_name=workflow_name or "",
            action=f"workflow.{stat}",
            status=stat,
            details={"instance_id": instance_id or ""},
        )

    # ───────── 记录 ─────────

    def record(self, source: str = "manual", source_id: str = "",
               source_name: str = "", action: str = "",
               status: str = "success", result: str = "",
               error: str = None, duration: float = 0.0,
               details: dict = None) -> str:
        """手动添加一条记录"""
        import uuid
        record = ExecutionRecord(
            id=str(uuid.uuid4())[:8],
            source=source,
            source_id=source_id,
            source_name=source_name,
            action=action,
            status=status,
            result=result,
            error=error,
            duration=duration,
            timestamp=datetime.now().isoformat(),
            details=details or {},
        )

        with self._lock:
            self._records.append(record)
            # 裁剪
            if len(self._records) > self._max_records:
                self._records = self._records[-self._max_records:]
            self._save()

        # 通知前端
        if self.bus:
            self.bus.emit("log.recorded", record=asdict(record))

        return record.id

    # ───────── 查询 ─────────

    def get_records(self, limit: int = 50, source: str = None,
                    status: str = None, since: datetime = None) -> list[dict]:
        """查询执行记录"""
        with self._lock:
            results = list(self._records)

        if source:
            results = [r for r in results if r.source == source]
        if status:
            results = [r for r in results if r.status == status]
        if since:
            results = [r for r in results if r.timestamp >= since.isoformat()]

        results.sort(key=lambda r: r.timestamp, reverse=True)
        return [asdict(r) for r in results[:limit]]

    def get_recent(self, limit: int = 20) -> list[dict]:
        return self.get_records(limit=limit)

    # ───────── 报告 ─────────

    def generate_report(self, period: str = "daily") -> dict:
        """
        生成执行报告。

        参数:
            period: "daily" | "weekly" | "all"
        返回:
            {"period": ..., "total": ..., "success": ..., "failed": ...,
             "by_source": {...}, "recent_failures": [...]}
        """
        now = datetime.now()
        if period == "daily":
            since = now - timedelta(days=1)
        elif period == "weekly":
            since = now - timedelta(days=7)
        else:
            since = datetime.fromtimestamp(0)

        records = self.get_records(limit=10000, since=since)

        total = len(records)
        success = sum(1 for r in records if r.get("status") == "success")
        failed = sum(1 for r in records if r.get("status") in ("failed", "timeout"))
        others = total - success - failed

        by_source = defaultdict(lambda: {"total": 0, "success": 0, "failed": 0})
        for r in records:
            src = r.get("source", "unknown")
            by_source[src]["total"] += 1
            if r.get("status") == "success":
                by_source[src]["success"] += 1
            elif r.get("status") in ("failed", "timeout"):
                by_source[src]["failed"] += 1

        failures = [r for r in records if r.get("status") in ("failed", "timeout", "error")]

        return {
            "period": period,
            "since": since.isoformat(),
            "total": total,
            "success": success,
            "failed": failed,
            "others": others,
            "success_rate": f"{success/max(total,1)*100:.0f}%",
            "by_source": dict(by_source),
            "recent_failures": [{
                "time": r.get("timestamp", ""),
                "source": r.get("source", ""),
                "name": r.get("source_name", ""),
                "error": r.get("error", ""),
                "id": r.get("id", ""),
            } for r in failures[:10]],
        }

    # ───────── 持久化 ─────────

    def _save(self):
        try:
            data = [asdict(r) for r in self._records]
            with open(self._log_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("Failed to save log: %s", e)

    def _load(self):
        if not os.path.exists(self._log_file):
            return
        try:
            with open(self._log_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._records = [ExecutionRecord(**item) for item in data]
        except Exception as e:
            logger.error("Failed to load log: %s", e)

    # ───────── 状态 ─────────

    def summary(self) -> dict:
        report = self.generate_report("daily")
        report["total_records"] = len(self._records)
        return report


# ───────── 单例 ─────────

_instance = None

def get_logger(event_bus=None):
    global _instance
    if _instance is None:
        _instance = ExecutionLogger(event_bus=event_bus)
    return _instance
