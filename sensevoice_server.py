#!/usr/bin/env python3
"""
Friday SenseVoice ASR Server
本地语音识别服务 - 使用 sherpa-onnx SenseVoice 模型
================================================================
支持：中文、英文、日语、韩语、粤语
运行端口：5000 (HTTP REST API)
"""

import os
import sys
import base64
import asyncio
import traceback
from aiohttp import web
import numpy as np
import re as _re

SAMPLE_RATE = 16000
DEFAULT_PORT = 5000

_HALLUCINATION_FRAGMENTS = [
    # 中文
    "字幕", "翻译", "感谢收看", "感谢观看", "谢谢收看", "谢谢观看",
    "请订阅", "请关注", "点赞", "订阅", "转发", "打赏",
    "作词", "作曲", "制作人", "出品", "版权", "未经许可",
    "欢迎收看", "欢迎大家收看", "大家好我是",
    # 日文
    "字幕", "翻訳", "ご視聴", "チャンネル登録", "高評価",
    # 韩文
    "자막", "번역", "시청", "구독", "좋아요",
    # 英文
    "subtitles by", "thank you for watching", "please subscribe",
    "amara.org", "translated by", "music:", "\u266a", "\u266b",
]

def is_hallucination(text: str) -> bool:
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
    if _re.match(r'^[\d\s:.,\u3000\uff0c\u3002\uff01\uff1f\u2026]+$', t):
        return True
    segs = [s.strip() for s in _re.split(r'[,,\u3000\uff0c\u3002\uff01\uff1f\u2026\s]+', t) if s.strip()]
    if len(segs) >= 4 and len(set(segs)) <= 2:
        return True
    return False


class SenseVoiceServer:
    def __init__(self, model_dir: str = None, port: int = DEFAULT_PORT, num_threads: int = 4):
        self.port = port
        self.num_threads = num_threads
        self.recognizer = None
        self.model_ready = False
        
        # 查找模型 - 优先使用 local_models 目录
        if model_dir is None:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            local_models_dir = os.path.join(script_dir, "local_models")
            model_dir = os.path.join(local_models_dir, 
                                     "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17")
        
        self.model_file = os.path.join(model_dir, "model.int8.onnx")
        self.tokens_file = os.path.join(model_dir, "tokens.txt")
        
        print(f"[SenseVoice] 模型目录: {model_dir}", flush=True)
        print(f"[SenseVoice] 模型文件: {self.model_file}", flush=True)
        print(f"[SenseVoice] Tokens文件: {self.tokens_file}", flush=True)
        
        self.load_model()

    def load_model(self):
        """加载 sherpa-onnx SenseVoice 模型"""
        if not os.path.exists(self.model_file):
            print(f"[SenseVoice] ❌ 找不到模型文件: {self.model_file}", flush=True)
            print(f"[SenseVoice] 请下载模型到上述目录", flush=True)
            return False
            
        if not os.path.exists(self.tokens_file):
            print(f"[SenseVoice] ❌ 找不到 tokens 文件: {self.tokens_file}", flush=True)
            return False
        
        print(f"[SenseVoice] 正在加载 SenseVoice 模型...", flush=True)
        print(f"[SenseVoice] 模型大小: {os.path.getsize(self.model_file)/1024/1024:.1f} MB", flush=True)
        print(f"[SenseVoice] 线程数: {self.num_threads}", flush=True)
        
        try:
            from sherpa_onnx.offline_recognizer import OfflineRecognizer
            
            self.recognizer = OfflineRecognizer.from_sense_voice(
                model=self.model_file,
                tokens=self.tokens_file,
                num_threads=self.num_threads,
                language="zh",
                use_itn=True,
            )
            
            self.model_ready = True
            print(f"[SenseVoice] ✅ SenseVoice 模型加载完成!", flush=True)
            return True
            
        except ImportError as e:
            print(f"[SenseVoice] ❌ 缺少必要的包: {e}", flush=True)
            print(f"[SenseVoice] 请运行: pip install sherpa-onnx aiohttp", flush=True)
            return False
        except Exception as e:
            print(f"[SenseVoice] ❌ 模型加载失败: {e}", flush=True)
            traceback.print_exc()
            return False

    def detect_language(self, text: str) -> str:
        """从文本内容判断语言"""
        if not text:
            return "zh"
        if _re.search(r'[\u4e00-\u9fff\u3400-\u4dbf]', text):
            return "zh"
        if _re.search(r'[\u3040-\u309f\u30a0-\u30ff]', text):
            return "ja"
        if _re.search(r'[\uac00-\ud7af]', text):
            return "ko"
        if _re.search(r'[a-zA-Z]{2,}', text):
            return "en"
        return "zh"

    def transcribe(self, audio_base64: str, lang: str = "zh") -> dict:
        """
        对 base64 编码的 PCM 音频进行识别
        """
        if not self.model_ready:
            return {"success": False, "error": "模型未加载", "text": ""}
        
        try:
            # 解码 base64
            audio_bytes = base64.b64decode(audio_base64)
            audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
            
            if len(audio_int16) < SAMPLE_RATE // 10:  # 少于 0.1 秒
                return {"success": False, "error": "音频太短", "text": ""}
            
            # 转为 float32 [-1, 1]
            audio_f32 = audio_int16.astype(np.float32) / 32768.0
            
            # 识别
            stream = self.recognizer.create_stream()
            stream.accept_waveform(SAMPLE_RATE, audio_f32)
            self.recognizer.decode_stream(stream)
            text = (stream.result.text or "").strip()
            
            if not text:
                return {"success": True, "text": "", "lang": lang}
            
            if is_hallucination(text):
                print(f"[SenseVoice] 过滤幻觉输出: {repr(text[:80])}", flush=True)
                return {"success": True, "text": "", "lang": lang, "filtered": True}
            
            detected_lang = self.detect_language(text)
            print(f"[SenseVoice] 识别结果: {text} (语言: {detected_lang})", flush=True)
            
            return {
                "success": True,
                "text": text,
                "lang": detected_lang,
                "confidence": 0.9
            }
            
        except Exception as e:
            print(f"[SenseVoice] 识别错误: {e}", flush=True)
            traceback.print_exc()
            return {"success": False, "error": str(e), "text": ""}


