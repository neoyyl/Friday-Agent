#!/usr/bin/env python3
"""
Friday Hotkey — 全局快捷键唤醒
===================================
注册一个全局快捷键，按下时唤醒 Friday。

默认快捷键: Ctrl+Alt+F（可自定义）

用法：
  python friday_hotkey.py                         → 启动快捷键监听
  python friday_hotkey.py --key "ctrl+alt+space"  → 自定义快捷键

作者：Friday Kernel
"""

import threading
import time
import sys


class FridayHotkey:
    """
    全局快捷键监听器
    按下指定的快捷键组合，触发回调。
    """

    def __init__(self, hotkey="ctrl+alt+f", on_trigger=None, event_name=None):
        """
        参数:
          hotkey: 快捷键组合，如 "ctrl+shift+f"
          on_trigger: 触发回调函数()
          event_name: 事件总线事件名（如 "hotkey.wake"），总线模式时使用
        """
        self.hotkey = hotkey
        self.on_trigger = on_trigger
        self.is_running = False
        self.listener_thread = None
        self._bus = None
        self._event_name = event_name

    # ───────── 事件总线集成 ─────────

    def on_register(self, bus):
        """注册到事件总线：热键触发时发布事件"""
        self._bus = bus
        if self._event_name:
            self.on_trigger = None  # 总线模式下清除直接回调

    def start(self):
        """启动监听"""
        if self.is_running:
            return
        self.is_running = True

        try:
            import keyboard as kb

            def callback(e=None):
                if self._bus and self._event_name:
                    self._bus.emit(self._event_name)
                elif self.on_trigger:
                    self.on_trigger()

            # 注册全局热键
            kb.add_hotkey(self.hotkey, callback)
            print(f"  ⌨️ 快捷键已注册: {self.hotkey.upper()}")
            print(f"     在任何界面按此组合键唤醒 Friday")

            # 保持线程运行
            self.listener_thread = threading.Thread(target=kb.wait, daemon=True)
            self.listener_thread.start()

        except ImportError:
            print(f"  ⚠️ keyboard 模块不可用，快捷键无法注册")
        except Exception as e:
            print(f"  ⚠️ 快捷键注册失败: {e}")

    def stop(self):
        """停止监听"""
        self.is_running = False
        try:
            import keyboard as kb
            kb.remove_hotkey(self.hotkey)
        except Exception:
            pass


# ==================== 独立测试 ====================

if __name__ == "__main__":
    hotkey = "ctrl+shift+f"

    if "--key" in sys.argv:
        idx = sys.argv.index("--key")
        if idx + 1 < len(sys.argv):
            hotkey = sys.argv[idx + 1]

    print(f"  ⌨️ Friday 快捷键测试 — 按 {hotkey.upper()} 触发")

    def on_trigger():
        print(f">>> 快捷键 {hotkey.upper()} 触发！")

    hk = FridayHotkey(hotkey=hotkey, on_trigger=on_trigger)
    hk.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        hk.stop()
        print("\n已停止")
