#!/usr/bin/env python3
"""
Friday Listener — 离线语音唤醒监听模块 v3.0
======================================================
v3.0 重构：VAD/音频原语委托给 audio/recognizer.py。
本层只负责：
  - 唤醒状态机（wake_detected / conversation_mode）
  - 声纹验证流程
  - 语音识别（sherpa-onnx / Google STT）
  - 事件总线通信

架构：
  friday_listener.py (legacy/)
    ├── audio/recognizer.py (services-level)  ← VAD + 音频处理
    └── voiceprint_gate.py (services-level)   ← 声纹验证
"""
import threading
import queue
import time
import os
from pathlib import Path

import sounddevice as sd
import numpy as np

from audio.recognizer import VADDetector, SpeechValidator, normalize_audio, frames_to_audio

try:
    from voiceprint_gate import VoiceprintGate
except Exception:
    VoiceprintGate = None


class FridayListener:
    """
    Friday 离线语音唤醒监听器 v3.0
    检测到主人的声音就唤醒，不需要特定唤醒词。
    """

    def __init__(self, on_wake=None, on_command=None, voiceprint_gate=None, on_speech_during_playback=None):
        self.on_wake = on_wake
        self.on_command = on_command
        self.on_speech_during_playback = on_speech_during_playback
        self.is_speaking_check = None
        self.on_state_change = None
        self.voiceprint_gate = voiceprint_gate
        self.has_voiceprint = voiceprint_gate is not None and voiceprint_gate.check_enrolled()
        self.is_listening = False
        self.is_running = False
        self.audio_queue = queue.Queue()
        self.sample_rate = 16000

        # VAD 检测器（音频原语）
        self.vad = VADDetector(sample_rate=self.sample_rate)

        # 录音状态机
        self.recording = False
        self.recorded_frames = []
        self.speech_blocks = 0
        self.silence_counter = 0
        self.wake_detected = False
        self.conversation_mode = False
        self.command_timeout = 10
        self.conversation_timeout = 600
        self.command_start_time = 0

        # 音频回调缓冲
        self.audio_buffer = []

        # 事件总线
        self._bus = None

    # ───────── 事件总线集成 ─────────

    def on_register(self, bus):
        self._bus = bus

    # ───────── VAD 参数设置 ─────────

    def set_is_speaking_check(self, check_fn):
        """
        设置 barge-in 检查函数。
        P2.4 也在此初始化 VAD 参数（历史遗留）。
        """
        self.is_speaking_check = check_fn

        # VAD 参数（委托给 audio/recognizer.py 的参数层）
        self.vad.energy_threshold = 0.002
        self.vad.min_speech_blocks = 2
        self.vad.silence_blocks = 15

        # 录音状态重置
        self.recording = False
        self.recorded_frames = []
        self.speech_blocks = 0
        self.silence_counter = 0
        self.wake_detected = False
        self.conversation_mode = False
        self.command_timeout = 10
        self.conversation_timeout = 600
        self.command_start_time = 0
        self.audio_buffer = []

    # ───────── 音频回调 ─────────

    def _audio_callback(self, indata, frames, time_info, status):
        """sounddevice 音频回调"""
        if status:
            print(f"Audio status: {status}")
        self.audio_queue.put((indata.copy(),))

    # ───────── 音频处理循环 ─────────

    def _process_audio(self):
        """音频处理线程——VAD + 唤醒状态机"""
        print(f"  🎤 离线监听已启动")
        if self.has_voiceprint:
            print(f"  🔒 声纹已注册 — 只有你的声音能唤醒")
        else:
            print(f"  ⚠️ 未注册声纹")
        print(f"  🔊 VAD: {self.vad._vad_mode} | 命令超时: {self.command_timeout}秒")

        while self.is_running:
            try:
                indata, = self.audio_queue.get(timeout=0.5)
            except queue.Empty:
                if self.wake_detected:
                    self._check_command_timeout()
                continue

            if not self.is_listening:
                continue

            # VAD 检测（委托给 audio/recognizer.py）
            is_speech = self.vad.detect(indata.flatten())

            if is_speech:
                if not self.recording:
                    self.recording = True
                    self.recorded_frames = [indata.copy()]
                    self.speech_blocks = 1
                    self.silence_counter = 0
                else:
                    self.recorded_frames.append(indata.copy())
                    self.speech_blocks += 1
                    self.silence_counter = 0
            elif self.recording:
                self.recorded_frames.append(indata.copy())
                self.silence_counter += 1
                if self.silence_counter > self.vad.silence_blocks:
                    if self.speech_blocks >= self.vad.min_speech_blocks:
                        self._process_utterance()
                    self.recording = False
                    self.recorded_frames = []
                    self.speech_blocks = 0
            elif self.wake_detected:
                self._check_command_timeout()

    # ───────── 话语处理 ─────────

    def _process_utterance(self):
        """处理一段完整的语音"""
        if not self.recorded_frames:
            return

        audio_data, duration = frames_to_audio(self.recorded_frames, self.sample_rate)
        if duration < 0.3 or duration > 10:
            return

        # 语音真实性检测（委托给 audio/recognizer.py）
        if not SpeechValidator.is_actual_speech(audio_data, duration):
            return

        # 音量归一化（委托给 audio/recognizer.py）
        audio_norm = normalize_audio(audio_data)

        # Barge-in 检测
        is_speaking_now = self.is_speaking_check and self.is_speaking_check()
        if is_speaking_now and not self.wake_detected:
            print(f"  🔇 播放时检测到语音 —> Barge-in!")
            if self.on_speech_during_playback:
                self.on_speech_during_playback()
            self.wake_detected = True
            self.conversation_mode = True
            self.command_start_time = time.time()
            self._on_command_detected(audio_norm, duration)
            return

        if self.wake_detected:
            self._on_command_detected(audio_norm, duration)
            return

        # 声纹验证
        if self.has_voiceprint and self.voiceprint_gate:
            passed, sim, name = self.voiceprint_gate.verify(audio_norm)
            print(f"  🔊 检测到语音 ({duration:.1f}s) 声纹相似度: {sim:.3f}")
            if passed:
                print(f"  ✅ 声纹匹配! 相似度={sim:.3f}")
                self._trigger_wake(audio_norm)
                return
            else:
                if sim > 0.5:
                    print(f"  🔇 相似度 {sim:.3f}，低于阈值，忽略")
        else:
            print(f"  🔊 检测到语音 ({duration:.1f}s) - 声纹未注册，直接唤醒")
            self._trigger_wake(audio_norm)

    # ───────── 唤醒逻辑 ─────────

    def _trigger_wake(self, audio_data):
        """触发唤醒"""
        if self.wake_detected:
            return

        self.wake_detected = True
        self.conversation_mode = True
        self.command_start_time = time.time()
        print(f"\n🔥 唤醒! (持续对话模式)")
        print(f"  说「拜拜」结束对话 | {self.conversation_timeout}秒无话自动待机")

        if self._bus:
            self._bus.emit("voice.wake", text="主人", audio=audio_data)
        elif self.on_wake:
            self.on_wake("主人", audio_data)

        print(f"  🎤 请说话... ({self.command_timeout}秒静音自动待机)")

    def _check_command_timeout(self):
        """检查命令超时"""
        if not self.wake_detected:
            return
        elapsed = time.time() - self.command_start_time
        if self.conversation_mode:
            if elapsed > self.conversation_timeout:
                print(f"  ⏰ 对话超时 ({self.conversation_timeout//60}分钟无话)")
                self._reset_after_command()
        else:
            if elapsed > self.command_timeout:
                print(f"  ⏰ 命令超时 ({self.command_timeout}秒无话)")
                self._reset_after_command()

    def _on_command_detected(self, audio_data, duration):
        """检测到命令语音—尝试识别"""
        if not self.wake_detected:
            return

        print(f"  🎙️ 检测到语音 ({duration:.1f}s)")
        audio_norm = normalize_audio(audio_data)
        recognized_text = self._try_recognize(audio_norm)

        if recognized_text:
            print(f"  🗣️ \"{recognized_text}\"")
            if self._bus:
                self._bus.emit("voice.command", text=recognized_text)
            elif self.on_command:
                self.on_command(recognized_text)
        else:
            print(f"  🔇 未能识别文字")
            if self._bus:
                self._bus.emit("voice.command", text="")
            elif self.on_command:
                self.on_command("")

        self.recording = False
        self.recorded_frames = []
        self.speech_blocks = 0
        self.silence_counter = 0

        if self.wake_detected:
            self.command_start_time = time.time()
            print(f"  🎤 继续聆听...（说「拜拜」结束）")
        else:
            print(f"  💤 已结束对话")

    # ───────── 语音识别 ─────────

    def _try_recognize(self, audio_data):
        """尝试用多种方式识别语音，返回文字或 None"""
        # 1. sherpa-onnx 离线识别
        try:
            from sherpa_onnx.offline_recognizer import OfflineRecognizer
            import os as _os

            model_path = str(Path(__file__).resolve().parent.parent.parent / "models" / "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17")
            model_file = _os.path.join(model_path, "model.int8.onnx")
            tokens_file = _os.path.join(model_path, "tokens.txt")

            if _os.path.exists(model_file) and _os.path.exists(tokens_file):
                if not hasattr(self, "_sherpa_recognizer"):
                    print("  🧠 加载离线语音模型...")
                    self._sherpa_recognizer = OfflineRecognizer.from_sense_voice(
                        model=model_file, tokens=tokens_file,
                        num_threads=4, language="zh", use_itn=True,
                    )
                    print("  ✅ 离线语音模型就绪")

                stream = self._sherpa_recognizer.create_stream()
                stream.accept_waveform(self.sample_rate, audio_data.tolist())
                self._sherpa_recognizer.decode_stream(stream)
                text = stream.result.text.strip()
                if text and text not in ("", "嗯", "啊", "呃", "哦"):
                    return text
        except Exception as e:
            print(f"  ⚠️ 离线识别失败: {e}")

        # 2. Google STT（在线备用）
        try:
            import speech_recognition as sr
            audio_int16 = (audio_data * 32767).astype(np.int16)
            audio = sr.AudioData(audio_int16.tobytes(), self.sample_rate, 2)
            recognizer = sr.Recognizer()
            text = recognizer.recognize_google(audio, language="zh-CN")
            if text.strip():
                return text.strip()
        except Exception:
            pass

        return None

    # ───────── 生命周期 ─────────

    def _reset_after_command(self):
        """回到待机"""
        self.wake_detected = False
        self.conversation_mode = False
        self.recording = False
        self.recorded_frames = []
        self.speech_blocks = 0
        self.silence_counter = 0
        print("  💤 待机中")
        if self.on_state_change:
            self.on_state_change("idle")

    def end_conversation(self):
        """结束持续对话"""
        if self.conversation_mode:
            print(f"  👋 结束对话")
            self._reset_after_command()

    def start(self):
        """启动监听"""
        if self.is_running:
            return

        self.is_running = True
        self.is_listening = True

        self.stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=1,
            callback=self._audio_callback,
        )
        self.stream.start()

        self.process_thread = threading.Thread(target=self._process_audio, daemon=True)
        self.process_thread.start()

    def stop(self):
        """停止监听"""
        self.is_running = False
        self.is_listening = False
        if hasattr(self, "stream"):
            try:
                self.stream.stop()
                self.stream.close()
            except Exception:
                pass

    def set_on_state_change(self, callback):
        self.on_state_change = callback

    def reset_wake(self):
        self.wake_detected = False


# ==================== 独立测试 ====================

if __name__ == "__main__":
    print("=" * 50)
    print("  Friday 离线唤醒测试 (v3.0)")
    print("  你说话就会唤醒（声纹匹配时）")
    print("  按 Ctrl+C 退出")
    print("=" * 50)

    def on_wake(text, audio):
        print(f">>> 唤醒! 检测到语音")

    def on_command(text):
        print(f">>> 命令: {text}")

    gate = None
    if VoiceprintGate:
        gate = VoiceprintGate(threshold=0.70)
        if gate.check_enrolled():
            print(f"  声纹已注册: {gate.get_status_string()}")
        else:
            print(f"  声纹未注册—任何人说话都唤醒")
            gate = None

    listener = FridayListener(
        on_wake=on_wake,
        on_command=on_command,
        voiceprint_gate=gate,
    )

    try:
        listener.start()
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n停止")
        listener.stop()