# 全局服务器实例
server = None


async def handle_transcribe(request):
    """处理语音识别请求"""
    try:
        body = await request.json()
        audio = body.get('audio', '')
        lang = body.get('lang', 'zh')
        
        if not audio:
            return web.json_response({
                "success": False,
                "error": "缺少 audio 参数"
            })
        
        result = server.transcribe(audio, lang)
        return web.json_response(result)
        
    except Exception as e:
        print(f"[SenseVoice] 请求处理错误: {e}", flush=True)
        return web.json_response({
            "success": False,
            "error": str(e)
        }, status=500)


async def handle_status(request):
    """返回服务状态"""
    return web.json_response({
        "ready": server.model_ready if server else False,
        "engine": "sherpa-onnx SenseVoice",
        "model": "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17"
    })


async def handle_health(request):
    """健康检查"""
    return web.json_response({"status": "ok"})


def create_app():
    """创建 aiohttp 应用"""
    app = web.Application()
    app.router.add_post('/api/asr/transcribe', handle_transcribe)
    app.router.add_get('/api/asr/status', handle_status)
    app.router.add_get('/health', handle_health)
    return app


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Friday SenseVoice ASR Server")
    parser.add_argument("--model-dir", 
                        default=None,
                        help="模型目录")
    parser.add_argument("--port", type=int, default=5000, help="服务端口")
    parser.add_argument("--threads", type=int, default=4, help="推理线程数")
    args = parser.parse_args()
    
    global server
    server = SenseVoiceServer(
        model_dir=args.model_dir,
        port=args.port,
        num_threads=args.threads
    )
    
    if not server.model_ready:
        print("[SenseVoice] ⚠️  模型未加载，服务将以有限功能运行", flush=True)
        print("[SenseVoice]  Web Speech API 将作为备选方案", flush=True)
    
    app = create_app()
    print(f"[SenseVoice] 🚀 服务启动: http://127.0.0.1:{args.port}", flush=True)
    print(f"[SenseVoice] 端点:", flush=True)
    print(f"[SenseVoice]   POST /api/asr/transcribe - 语音识别", flush=True)
    print(f"[SenseVoice]   GET  /api/asr/status     - 服务状态", flush=True)
    print(f"[SenseVoice]   GET  /health              - 健康检查", flush=True)
    print("", flush=True)
    
    web.run_app(app, host='127.0.0.1', port=args.port,
                print=None, access_log=None)


if __name__ == "__main__":
    main()
