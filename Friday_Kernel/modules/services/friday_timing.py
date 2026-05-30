#!/usr/bin/env python3
"""
Friday 时机判断引擎 v0.1
=========================
判断当前是否适合主动说话——不打扰规则。

评估维度：
  1. 时间段：深夜/清晨不说话（除非紧急）
  2. 前台进程：会议/游戏/全屏应用不说话
  3. 用户活跃度：键盘鼠标长时间无操作 → 用户可能不在
  4. 综合评分：结合所有维度输出是否适合打扰

用法：
    timing = FridayTiming()
    if timing.should_speak():
        engine.speak("提醒你一件事")
    else:
        # 用通知代替
        send_notification(...)

作者：Friday Kernel
版本：0.1.0
"""

import time
import datetime
import threading
from pathlib import Path


class FridayTiming:
    """
    Friday 时机判断引擎
    判断当前是否适合主动语音提示。
    """

    # 会议应用列表（不完全匹配，供 startswith/contains 使用）
    MEETING_APPS = [
        "teams", "zoom", "meeting", "conference",
        "skype", "webex", "slack", "discord",
        "tencent meeting", "腾讯会议", "dingtalk", "钉钉",
        "feishu", "飞书", "wecom", "企业微信",
        "chime", "google meet", "jitsi",
    ]

    # 全屏游戏/沉浸应用（不完全匹配）
    FULLSCREEN_APPS = [
        "game", "play", "steam", "epic", "battle",
        "minecraft", "league of legends", "valorant",
        "cyberpunk", "elden ring", "dota",
    ]

    # 睡眠时间段（不说话）
    SLEEP_HOURS = range(23, 24)  # 23:00-23:59
    SLEEP_HOURS_EARLY = range(0, 8)  # 00:00-07:59

    def __init__(self):
        self._last_activity = time.time()
        self._activity_monitoring = False
        self._idle_threshold = 300  # 5分钟无操作认为用户离开

    # ==================== 核心判断 ====================

    def should_speak(self, check_fullscreen=True, check_hour=True, check_idle=True):
        """
        综合判断当前是否适合主动说话
        
        参数:
            check_fullscreen: 是否检查全屏/会议应用
            check_hour: 是否检查时间段
            check_idle: 是否检查用户活跃度
        
        返回:
            (bool, str): (是否适合说话, 原因)
        """
        reasons = []

        if check_hour:
            ok, reason = self._check_hour()
            if not ok:
                reasons.append(reason)
                return False, "; ".join(reasons)

        if check_fullscreen:
            ok, reason = self._check_foreground()
            if not ok:
                reasons.append(reason)
                return False, "; ".join(reasons)

        if check_idle:
            ok, reason = self._check_idle()
            if not ok:
                reasons.append(reason)
                return False, "; ".join(reasons)

        return True, "适合说话"

    def get_best_modality(self):
        """
        获取当前最佳沟通方式
        
        返回:
            str: "voice" | "notification" | "silent"
        """
        should, reason = self.should_speak()
        if should:
            return "voice"

        # 如果是时间段问题 → 完全静默
        if "深夜" in reason or "清晨" in reason:
            return "silent"

        # 其他情况 → 通知代替语音
        return "notification"

    # ==================== 单项检查 ====================

    def _check_hour(self):
        """检查当前时间段是否适合说话"""
        hour = datetime.datetime.now().hour
        if hour in self.SLEEP_HOURS or hour in self.SLEEP_HOURS_EARLY:
            return False, f"当前时间 ({hour}:00) 是休息时间，不说话"
        return True, "时间段合适"

    def _check_foreground(self):
        """
        检查前台进程是否适合说话
        通过检测当前活动窗口标题和进程名
        """
        try:
            import win32gui
            import win32process
            import psutil

            # 获取前台窗口句柄
            hwnd = win32gui.GetForegroundWindow()
            if not hwnd:
                return True, "无法检测前台窗口"

            # 获取窗口标题
            title = win32gui.GetWindowText(hwnd).lower()

            # 获取进程名
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            try:
                process = psutil.Process(pid)
                proc_name = process.name().lower()
            except Exception:
                proc_name = ""

            combined = f"{title} {proc_name}"

            # 检查是否会议中
            for app in self.MEETING_APPS:
                if app in combined:
                    return False, f"检测到会议应用 ({app})，不说话"

            # 检查是否全屏游戏
            for app in self.FULLSCREEN_APPS:
                if app in combined:
                    return False, f"检测到游戏 ({app})，不说话"

            # 额外：检查窗口是否全屏（通过窗口尺寸判断）
            try:
                import win32con
                from win32api import GetSystemMetrics
                screen_w = GetSystemMetrics(0)
                screen_h = GetSystemMetrics(1)
                rect = win32gui.GetWindowRect(hwnd)
                win_w = rect[2] - rect[0]
                win_h = rect[3] - rect[1]
                # 如果窗口几乎占满屏幕 → 可能是全屏应用
                if win_w >= screen_w * 0.95 and win_h >= screen_h * 0.95:
                    # 排除桌面和资源管理器
                    if "explorer" not in proc_name and "program manager" not in title:
                        return False, "检测到全屏应用，不说话"
            except Exception:
                pass

            return True, f"前台: {proc_name}"

        except ImportError:
            # 没有 win32gui → 跳过前台检测
            return True, "前台检测不可用（无 win32api）"
        except Exception as e:
            return True, f"前台检测异常: {e}"

    def _check_idle(self):
        """
        检查用户是否处于活跃状态
        通过检测键盘鼠标的最后输入时间
        """
        try:
            import ctypes
            # Windows GetLastInputInfo
            class LASTINPUTINFO(ctypes.Structure):
                _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_ulong)]

            lii = LASTINPUTINFO()
            lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
            ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii))

            current_ticks = ctypes.windll.kernel32.GetTickCount()
            idle_ms = current_ticks - lii.dwTime
            idle_seconds = idle_ms / 1000

            if idle_seconds > self._idle_threshold:
                minutes = int(idle_seconds / 60)
                return False, f"用户 {minutes} 分钟无操作，可能不在"

            return True, f"用户活跃 (上次输入 {int(idle_seconds)}秒前)"

        except Exception as e:
            return True, f"活跃度检测异常: {e}"

    # ==================== 工具方法 ====================

    def set_idle_threshold(self, seconds):
        """设置闲置阈值（秒）"""
        self._idle_threshold = max(30, min(3600, seconds))

    def get_status_text(self):
        """获取完整的时机状态文本"""
        lines = []
        ok1, r1 = self._check_hour()
        ok2, r2 = self._check_foreground()
        ok3, r3 = self._check_idle()

        lines.append(f"⏰ 时间: {'✅' if ok1 else '❌'} {r1}")
        lines.append(f"🖥️ 前台: {'✅' if ok2 else '❌'} {r2}")
        lines.append(f"👤 活跃: {'✅' if ok3 else '❌'} {r3}")

        modality = self.get_best_modality()
        mode_icon = {"voice": "🔊", "notification": "🔔", "silent": "🔇"}
        lines.append(f"{mode_icon.get(modality, '❓')} 推荐方式: {modality}")

        return "\n".join(lines)


# ==================== 独立测试 ====================

if __name__ == "__main__":
    print("=" * 50)
    print("  Friday 时机判断引擎测试")
    print("=" * 50)

    timing = FridayTiming()

    print(f"\n  当前时间: {datetime.datetime.now().strftime('%H:%M:%S')}")
    print()

    should, reason = timing.should_speak()
    modality = timing.get_best_modality()
    print(f"  适合说话: {'✅ 是' if should else '❌ 否'}")
    print(f"  原因: {reason}")
    print(f"  推荐方式: {modality}")
    print()
    print("  --- 详细状态 ---")
    print(timing.get_status_text())
