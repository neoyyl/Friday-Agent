#!/usr/bin/env python3
"""
Friday Notifier — 主动提醒引擎
=================================
P2.2：在后台定期检查系统状态，发现异常时主动通知。

检测项：
  - 磁盘使用率 > 90%
  - 内存使用率 > 90%
  - CPU 持续高负载 > 80%
  - 可疑进程数量变化
  - 每日任务完成通知

通知方式：
  1. Windows 弹窗通知（静默）
  2. 可选：语音播报（通过回调）

作者：Friday Kernel
"""

import threading
import time
import datetime
import os
from pathlib import Path


class FridayNotifier:
    """
    主动提醒引擎
    后台线程定期巡检，发现事件后触发通知。
    """

    def __init__(self, on_notify=None, on_speak=None):
        """
        参数:
          on_notify: 通知回调函数(title, message) -> None
          on_speak:  语音播报回调函数(text) -> None
        """
        self.on_notify = on_notify
        self.on_speak = on_speak
        self.is_running = False
        self.thread = None
        self.check_interval = 60  # 每60秒检查一次
        self._bus = None

        # 状态缓存（用于检测变化）
        self._last_disk = {}

    # ───────── 事件总线集成 ─────────

    def on_register(self, bus):
        """注册到事件总线：用总线事件代替直接回调"""
        self._bus = bus
        # 总线模式下清除直接回调，避免双重触发
        self.on_notify = None
        self.on_speak = None
        self._last_suspicious = 0
        self._last_daily_done = None

        # 告警抑制（同一条告警不重复弹）
        self._alerted = set()

    # ==================== 启动/停止 ====================

    def start(self):
        """启动后台巡检"""
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        print(f"  🔔 主动提醒已启动 (每{self.check_interval}秒巡检)")

    def stop(self):
        """停止巡检"""
        self.is_running = False

    # ==================== 检查逻辑 ====================

    def _run_loop(self):
        """巡检主循环"""
        # 启动后先等 30 秒再开始（给系统稳定时间）
        time.sleep(30)

        while self.is_running:
            try:
                self._check_disk()
                self._check_memory_cpu()
                self._check_suspicious()
            except Exception as e:
                print(f"  ⚠️ 巡检异常: {e}")
            time.sleep(self.check_interval)

    def _check_disk(self):
        """检查磁盘使用率"""
        try:
            import psutil
            for part in psutil.disk_partitions():
                try:
                    usage = psutil.disk_usage(part.mountpoint)
                    pct = usage.percent
                    device = part.device.strip("\\").rstrip(":")

                    # 首次记录基线
                    if device not in self._last_disk:
                        self._last_disk[device] = pct
                        continue

                    alert_key = f"disk_{device}"
                    if pct > 90 and alert_key not in self._alerted:
                        self._alerted.add(alert_key)
                        msg = f"{device} 盘使用率 {pct}%，仅剩 {usage.free//1024//1024//1024}GB"
                        self._notify("⚠️ 磁盘空间不足", msg)
                        if pct > 95:
                            self._speak(f"提醒你，{device}盘快满了，剩余空间不足{usage.free//1024//1024//1024}G")
                    elif pct <= 85 and alert_key in self._alerted:
                        self._alerted.discard(alert_key)  # 恢复正常后可再次告警

                    self._last_disk[device] = pct
                except Exception:
                    pass
        except Exception:
            pass

    def _check_memory_cpu(self):
        """检查内存和 CPU"""
        try:
            import psutil
            # 内存
            mem = psutil.virtual_memory()
            if mem.percent > 90 and "mem" not in self._alerted:
                self._alerted.add("mem")
                self._notify("⚠️ 内存不足", f"内存使用率 {mem.percent}%，建议关闭部分程序")
            elif mem.percent < 80 and "mem" in self._alerted:
                self._alerted.discard("mem")

            # CPU（持续高负载才告警，单次峰值不告警）
            cpu = psutil.cpu_percent(interval=0.5)
            if cpu > 90 and "cpu" not in self._alerted:
                self._alerted.add("cpu")
                self._notify("⚠️ CPU 过载", f"CPU 使用率 {cpu}%，检查是否有异常进程")
            elif cpu < 70 and "cpu" in self._alerted:
                self._alerted.discard("cpu")
        except Exception:
            pass

    def _check_suspicious(self):
        """检查可疑进程数量变化"""
        try:
            import sys as _sys
            _sys.path.insert(0, str(Path(__file__).parent.parent))
            from system_monitor import FridaySystemMonitor
            m = FridaySystemMonitor()
            suspicious = len(m.scan_suspicious_processes())

            if suspicious > self._last_suspicious and suspicious > 0:
                if f"sus_{suspicious}" not in self._alerted:
                    self._alerted.add(f"sus_{suspicious}")
                    self._notify("🔍 可疑进程", f"发现 {suspicious} 个可疑进程")
                    self._speak(f"发现 {suspicious} 个可疑进程，建议检查")

            self._last_suspicious = suspicious
        except Exception:
            pass

    # ==================== 手动触发提醒 ====================

    def notify_daily_done(self, summary="每日任务已完成"):
        """每日任务完成通知"""
        self._notify("📋 每日任务", summary)

    def notify_policy_update(self, title, summary):
        """政策更新通知"""
        self._notify("📊 政策商机", f"{title}: {summary[:50]}...")

    def notify_system_health(self, status):
        """系统健康通知"""
        if "异常" in status or "告警" in status:
            self._notify("🖥️ 系统健康", status)
        # 正常不通知

    # ==================== 通知输出 ====================

    def _notify(self, title, message):
        """发送 Windows 通知"""
        print(f"  🔔 [{title}] {message}")
        if self._bus:
            self._bus.emit("notifier.notify", title=title, message=message)
        elif self.on_notify:
            try:
                self.on_notify(title, message)
            except Exception:
                pass

    def _speak(self, text):
        """语音播报（可选）"""
        if self._bus:
            self._bus.emit("notifier.speak", text=text)
        elif self.on_speak:
            try:
                self.on_speak(text)
            except Exception:
                pass

    def notify_now(self, title, message, speak=False):
        """主动触发一条通知"""
        self._notify(title, message)
        if speak:
            self._speak(message)
