"""
Scheduler Service — APScheduler 定时任务管理器
===============================================
提供 Cron / Interval / Date 三种触发模式，集成 EventBus 事件发布。
支持：
  - 任务 CRUD（添加/编辑/删除/暂停/恢复）
  - 持久化（jobs.json）
  - 事件驱动：任务触发时 emit scheduler.job_triggered
  - WebSocket 自动推送任务列表更新
  - Web 可视化配置面板 API

用法:
    from services.scheduler_service import SchedulerService
    scheduler = SchedulerService(event_bus=bus)
    scheduler.start()
    scheduler.add_job(name="检查磁盘", trigger_type="cron",
                      hour="10", minute="0",
                      action="check_disk_space")
"""

import json
import logging
import os
import threading
import traceback
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any, Callable, Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.date import DateTrigger
from apscheduler.jobstores.memory import MemoryJobStore

logger = logging.getLogger(__name__)

# ───────── 数据模型 ─────────

@dataclass
class CronJob:
    """定时任务数据模型"""
    id: str
    name: str
    enabled: bool = True
    trigger_type: str = "cron"         # cron | interval | date
    trigger_args: dict = field(default_factory=dict)  # e.g. {"hour": "10", "minute": "0"}
    action_type: str = "event"         # event | callable
    action_name: str = ""              # event name or callable name
    description: str = ""
    created_at: str = ""
    last_run: Optional[str] = None
    last_result: Optional[str] = None
    run_count: int = 0

    @property
    def trigger_description(self) -> str:
        """人类可读的触发时间描述"""
        if self.trigger_type == "cron":
            parts = []
            if "hour" in self.trigger_args:
                parts.append(f"每{self.trigger_args['hour']}点")
            if "minute" in self.trigger_args:
                parts.append(f"{self.trigger_args['minute']}分")
            if "day_of_week" in self.trigger_args:
                parts.append(f"周{self.trigger_args['day_of_week']}")
            return " ".join(parts) if parts else f"cron({self.trigger_args})"
        elif self.trigger_type == "interval":
            seconds = int(self.trigger_args.get("seconds", 0))
            minutes = int(self.trigger_args.get("minutes", 0))
            hours = int(self.trigger_args.get("hours", 0))
            if hours: return f"每{hours}小时"
            if minutes: return f"每{minutes}分钟"
            return f"每{seconds}秒"
        elif self.trigger_type == "date":
            return f"一次性: {self.trigger_args.get('run_date', '?')}"
        return str(self.trigger_args)


# ───────── 预设动作 ─────────

class BuiltinActions:
    """内置可调度动作"""

    @staticmethod
    def check_disk_space(bus=None, **kwargs):
        """检查磁盘空间"""
        import shutil
        total, used, free = shutil.disk_usage("/")
        free_gb = free // (2**30)
        total_gb = total // (2**30)
        msg = f"磁盘: {free_gb}GB 可用 / {total_gb}GB 总计"
        if bus:
            bus.emit("notifier.info", title="磁盘空间检查", message=msg)
        return msg

    @staticmethod
    def git_auto_commit(bus=None, **kwargs):
        """自动 git add + commit 未暂存文件"""
        import subprocess
        try:
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                capture_output=True, text=True, timeout=10
            )
            if result.stdout.strip():
                subprocess.run(["git", "add", "-A"], capture_output=True, timeout=10)
                subprocess.run(
                    ["git", "commit", "-m", f"auto: {datetime.now().strftime('%Y-%m-%d %H:%M')}"],
                    capture_output=True, timeout=10
                )
                if bus:
                    bus.emit("notifier.info", title="Git 自动提交",
                             message=f"已提交未暂存文件")
                return "committed"
            return "no changes"
        except Exception as e:
            return f"error: {e}"

    @staticmethod
    def system_health_check(bus=None, **kwargs):
        """系统健康检查"""
        import shutil, psutil
        cpu = psutil.cpu_percent(interval=0.5)
        mem = psutil.virtual_memory()
        total, used, free = shutil.disk_usage("/")
        free_gb = free // (2**30)
        report = f"CPU: {cpu}% | 内存: {mem.percent}% | 磁盘剩余: {free_gb}GB"
        if bus:
            bus.emit("scheduler.health_report", report=report, cpu=cpu,
                     memory=mem.percent, disk_free=free_gb)
        return report


# ───────── Scheduler Service ─────────

