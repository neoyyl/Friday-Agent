#!/usr/bin/env python3
"""
Friday Voice Engine — 语音交互引擎（总线兼容）
=====================================================
薄包装：TTS 播放委托给 audio/player.py，本层只负责：
  - 事件总线注册
  - 命令处理流程（process_command / _simple_command_handler）
  - 与 Friday / OpenCode 的集成接口

v3.0 架构：
  friday_voice.py (legacy/)
    └── audio/player.py (services-level)
          └── edge-tts / pygame
"""

import sys
import os
import threading
import queue
from pathlib import Path

from audio.player import TTSPlayer


class FridayVoiceEngine:
    """
    Friday 语音交互引擎 v3.0
    薄封装 TTSPlayer，添加命令处理 + 总线集成。
    """

    def __init__(self, on_state_change=None):
        self.on_state_change = on_state_change
        # 内部 TTS 播放器（纯技术层）
        self._player = TTSPlayer(on_state_change=self._player_state_change)
        self.tts_available = self._player.tts_available
        self._bus = None

    def _player_state_change(self, state):
        """TTSPlayer 状态变化 → 转发到本层"""
        if self._bus:
            self._bus.emit("voice.state_change", state=state)
        if self.on_state_change:
            self.on_state_change(state)

    # ───────── 事件总线集成 ─────────

    def on_register(self, bus):
        """注册到事件总线"""
        self._bus = bus
        bus.on("voice.speak", self._on_bus_speak)
        bus.on("voice.stop", lambda: self.stop_speaking())
        bus.register_service("tts", self)

    def _on_bus_speak(self, text=None, voice="zh-CN-XiaoyiNeural", wait=False, **kwargs):
        if text:
            self.speak(text, voice=voice, wait=wait)

    # ───────── TTS 播放（委托给 player）─────────

    @property
    def is_speaking(self):
        return self._player.is_playing

    def speak(self, text, voice="zh-CN-XiaoyiNeural", wait=False):
        self._player.play(text, voice=voice, wait=wait)

    def stop_speaking(self):
        self._player.stop()

    # ==================== 语音转文字 ====================

    def recognize_from_file(self, audio_file):
        """从音频文件进行语音识别"""
        try:
            import speech_recognition as sr
            recognizer = sr.Recognizer()
            with sr.AudioFile(audio_file) as source:
                audio = recognizer.record(source)
            text = recognizer.recognize_google(audio, language="zh-CN")
            return text.strip()
        except Exception as e:
            print(f"语音识别失败: {e}")
            return None

    # ==================== 命令处理 ====================

    def process_command(self, text):
        """处理语音命令（非总线模式回调）"""
        if not text:
            return

        print(f"  🗣️ 命令: \"{text}\"")
        self._notify_state("thinking")

        response = self._simple_command_handler(text)

        if response:
            print(f"  💬 Friday: {response}")
            self.speak(response)
        else:
            self._notify_state("idle")

    def _notify_state(self, state):
        if self._bus:
            self._bus.emit("voice.state_change", state=state)
        if self.on_state_change:
            self.on_state_change(state)

    def _simple_command_handler(self, text):
        """简单的命令处理（后续由 Agent 接管）"""
        text_lower = text.lower()

        # 记笔记
        if any(w in text for w in ["记一下", "记笔记", "记住", "帮我记"]):
            for prefix in ["记一下", "记笔记", "记住", "帮我记"]:
                if prefix in text:
                    note_text = text.split(prefix, 1)[-1].strip()
                    break
            else:
                note_text = text
            try:
                from friday_obsidian import ObsidianWriter
                writer = ObsidianWriter()
                writer.quick_note(note_text, tags=["voice"])
                return f"已记下：{note_text[:40]}{'...' if len(note_text)>40 else ''}"
            except Exception as e:
                return f"记笔记失败：{e}"

        # 知识库查询
        query_keywords = ["关于", "知道什么", "查一下", "搜索", "有什么记录",
                          "有哪些", "是什么", "怎么回事", "怎么说"]
        if any(kw in text for kw in query_keywords):
            try:
                from friday_knowledge import KnowledgeQuery
                kq = KnowledgeQuery()
                result = kq.ask(text)
                return result
            except Exception as e:
                return f"查询知识库失败：{e}"

        if any(w in text for w in ["你好", "hello", "嗨", "hi"]):
            return "你好，我是 Friday。有什么可以帮你的？"

        if any(w in text for w in ["时间", "几点", "现在"]):
            import datetime
            now = datetime.datetime.now()
            return f"现在是 {now.strftime('%H 点 %M 分')}"

        if "天气" in text:
            return "好的，正在帮你查询天气。这个功能还需要进一步完善。"

        if any(w in text for w in ["健康", "状态", "电脑", "系统"]):
            try:
                from system_monitor import FridaySystemMonitor
                m = FridaySystemMonitor()
                h = m.health_check()
                cpu = h["cpu"].get("overall_percent", "?")
                mem = h["memory"].get("virtual", {}).get("percent", "?")
                disk_c = h.get("disk", {}).get("partitions", [{}])[0].get("percent", "?")
                return f"电脑状态：CPU {cpu}%，内存 {mem}%，C盘 {disk_c}%。"
            except Exception as e:
                return f"系统检查出错: {e}"

        if any(w in text for w in ["再见", "拜拜", "退出", "休息"]):
            return "好的，随时叫我。星期五在这里。"

        return self._route_to_opencode(text)

    def _route_to_opencode(self, text):
        """复杂命令路由到 OpenCode"""
        return f"收到指令：{text}。这个功能我在学习中，正在变得越来越聪明。"


# ==================== 独立测试 ====================

if __name__ == "__main__":
    def test_state_change(state):
        print(f"  [状态] → {state}")

    engine = FridayVoiceEngine(on_state_change=test_state_change)
    print(f"TTS 可用: {engine.tts_available}")

    test_commands = ["你好", "现在几点", "电脑状态怎么样", "再见"]
    for cmd in test_commands:
        print(f"\n输入: {cmd}")
        engine.process_command(cmd)
