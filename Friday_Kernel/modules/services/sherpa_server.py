#!/usr/bin/env python3
"""
Friday Sherpa Server — 本地语音识别服务 (sherpa-onnx SenseVoice)
================================================================
替代 Whisper 服务，使用 sherpa-onnx SenseVoice 模型。
- 流式 ASR：VAD + 停顿触发识别
- 幻觉过滤
- WebSocket 服务：兼容原有协议 (ws://127.0.0.1:3723)

模型：sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17

作者：Friday Kernel
版本：1.0.0
"""

import asyncio
import json
import sys
import os
import argparse
import re as _re
import threading
from concurrent.futures import ThreadPoolExecutor

import numpy as np

try:
    import websockets
except ImportError:
    print("[语音] 缺少 websockets 包，请运行: pip install websockets", flush=True)
    sys.exit(1)

try:
    from sherpa_onnx.offline_recognizer import OfflineRecognizer
except ImportError:
    print("[语音] 缺少 sherpa-onnx，请运行: pip install sherpa-onnx", flush=True)
    sys.exit(1)

SAMPLE_RATE = 16000

# ── VAD 阈值 ──
SILENCE_RMS_THRESHOLD = 0.005
NEAR_SPEECH_RMS_THRESHOLD = 0.010
MIN_UTTERANCE_PEAK_RMS = 0.015
MIN_UTTERANCE_VOICED_CHUNKS = 1

# ── SenseVoice 幻觉/垃圾输出过滤 ──
_HALLUCINATION_FRAGMENTS = [
    # 中文
    "字幕", "翻译", "感谢收看", "感谢观看", "谢谢收看", "谢谢观看",
    "请订阅", "请关注", "点赞", "订阅", "转发", "打赏",
    "作词", "作曲", "制作人", "出品", "版权", "未经许可",
    "欢迎收看", "欢迎大家收看", "大家好我是",
    # 日文 (sense-voice 支持日语)
    "字幕", "翻訳", "ご視聴", "チャンネル登録", "高評価",
    # 韩文
    "자막", "번역", "시청", "구독", "좋아요",
    # 英文
    "subtitles by", "thank you for watching", "please subscribe",
    "amara.org", "translated by", "music:", "\u266a", "\u266b",
]

def is_hallucination(text: str) -> bool:
    """检测常见幻觉/垃圾输出"""
    if not text:
        return True
    t = text.strip()
    if not t:
        return True
    if _re.match(r'^[\s\W]+$', t):
        return True
    if len(t) <= 1:
        return True
    tl = t.lower()
    for frag in _HALLUCINATION_FRAGMENTS:
        if frag.lower() in tl:
            return True
    # 纯数字/时间
    if _re.match(r'^[\d\s:.,\u3000\uff0c\u3002\uff01\uff1f\u2026]+$', t):
        return True
    # 短重复片段
    segs = [s.strip() for s in _re.split(r'[,,\u3000\uff0c\u3002\uff01\uff1f\u2026\s]+', t) if s.strip()]
    if len(segs) >= 4 and len(set(segs)) <= 2:
        return True
    return False


SILENCE_CHUNKS_TO_FLUSH = 8
CHUNK_SAMPLES = SAMPLE_RATE // 4
MAX_BUFFER_SECONDS = 25


