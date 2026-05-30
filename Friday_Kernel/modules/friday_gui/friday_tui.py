#!/usr/bin/env python3
"""
Friday TUI — 终端控制面板 v0.2
=====================================
基于 Textual 的 Friday 控制中心。
集成系统监控、状态同步、命令处理。

启动：
  python friday_tui.py

快捷键：
  Ctrl+F  唤醒
  Ctrl+H  健康检查
  Ctrl+I  摄入知识库
  Ctrl+Q  退出
  Escape  聚焦输入框

作者：Friday Kernel
"""

import sys
import time
import datetime
import threading
import subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical, Container
from textual.widgets import Static, Button, Input, ListView, ListItem, Label
from textual.reactive import reactive
from textual.binding import Binding


# ===================== 日志条目 =====================

class LogItem(Static):
    """带颜色和图标日志"""

    LEVELS = {
        "wake":    ("🔥", "#00d2ff"),
        "command": ("🗣️", "#7c3aed"),
        "speak":   ("💬", "#10b981"),
        "info":    ("ℹ️", "#8b949e"),
        "warn":    ("⚠️", "#d29922"),
        "error":   ("🚨", "#f85149"),
        "ok":      ("✅", "#10b981"),
    }

    def __init__(self, message: str, level: str = "info"):
        icon, color = self.LEVELS.get(level, (" ", "#8b949e"))
        now = datetime.datetime.now().strftime("%H:%M:%S")
        text = f"[#484f58]{now}[/] [{color}]{icon} {message}[/]"
        super().__init__(text)


# ===================== 主应用 =====================

