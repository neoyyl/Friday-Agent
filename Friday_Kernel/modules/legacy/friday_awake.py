#!/usr/bin/env python3
"""
Friday Awake — 主控制器
==============================
把叠加层、唤醒监听、语音交互整合为一个完整的桌面助手。
加入系统托盘驻留，最小化到托盘运行。

启动后：
  1. 系统托盘出现 Friday 图标
  2. 右下角脉冲圆形待机
  3. 说"星期五"唤醒 → 交互
  4. 右键托盘图标可退出

用法：
  python friday_awake.py         → 启动 Friday 桌面助手
  python friday_awake.py --test  → 测试模式（只显示叠加层动画）
  python friday_awake.py --voice → 语音对话测试（无GUI）

作者：Friday Kernel
版本：0.1.0
"""

import sys
import os
import threading
import time
import signal
from pathlib import Path

# 确保控制台支持 UTF-8 输出（修复中文+emoji乱码崩溃）
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

# 确保能找到模块
# 添加模块根目录、services/、legacy/ 到搜索路径
_MODULE_ROOT = str(Path(__file__).parent.parent)
sys.path.insert(0, _MODULE_ROOT)
sys.path.insert(0, str(Path(_MODULE_ROOT) / "services"))
sys.path.insert(0, str(Path(_MODULE_ROOT) / "legacy"))