class SherpaServer:
    """sherpa-onnx SenseVoice 语音识别 WebSocket 服务"""

    def __init__(self, host="127.0.0.1", port=3723,
                 model_path=None, num_threads=4):
        self.host = host
        self.port = port
        self.num_threads = num_threads
        self._executor = ThreadPoolExecutor(max_workers=2)

        # 模型路径
        if model_path is None:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.normpath(
                os.path.join(script_dir, "..", "..", "models",
                             "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17")
            )
        self.model_path = model_path
        self.model_file = os.path.join(model_path, "model.int8.onnx")
        self.tokens_file = os.path.join(model_path, "tokens.txt")

        # 识别器
        self.recognizer = None

    def load_model(self):
        """加载 sherpa-onnx SenseVoice 模型"""
        if self.recognizer is not None:
            print("[语音] 模型已加载", flush=True)
            return

        if not os.path.exists(self.model_file):
            print(f"[语音] 错误: 找不到模型文件: {self.model_file}", flush=True)
            sys.exit(1)
        if not os.path.exists(self.tokens_file):
            print(f"[语音] 错误: 找不到 tokens 文件: {self.tokens_file}", flush=True)
            sys.exit(1)

        print(f"[语音] 加载 SenseVoice 模型...", flush=True)
        print(f"      模型: {self.model_file}", flush=True)
        print(f"      大小: {os.path.getsize(self.model_file)/1024/1024:.1f} MB", flush=True)
        print(f"      线程: {self.num_threads}", flush=True)

        self.recognizer = OfflineRecognizer.from_sense_voice(
            model=self.model_file,
            tokens=self.tokens_file,
            num_threads=self.num_threads,
            language="zh",
            use_itn=True,
        )
        print(f"[语音] SenseVoice 模型加载完成", flush=True)

    def _detect_language(self, text: str) -> str:
        """从文本内容判断语言"""
        if not text:
            return "zh"
        # 检查是否包含 CJK 字符
        if _re.search(r'[\u4e00-\u9fff\u3400-\u4dbf]', text):
            return "zh"
        if _re.search(r'[\u3040-\u309f\u30a0-\u30ff]', text):
            return "ja"
        if _re.search(r'[\uac00-\ud7af]', text):
            return "ko"
        if _re.search(r'[a-zA-Z]{2,}', text):
            return "en"
        return "zh"

    def _run_transcribe(self, audio_int16: np.ndarray) -> str:
        """
        对 PCM int16 音频运行识别。
        返回识别文本（空字符串表示无有效识别结果）。
        """
        if self.recognizer is None:
            return ""

        try:
            # 转为 float32 [-1, 1]
            audio_f32 = audio_int16.astype(np.float32) / 32768.0

            stream = self.recognizer.create_stream()
            stream.accept_waveform(SAMPLE_RATE, audio_f32)
            self.recognizer.decode_stream(stream)
            text = (stream.result.text or "").strip()

            if not text:
                return ""

            if is_hallucination(text):
                print(f"[语音] 过滤幻觉输出: {repr(text[:80])}", flush=True)
                return ""

            return text

        except Exception as e:
            print(f"[语音] 识别错误: {e}", flush=True)
            return ""

    async def transcribe_async(self, audio_int16: np.ndarray) -> str:
        """异步执行识别"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, self._run_transcribe, audio_int16)

    async def handle(self, websocket):
        """处理 WebSocket 连接"""
        print("[语音] 客户端已连接", flush=True)

        buf = np.array([], dtype=np.int16)
        silence_count = 0
        voiced_chunks = 0
        utterance_peak_rms = 0.0
        lang = "zh"

        try:
            async for raw in websocket:
                # ── 处理 JSON 控制消息 ──
                if isinstance(raw, str):
                    try:
                        msg = json.loads(raw)
                        if msg.get("type") == "config":
                            lang = msg.get("lang", "zh") or "zh"
                            # SenseVoice 原生支持多语言，不需要切换
                            await websocket.send(json.dumps({
                                "type": "config_ok", "lang": lang
                            }))
                        elif msg.get("type") == "flush":
                            # 手动触发识别当前缓冲区
                            if (len(buf) > SAMPLE_RATE // 4 and
                                voiced_chunks >= MIN_UTTERANCE_VOICED_CHUNKS and
                                utterance_peak_rms >= MIN_UTTERANCE_PEAK_RMS):
                                text = await self.transcribe_async(buf)
                                if text:
                                    await websocket.send(json.dumps({
                                        "type": "transcript", "text": text,
                                        "is_final": True,
                                        "lang": self._detect_language(text)
                                    }))
                            buf = np.array([], dtype=np.int16)
                            silence_count = 0
                            voiced_chunks = 0
                            utterance_peak_rms = 0.0
                    except json.JSONDecodeError:
                        pass
                    continue

                # ── 处理二进制音频数据 (PCM int16) ──
                if not isinstance(raw, (bytes, bytearray)):
                    continue

                chunk = np.frombuffer(raw, dtype=np.int16)
                if len(chunk) == 0:
                    continue

                # 计算 RMS 音量
                rms = float(np.sqrt(np.mean(chunk.astype(np.float32) ** 2))) / 32768.0
                is_near_speech = rms >= NEAR_SPEECH_RMS_THRESHOLD
                is_silent = rms < SILENCE_RMS_THRESHOLD

                if not is_silent:
                    buf = np.append(buf, chunk)
                    silence_count = 0
                    if is_near_speech:
                        voiced_chunks += 1
                    else:
                        voiced_chunks = max(voiced_chunks, 1)
                    utterance_peak_rms = max(utterance_peak_rms, rms)
                elif len(buf) > 0:
                    # 静音但缓冲区有内容
                    buf = np.append(buf, chunk)
                    silence_count += 1
                # else: 完全静音且缓冲区为空，丢弃

                # ── 检查是否需要触发识别 ──
                buf_seconds = len(buf) / SAMPLE_RATE
                should_flush_speech = (silence_count >= SILENCE_CHUNKS_TO_FLUSH and
                                       buf_seconds > 0.3)
                should_flush_max = buf_seconds >= MAX_BUFFER_SECONDS

                if should_flush_speech or should_flush_max:
                    if (len(buf) > SAMPLE_RATE // 8 and
                        voiced_chunks >= MIN_UTTERANCE_VOICED_CHUNKS and
                        utterance_peak_rms >= MIN_UTTERANCE_PEAK_RMS):
                        text = await self.transcribe_async(buf)
                        if text:
                            await websocket.send(json.dumps({
                                "type": "transcript", "text": text,
                                "is_final": True,
                                "lang": self._detect_language(text)
                            }))
                    # 清空缓冲区
                    buf = np.array([], dtype=np.int16)
                    silence_count = 0
                    voiced_chunks = 0
                    utterance_peak_rms = 0.0

        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            print(f"[语音] 连接异常: {e}", flush=True)

        print("[语音] 客户端已断开", flush=True)

    async def run(self):
        """启动 WebSocket 服务"""
        self.load_model()
        print(f"[语音] SenseVoice 服务启动: ws://{self.host}:{self.port}", flush=True)
        print(f"      模型: sherpa-onnx-sense-voice-zh-en-ja-ko-yue", flush=True)
        async with websockets.serve(self.handle, self.host, self.port):
            await asyncio.Future()


def main():
    parser = argparse.ArgumentParser(description="Friday 语音识别服务 (sherpa-onnx)")
    parser.add_argument("--model-path", default=None,
                        help="SenseVoice 模型路径（默认自动查找）")
    parser.add_argument("--port", type=int, default=3723,
                        help="WebSocket 端口（默认 3723）")
    parser.add_argument("--host", default="127.0.0.1",
                        help="监听地址")
    parser.add_argument("--threads", type=int, default=4,
                        help="推理线程数（默认 4）")
    args = parser.parse_args()

    server = SherpaServer(
        host=args.host,
        port=args.port,
        model_path=args.model_path,
        num_threads=args.threads,
    )
    asyncio.run(server.run())


if __name__ == "__main__":
    main()