class FridayTUI(App):
    """Friday 终端控制面板"""

    CSS = """
Screen { background: #0d1117; }

#header-bar {
    height: 3; dock: top; background: #161b22;
    padding: 0 1; align: center middle;
}
#header-bar Label { color: #8b949e; }

#status-circle {
    width: 10; content-align: center middle;
    text-style: bold;
}

#main-area { height: 1fr; }

/* 左侧面板 */
#left-panel { width: 40%; min-width: 34; padding: 1; }

#card {
    border: solid #30363d; height: 12; margin: 0 0 1 0; padding: 1;
}

#quick-actions {
    border: solid #30363d; padding: 1; margin: 0 0 1 0;
}
#quick-actions Horizontal { height: 3; }
Button {
    width: 1fr; margin: 0 1 0 0;
    background: #21262d; color: #c9d1d9; border: none;
}
Button:hover { background: #30363d; }
Button.primary { background: #0f3460; color: #00d2ff; }

/* 右侧面板 */
#right-panel { width: 60%; padding: 1 1 1 0; }

#log-card { border: solid #30363d; height: 1fr; }
#log-title-bar {
    height: 3; background: #161b22;
    padding: 0 1; content-align: left middle;
}
#log-title-bar Label { color: #8b949e; text-style: bold; }
#log-list { height: 1fr; }

/* 底部输入 */
#input-area {
    height: 5; dock: bottom; background: #161b22;
    border-top: solid #21262d; padding: 0 1;
}
#input-box { height: 3; }
#input-box Input {
    width: 1fr; background: #0d1117; color: #c9d1d9;
    border: solid #30363d;
}
#input-box Input:focus { border: solid #00d2ff; }
#mic-icon { width: 3; content-align: center middle; color: #484f58; }

/* 进度条 */
.bar-bg { color: #30363d; }
.bar-fg { color: #00d2ff; }
.bar-warn { color: #d29922; }
.bar-danger { color: #f85149; }
    """

    state = reactive("idle")
    state_text = reactive("待机中")

    BINDINGS = [
        Binding("ctrl+f", "wake", "唤醒"),
        Binding("ctrl+h", "health", "健康"),
        Binding("ctrl+i", "ingest", "摄入"),
        Binding("ctrl+q", "quit", "退出"),
        Binding("escape", "focus_input", "输入"),
    ]

    def __init__(self):
        super().__init__()
        self._sys_timer = None
        self._pulse = 0
        self._pulse_dir = 1

    # ===================== 界面构建 =====================

    def compose(self) -> ComposeResult:
        with Container():
            # 顶部栏
            with Horizontal(id="header-bar"):
                yield Label("🟢 ", id="hdr-icon")
                yield Label("待机中", id="hdr-state")
                yield Label("  Friday 控制面板  ", id="hdr-title")
                yield Label(id="hdr-time")

            # 主区域
            with Horizontal(id="main-area"):
                # 左面板
                with Vertical(id="left-panel"):
                    # 状态卡
                    with Vertical(id="card"):
                        with Horizontal():
                            yield Static("●", id="status-circle")
                            with Vertical():
                                yield Label("状态: 待机中", id="lbl-state")
                                yield Label("声纹: ✅ 已注册", id="lbl-voice")
                                yield Label("快捷键: Ctrl+Alt+F", id="lbl-hotkey")
                                yield Label("CPU: -- | 内存: --", id="lbl-sys")
                        yield Label("", id="lbl-disk")

                    # 快捷操作
                    with Vertical(id="quick-actions"):
                        yield Label("⚡ 快捷操作")
                        with Horizontal():
                            yield Button("🎤 唤醒", id="b-wake", variant="primary")
                            yield Button("💻 健康", id="b-health")
                            yield Button("📋 任务", id="b-tasks")
                        with Horizontal():
                            yield Button("📥 摄入", id="b-ingest")
                            yield Button("📝 记笔记", id="b-note")
                            yield Button("🧹 检查", id="b-lint")

                # 右面板
                with Vertical(id="right-panel"):
                    with Vertical(id="log-card"):
                        with Horizontal(id="log-title-bar"):
                            yield Label("📋 运行日志")
                        yield ListView(id="log-list")

            # 底部输入
            with Horizontal(id="input-area"):
                yield Label("🎤", id="mic-icon")
                with Horizontal(id="input-box"):
                    yield Input(placeholder='输入指令，或说"星期五"语音唤醒', id="cmd-input")

    def on_mount(self):
        """初始化"""
        # 时间更新
        self.set_interval(1, self._update_time)

        # 系统监控刷新（每3秒）
        self.set_interval(3, self._refresh_sysinfo)

        # 状态脉冲动画
        self.set_interval(0.5, self._pulse_circle)

        # 欢迎日志
        self.add_log("Friday 控制面板已启动", "info")
        self.add_log("说「星期五」或 Ctrl+F 唤醒 | Ctrl+H 健康检查 | Ctrl+Q 退出", "info")

    # ===================== 定时任务 =====================

    def _update_time(self):
        """更新时间"""
        now = datetime.datetime.now().strftime("%H:%M:%S")
        self.query_one("#hdr-time").update(now)

    def _refresh_sysinfo(self):
        """刷新系统信息"""
        try:
            import psutil
            cpu = psutil.cpu_percent(interval=0.3)
            mem = psutil.virtual_memory()
            self.query_one("#lbl-sys").update(f"CPU: {cpu:.1f}% | 内存: {mem.percent:.0f}%")

            # 磁盘
            disks = []
            for p in psutil.disk_partitions():
                try:
                    u = psutil.disk_usage(p.mountpoint)
                    if u.total > 0:
                        disks.append((p.device, u.percent))
                except Exception: pass
            disk_text = "  ".join([f"{d}: {'█'*int(p//10)}{'░'*(10-int(p//10))} {p:.0f}%" for d, p in disks])
            self.query_one("#lbl-disk").update(f"💾 {disk_text}")
        except Exception:
            pass

    def _pulse_circle(self):
        """状态圆环脉冲"""
        self._pulse += self._pulse_dir * 0.1
        if self._pulse >= 1 or self._pulse <= 0:
            self._pulse_dir *= -1

        intensity = 0.5 + self._pulse * 0.5
        colors = {
            "idle":       f"#0f3460",  # 深蓝
            "listening":  f"#00d2ff",  # 亮蓝
            "thinking":   f"#7c3aed",  # 紫
            "speaking":   f"#10b981",  # 绿
        }
        states = {
            "idle":      ("🟢", "待机中", colors["idle"]),
            "listening": ("🔵", "聆听中...", colors["listening"]),
            "thinking":  ("🟣", "思考中...", colors["thinking"]),
            "speaking":  ("🟢", "回复中...", colors["speaking"]),
        }
        icon, text, color = states.get(self.state, ("⚪", "未知", "#888"))

        circle = self.query_one("#status-circle")
        circle.styles.color = color

        self.query_one("#hdr-icon").update(f"{icon} ")
        self.query_one("#hdr-state").update(text)
        self.query_one("#lbl-state").update(f"状态: {text}")

    # ===================== 状态控制 =====================

    def set_state(self, new_state):
        self.state = new_state
        self.state_text = {
            "idle": "待机中", "listening": "聆听中...",
            "thinking": "思考中...", "speaking": "回复中...",
        }.get(new_state, "待机中")

    # ===================== 按钮事件 =====================

    def on_button_pressed(self, e):
        {
            "b-wake":    self.action_wake,
            "b-health":  self.action_health,
            "b-tasks":   self.action_tasks,
            "b-ingest":  self.action_ingest,
            "b-note":    self.action_note,
            "b-lint":    self.action_lint,
        }.get(e.button.id, lambda: None)()

    # ===================== 操作实现 =====================

    def action_wake(self):
        self.set_state("listening")
        self.add_log("手动唤醒", "wake")
        self.set_timer(1.5, self._reset_to_idle)

    def _reset_to_idle(self):
        self.set_state("idle")

    def action_health(self):
        self.set_state("thinking")
        self.add_log("系统健康检查...", "info")
        try:
            import psutil
            cpu = psutil.cpu_percent(interval=0.5)
            mem = psutil.virtual_memory()
            disk = psutil.disk_usage("C:\\")
            lines = [
                f"CPU: {cpu}%",
                f"内存: {mem.percent}% ({mem.used//1024//1024}MB/{mem.total//1024//1024}MB)",
                f"C盘: {disk.percent}% ({disk.used//1024//1024//1024}GB/{disk.total//1024//1024//1024}GB)",
            ]
            for l in lines:
                self.add_log(l, "ok")
        except Exception as e:
            self.add_log(f"健康检查失败: {e}", "error")
        self._refresh_sysinfo()
        self.set_state("idle")

    def action_tasks(self):
        self.add_log("执行每日任务清单...", "info")
        threading.Thread(target=self._run_tasks_bg, daemon=True).start()

    def _run_tasks_bg(self):
        self.call_from_thread(self.set_state, "thinking")
        try:
            kernel_base = Path(__file__).resolve().parent.parent.parent
            r = subprocess.run(
                [sys.executable, str(kernel_base / "modules" / "legacy" / "os_layer.py"), "report"],
                capture_output=True, text=True, timeout=60
            )
            self.call_from_thread(self.add_log, "每日任务完成 ✅", "ok")
        except Exception as e:
            self.call_from_thread(self.add_log, f"任务失败: {e}", "error")
        self.call_from_thread(self.set_state, "idle")
        self.call_from_thread(self._refresh_sysinfo)

    def action_ingest(self):
        self.add_log("摄入知识库...", "info")
        threading.Thread(target=self._ingest_bg, daemon=True).start()

    def _ingest_bg(self):
        self.call_from_thread(self.set_state, "thinking")
        try:
            kernel_base = Path(__file__).resolve().parent.parent.parent
            r = subprocess.run(
                [sys.executable, str(kernel_base / "modules" / "services" / "friday_obsidian.py"), "--ingest-daily"],
                capture_output=True, text=True, timeout=30
            )
            for line in r.stdout.strip().split("\n"):
                if line.strip():
                    self.call_from_thread(self.add_log, line.strip(), "info")
        except Exception as e:
            self.call_from_thread(self.add_log, f"摄入失败: {e}", "error")
        self.call_from_thread(self.set_state, "idle")

    def action_note(self):
        inp = self.query_one("#cmd-input")
        inp.value = "记一下 "
        inp.focus()
        self.add_log("输入笔记内容后回车", "info")

    def action_lint(self):
        self.add_log("请在输入框输入: 检查知识库", "info")

    # ===================== 输入处理 =====================

    def on_input_submitted(self, e):
        text = e.value.strip()
        if not text:
            return
        e.input.value = ""
        self.add_log(f">>> {text}", "command")

        if text in ["健康", "系统健康", "health"]:
            self.action_health()
        elif text in ["任务", "执行任务", "tasks"]:
            self.action_tasks()
        elif text in ["摄入", "ingest"]:
            self.action_ingest()
        elif text.startswith("记一下"):
            note = text[3:].strip()
            if note:
                try:
                    from friday_obsidian import ObsidianWriter
                    ObsidianWriter().quick_note(note, tags=["tui"])
                    self.add_log(f"✅ 已记下: {note[:40]}...", "ok")
                except Exception as ex:
                    self.add_log(f"❌ 记笔记失败: {ex}", "error")
        elif text in ["退出", "quit"]:
            self.exit()
        else:
            self.add_log(f"未知指令: {text}  (试试: 健康 / 任务 / 摄入)", "warn")

    # ===================== 日志 =====================

    def add_log(self, msg, level="info"):
        """添加日志条目"""
        try:
            lv = self.query_one("#log-list")
            lv.append(ListItem(LogItem(msg, level)))
            lv.scroll_end(animate=False)
            if len(lv) > 200:
                lv.pop(0)
        except Exception:
            pass

    # ===================== 快捷键 =====================

    def action_focus_input(self):
        self.query_one("#cmd-input").focus()

    def action_quit(self):
        self.exit()


# ===================== 启动 =====================

if __name__ == "__main__":
    app = FridayTUI()
    app.run()