class FridayAwake:
    """
    Friday 桌面唤醒助手主控制器
    """

    def __init__(self):
        self.overlay = None
        self.listener = None
        self.voice_engine = None
        self.voiceprint_gate = None
        self.hotkey = None
        self.tray_icon = None
        self.running = False
        self.awaiting_command = False  # 是否在等待命令
        self.command_timeout = 3       # 静音3秒自动回到待机
        self.memory = None             # v2.0: 跨会话记忆
        self.timing = None             # v2.0: 时机判断

    def on_state_change(self, state):
        """状态变化回调——更新叠加层"""
        if self.overlay:
            try:
                self.overlay.set_state(state)
            except Exception:
                pass

    def go_idle(self):
        """回到待机状态 — v2.0 自动保存记忆"""
        # v2.0: 如果会话还在进行，自动保存（超时待机）
        if self.memory and self.memory.current_session is not None:
            self.memory.end_session("timeout")
        self.awaiting_command = False
        self.on_state_change("idle")
        print("  💤 待机中...")

    def _notify(self, title, message):
        """发送 Windows 通知"""
        try:
            from plyer import notification
            notification.notify(title=title, message=message, timeout=5, app_name="Friday")
        except Exception:
            try:
                import subprocess
                # PowerShell 方式弹通知
                ps_cmd = f'''
                [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
                $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
                $textNodes = $template.GetElementsByTagName("text")
                $textNodes.Item(0).AppendChild($template.CreateTextNode("{title}")) > $null
                $textNodes.Item(1).AppendChild($template.CreateTextNode("{message}")) > $null
                $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
                [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Friday").Show($toast)
                '''
                subprocess.run(["powershell", "-Command", ps_cmd], capture_output=True, timeout=5)
            except Exception:
                pass  # 通知失败不影响主功能

    def on_wake_detected(self, text, audio_data):
        """声纹匹配 → 唤醒 — v2.0 带记忆上下文 + 时机感知"""
        print(f"\n🔥 主人来了!")

        # v2.0: 检查当前是否适合语音交互
        if self.timing:
            modality = self.timing.get_best_modality()
            if modality == "silent":
                # 深夜/清晨 → 不语音响应，只亮状态
                print(f"  🔇 当前为休息时间，仅亮灯不发声")
                self.on_state_change("idle")
                return
            elif modality == "notification":
                # 会议中/全屏 → 用通知代替语音
                print(f"  🔔 当前为专注时间，用通知代替语音")
                # 仍然启动会话，但不发声
                if self.memory:
                    self.memory.start_session()
                self.on_state_change("idle")
                self.awaiting_command = False
                return

        self.on_state_change("listening")
        self.awaiting_command = True

        # v2.0: 启动跨会话记忆
        if self.memory:
            self.memory.start_session()
            # 如果有历史，用 TTS 简短提示（不打扰式唤醒）
            last_summary = self.memory.get_last_summary()
            if last_summary and "空会话" not in last_summary:
                ctx_text = self.memory.get_context_text(max_sessions=1)
                print(f"  🧠 上次: {last_summary}")

        # 尝试识别唤醒时的语音（可能命令就混在唤醒语里）
        recognized_text = None
        if audio_data is not None:
            try:
                import speech_recognition as sr
                recognizer = sr.Recognizer()
                audio_int16 = (audio_data * 32767).astype(np.int16)
                audio = sr.AudioData(audio_int16.tobytes(), 16000, 2)
                try:
                    recognized_text = recognizer.recognize_google(audio, language="zh-CN")
                    print(f"  🗣️ \"{recognized_text}\"")
                except Exception:
                    pass
            except Exception:
                pass

        if recognized_text and self.awaiting_command:
            self.on_command(recognized_text)
            # 命令处理完后 listener 会收到 idle 信号，不再等后续语音
        # else: listener 的 VAD 会继续监听后续语音作为命令

    def on_command(self, text):
        """处理语音命令 — v2.0 持续对话模式 + 跨会话记忆"""
        if not text:
            return
        if self.awaiting_command:
            self.awaiting_command = False

        text = text.strip()
        print(f"  🗣️ 命令: {text}")

        # v2.0: 记录命令到跨会话记忆
        if self.memory:
            self.memory.record_command(text)

        # 结束命令
        if any(w in text for w in ["再见", "拜拜", "退出", "休息", "说完了", "没了", "就这些", "没有"]):
            print(f"  ✅ 收到结束指令")
            # 打断可能的TTS
            if self.voice_engine:
                self.voice_engine.stop_speaking()
            # v2.0: 保存跨会话记忆
            if self.memory:
                self.memory.end_session("user_said_goodbye")
            # 通知 listener 结束持续对话
            if hasattr(self, 'listener') and self.listener:
                self.listener.end_conversation()
            if self.voice_engine:
                self.voice_engine.speak("好的，随时叫我。", wait=True)
            self.go_idle()
            return

        # 正常命令 → 处理（不待机，保持对话模式）
        if self.voice_engine:
            self.voice_engine.process_command(text)
        else:
            self.on_state_change("thinking")
            time.sleep(0.5)
            self.on_state_change("speaking")
            time.sleep(0.5)

        # v2.0: 持续对话模式下不回到待机
        # listener 会继续监听下一句，直到超时或用户说拜拜
        if self.listener and self.listener.conversation_mode:
            self.awaiting_command = True
            self.on_state_change("listening")
            print(f"  🎤 继续聆听...")
        else:
            self.go_idle()

    def on_speech_during_playback(self):
        """当播放语音时检测到用户说话—打断当前TTS"""
        print(f"  🔇 检测到用户说话，打断TTS")
        if self.voice_engine:
            self.voice_engine.stop_speaking()
        # 状态回到聆听
        self.on_state_change("listening")

    def setup_tray(self):
        """创建系统托盘图标"""
        try:
            import pystray
            from PIL import Image, ImageDraw

            def create_image():
                """创建托盘图标——一个简单的 F 字母"""
                size = 64
                img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
                draw = ImageDraw.Draw(img)
                # 绘制圆形底
                draw.ellipse([4, 4, size - 4, size - 4], fill="#0f3460")
                # 绘制 F
                draw.text((size // 2 - 8, size // 2 - 12), "F", fill="#00d2ff")
                return img

            def on_quit(icon, item):
                """退出菜单"""
                icon.stop()
                self.stop()

            def on_show(icon, item):
                """显示/隐藏叠加层"""
                if self.overlay:
                    self.overlay.set_state("idle")

            def on_health(icon, item):
                """健康检查"""
                try:
                    import subprocess, sys as _sys, os as _os
                    _kb = str(Path(__file__).resolve().parent.parent.parent)
                    _env = _os.environ.copy()
                    _env["FRIDAY_KERNEL_BASE"] = _kb
                    result = subprocess.run([_sys.executable, "-c", """
import os, sys
sys.path.insert(0, os.environ['FRIDAY_KERNEL_BASE'] + '/modules')
from legacy.system_monitor import FridaySystemMonitor
m = FridaySystemMonitor()
h = m.health_check()
print(f"CPU: {h['cpu']['overall_percent']}% | 内存: {h['memory']['virtual']['percent']}%")
print(f"磁盘: {h['disk']['summary']}")
"""],
                        capture_output=True, text=True, timeout=10, env=_env)
                    self._notify("Friday 健康检查", result.stdout.strip()[:120])
                except Exception as e:
                    self._notify("健康检查失败", str(e))

            def on_ingest(icon, item):
                """摄入知识库"""
                try:
                    import subprocess, sys as _sys
                    _kb = Path(__file__).resolve().parent.parent.parent
                    _obsidian = str(_kb / "modules" / "services" / "friday_obsidian.py")
                    subprocess.Popen([_sys.executable, _obsidian, "--ingest-daily"],
                        creationflags=subprocess.CREATE_NO_WINDOW)
                    self._notify("Friday", "知识库摄入已启动")
                except Exception as e:
                    self._notify("摄入失败", str(e))

            def on_tasks(icon, item):
                """执行任务清单"""
                import threading as _t
                _t.Thread(target=lambda: (
                    self._notify("Friday", "每日任务开始执行"),
                    self.action_health() if hasattr(self, 'action_health') else None
                ), daemon=True).start()

            self.tray_icon = pystray.Icon(
                "Friday",
                create_image(),
                "Friday Awake - Say 'Xing Qi Wu' to wake",
                menu=pystray.Menu(
                    pystray.MenuItem("📊 健康检查", on_health),
                    pystray.MenuItem("📥 摄入知识库", on_ingest),
                    pystray.MenuItem("📋 执行任务", on_tasks),
                    pystray.Menu.SEPARATOR,
                    pystray.MenuItem("显示 Friday", on_show, default=True),
                    pystray.Menu.SEPARATOR,
                    pystray.MenuItem("退出", on_quit),
                ),
            )

            # 在后台线程运行托盘
            tray_thread = threading.Thread(target=self.tray_icon.run, daemon=True)
            tray_thread.start()
            print("  🔵 系统托盘图标已创建")
        except Exception as e:
            print(f"  ⚠️ 系统托盘不可用: {e}")

    def start(self):
        """启动 Friday 桌面助手"""
        print("=" * 50)
        print("  Friday Awake — 正在启动...")
        print("=" * 50)

        self.running = True

        # 1. 初始化跨会话记忆
        print("  🧠 加载跨会话记忆...")
        try:
            from friday_memory import ConversationMemory
            self.memory = ConversationMemory()
            stats = self.memory.get_stats()
            print(f"     历史: {stats['total_sessions']} 次会话, {stats['total_commands']} 条指令")
        except Exception as e:
            print(f"  ⚠️ 记忆模块不可用: {e}")
            self.memory = None

        # 1b. 初始化时机判断引擎
        print("  ⏰ 初始化时机判断引擎...")
        try:
            from friday_timing import FridayTiming
            self.timing = FridayTiming()
            modality = self.timing.get_best_modality()
            print(f"     当前推荐沟通方式: {modality}")
        except Exception as e:
            print(f"  ⚠️ 时机判断不可用: {e}")
            self.timing = None

        # 2. 创建系统托盘
        self.setup_tray()

        # 2. 创建叠加层
        print("  📺 创建屏幕叠加层...")
        from friday_overlay import FridayOverlay
        self.overlay = FridayOverlay()
        self.overlay.set_state("idle")

        # 3. 初始化声纹门禁
        print("  🔑 初始化声纹门禁...")
        try:
            from voiceprint_gate import VoiceprintGate
            self.voiceprint_gate = VoiceprintGate(threshold=0.70)
            if self.voiceprint_gate.check_enrolled():
                print(f"  ✅ {self.voiceprint_gate.get_status_string()}")
            else:
                print(f"  ⚠️ 未注册声纹—所有声音可唤醒")
                print(f"     运行: python voiceprint_gate.py --enroll")
        except Exception as e:
            print(f"  ⚠️ 声纹不可用: {e}")
            self.voiceprint_gate = None

        # 4. 创建语音引擎
        print("  🎙️ 初始化语音引擎...")
        from friday_voice import FridayVoiceEngine
        self.voice_engine = FridayVoiceEngine(on_state_change=self.on_state_change)

        # 5. 创建唤醒监听器（带声纹门禁 + barge-in 打断）
        print("  🎤 启动唤醒监听...")
        from friday_listener import FridayListener
        self.listener = FridayListener(
            on_wake=self.on_wake_detected,
            on_command=self.on_command,
            voiceprint_gate=self.voiceprint_gate,
            on_speech_during_playback=self.on_speech_during_playback,
        )
        self.listener.set_on_state_change(self.on_state_change)
        # v2.0: 设置打断检测函数
        if self.voice_engine:
            self.listener.set_is_speaking_check(lambda: self.voice_engine.is_speaking if self.voice_engine else False)
        self.listener.start()

        # 6. 注册全局快捷键
        print("  ⌨️ 注册快捷键...")
        try:
            from friday_hotkey import FridayHotkey
            def hotkey_wake():
                print(f"\n⌨️ 快捷键唤醒!")
                self.on_wake_detected("hotkey", None)
            self.hotkey = FridayHotkey(hotkey="ctrl+alt+f", on_trigger=hotkey_wake)
            self.hotkey.start()
        except Exception as e:
            print(f"  ⚠️ 快捷键不可用: {e}")

        print("  ✅ Friday Awake 已就绪！")
        print("  说 \"星期五\" 或按 Ctrl+Alt+F 唤醒我")
        print("  右键系统托盘图标退出")
        print("=" * 50)

        # 运行叠加层（阻塞，保持程序运行）
        self.overlay.run()

    def stop(self):
        """停止 Friday 桌面助手"""
        print("\n  👋 Friday 正在关闭...")
        self.running = False
        if self.hotkey:
            try: self.hotkey.stop()
            except Exception: pass
        if self.listener:
            try:
                self.listener.stop()
            except Exception:
                pass
        if self.overlay:
            try:
                self.overlay.stop()
            except Exception:
                pass
        print("  ✅ Friday 已停止")
        os._exit(0)


def voice_test_mode():
    """语音对话测试模式（无GUI）"""
    from friday_listener import FridayListener
    from friday_voice import FridayVoiceEngine

    engine = FridayVoiceEngine()

    def on_wake(text, audio):
        print(f"\n🔥 唤醒！")
        print(f"   你说: {text}")

    def on_command(text):
        print(f"🗣️ {text}")
        engine.process_command(text)

    listener = FridayListener(on_wake=on_wake, on_command=on_command)
    listener.start()

    print("=" * 50)
    print("  Friday 语音对话测试模式")
    print("  说 \"星期五\" 唤醒，然后说话")
    print("  按 Ctrl+C 退出")
    print("=" * 50)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        listener.stop()
        print("\n已退出")


def main():
    if "--test" in sys.argv:
        from friday_overlay import FridayOverlay
        overlay = FridayOverlay()
        overlay.set_state("idle")

        def demo_cycle():
            states = ["idle", "listening", "thinking", "speaking"]
            idx = 0
            while True:
                overlay.set_state(states[idx])
                idx = (idx + 1) % len(states)
                time.sleep(2)

        t = threading.Thread(target=demo_cycle, daemon=True)
        t.start()
        overlay.run()
    elif "--voice" in sys.argv:
        voice_test_mode()
    else:
        app = FridayAwake()
        try:
            app.start()
        except KeyboardInterrupt:
            app.stop()


if __name__ == "__main__":
    main()