class SchedulerService:
    """
    定时任务调度服务

    职责:
      - 管理 APScheduler 后台调度器
      - 任务持久化到 JSON
      - 触发时通过 EventBus 发送事件
      - 提供 Web API 接口
    """

    def __init__(self, event_bus=None, data_dir: str = None):
        self.bus = event_bus
        self.data_dir = data_dir or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data"
        )
        self._jobs_file = os.path.join(self.data_dir, "scheduler_jobs.json")
        self._scheduler = BackgroundScheduler(jobstores={"default": MemoryJobStore()})
        self._jobs: dict[str, CronJob] = {}  # id -> CronJob
        self._action_map: dict[str, Callable] = {}  # name -> callable
        self._lock = threading.Lock()
        self._running = False

        # 注册内置动作
        self._register_builtins()

    def _register_builtins(self):
        """注册预设动作"""
        self._action_map["check_disk_space"] = BuiltinActions.check_disk_space
        self._action_map["git_auto_commit"] = BuiltinActions.git_auto_commit
        self._action_map["system_health_check"] = BuiltinActions.system_health_check

    def register_action(self, name: str, callable_fn: Callable):
        """注册自定义动作"""
        self._action_map[name] = callable_fn

    # ───────── 生命周期 ─────────

    def start(self):
        """启动调度器"""
        if self._running:
            return
        self._running = True

        # 确保数据目录
        os.makedirs(self.data_dir, exist_ok=True)

        # 加载持久化任务
        self._load_jobs()

        # 调度所有启用的任务
        for job in self._jobs.values():
            if job.enabled:
                self._schedule_aps_job(job)

        self._scheduler.start()
        logger.info("Scheduler started (%d jobs loaded)", len(self._jobs))
        if self.bus:
            self.bus.emit("scheduler.started", job_count=len(self._jobs))

    def stop(self):
        """停止调度器"""
        if not self._running:
            return
        self._running = False
        self._scheduler.shutdown(wait=False)
        self._save_jobs()
        logger.info("Scheduler stopped")
        if self.bus:
            self.bus.emit("scheduler.stopped")

    # ───────── 任务管理 ─────────

    def add_job(self, name: str, trigger_type: str = "cron",
                trigger_args: dict = None, action_type: str = "event",
                action_name: str = "", description: str = "",
                enabled: bool = True) -> str:
        """
        添加定时任务

        参数:
            name: 任务名称
            trigger_type: cron | interval | date
            trigger_args: {
                cron: {"hour": "10", "minute": "0", "day_of_week": "mon-fri"}
                interval: {"hours": 1, "minutes": 30}
                date: {"run_date": "2026-06-01 10:00:00"}
            }
            action_type: "event" (bus emit) 或 "callable"
            action_name: 事件名或 callable 名
            enabled: 是否启用
        返回:
            job_id
        """
        import uuid
        job_id = str(uuid.uuid4())[:8]

        job = CronJob(
            id=job_id,
            name=name,
            enabled=enabled,
            trigger_type=trigger_type,
            trigger_args=trigger_args or {},
            action_type=action_type,
            action_name=action_name,
            description=description,
            created_at=datetime.now().isoformat(),
        )

        with self._lock:
            self._jobs[job_id] = job
            if enabled and self._running:
                self._schedule_aps_job(job)
            self._save_jobs()

        logger.info("Job added: %s (%s)", name, job_id)
        self._notify_updated()
        return job_id

    def remove_job(self, job_id: str) -> bool:
        """删除任务"""
        with self._lock:
            if job_id not in self._jobs:
                return False
            if self._running:
                try:
                    self._scheduler.remove_job(job_id)
                except Exception:
                    pass
            del self._jobs[job_id]
            self._save_jobs()

        self._notify_updated()
        return True

    def update_job(self, job_id: str, **updates) -> bool:
        """更新任务属性"""
        with self._lock:
            if job_id not in self._jobs:
                return False
            job = self._jobs[job_id]
            for key, value in updates.items():
                if hasattr(job, key) and key != "id":
                    setattr(job, key, value)

            # 重新调度
            if self._running:
                try:
                    self._scheduler.remove_job(job_id)
                except Exception:
                    pass
                if job.enabled:
                    self._schedule_aps_job(job)
            self._save_jobs()

        self._notify_updated()
        return True

    def toggle_job(self, job_id: str) -> Optional[bool]:
        """切换任务的启用/禁用状态"""
        with self._lock:
            if job_id not in self._jobs:
                return None
            job = self._jobs[job_id]
            job.enabled = not job.enabled

            if self._running:
                try:
                    self._scheduler.remove_job(job_id)
                except Exception:
                    pass
                if job.enabled:
                    self._schedule_aps_job(job)
            self._save_jobs()

        self._notify_updated()
        return job.enabled

    def list_jobs(self) -> list[dict]:
        """列出所有任务"""
        return [asdict(j) for j in self._jobs.values()]

    def get_job(self, job_id: str) -> Optional[dict]:
        """获取单个任务详情"""
        job = self._jobs.get(job_id)
        return asdict(job) if job else None

    # ───────── 内部调度 ─────────

    def _schedule_aps_job(self, job: CronJob):
        """将 CronJob 注册到 APScheduler"""
        try:
            if job.trigger_type == "cron":
                trigger = CronTrigger(**job.trigger_args)
            elif job.trigger_type == "interval":
                trigger = IntervalTrigger(**job.trigger_args)
            elif job.trigger_type == "date":
                trigger = DateTrigger(**job.trigger_args)
            else:
                logger.warning("Unknown trigger type: %s", job.trigger_type)
                return

            self._scheduler.add_job(
                func=self._execute_job,
                trigger=trigger,
                args=[job.id],
                id=job.id,
                name=job.name,
                replace_existing=True,
            )
        except Exception as e:
            logger.error("Failed to schedule job %s: %s", job.id, e)

    def _execute_job(self, job_id: str):
        """执行任务（由 APScheduler 触发）"""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return

        logger.info("Job triggered: %s (%s)", job.name, job_id)
        if self.bus:
            self.bus.emit("scheduler.job_triggered",
                         job_id=job_id, job_name=job.name)

        result = None
        try:
            if job.action_type == "event" and job.action_name and self.bus:
                self.bus.emit(job.action_name, job_id=job_id, job_name=job.name)
                result = "event_sent"
            elif job.action_type == "callable":
                fn = self._action_map.get(job.action_name)
                if fn:
                    result = fn(bus=self.bus, job_id=job_id)
                else:
                    result = f"unknown_action: {job.action_name}"
            else:
                result = "no_action"

            # 更新任务状态
            with self._lock:
                if job_id in self._jobs:
                    self._jobs[job_id].last_run = datetime.now().isoformat()
                    self._jobs[job_id].last_result = str(result)
                    self._jobs[job_id].run_count += 1
                    self._save_jobs()

            logger.info("Job completed: %s -> %s", job.name, result)
            if self.bus:
                self.bus.emit("scheduler.job_completed",
                             job_id=job_id, job_name=job.name, result=result)

        except Exception as e:
            error_msg = f"{type(e).__name__}: {e}"
            logger.error("Job failed: %s - %s", job.name, error_msg)
            traceback.print_exc()

            with self._lock:
                if job_id in self._jobs:
                    self._jobs[job_id].last_run = datetime.now().isoformat()
                    self._jobs[job_id].last_result = f"error: {error_msg}"
                    self._jobs[job_id].run_count += 1
                    self._save_jobs()

            if self.bus:
                self.bus.emit("scheduler.job_failed",
                             job_id=job_id, job_name=job.name, error=error_msg)

        self._notify_updated()

    # ───────── 持久化 ─────────

    def _save_jobs(self):
        """保存任务到 JSON 文件"""
        try:
            data = [asdict(j) for j in self._jobs.values()]
            with open(self._jobs_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("Failed to save jobs: %s", e)

    def _load_jobs(self):
        """从 JSON 文件加载任务"""
        if not os.path.exists(self._jobs_file):
            return
        try:
            with open(self._jobs_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for item in data:
                job = CronJob(**item)
                self._jobs[job.id] = job
        except Exception as e:
            logger.error("Failed to load jobs: %s", e)

    # ───────── WebSocket 通知 ─────────

    def _notify_updated(self):
        """通过 EventBus 通知前端更新任务列表"""
        if self.bus:
            self.bus.emit("scheduler.jobs_updated",
                         jobs=self.list_jobs())

    # ───────── 状态 ─────────

    def summary(self) -> dict:
        """服务状态摘要"""
        return {
            "running": self._running,
            "total_jobs": len(self._jobs),
            "enabled_jobs": sum(1 for j in self._jobs.values() if j.enabled),
            "actions_registered": list(self._action_map.keys()),
        }


# ───────── 单例助手 ─────────

_instance = None

def get_scheduler(event_bus=None):
    """获取/创建全局调度器实例"""
    global _instance
    if _instance is None:
        _instance = SchedulerService(event_bus=event_bus)
    return _instance
