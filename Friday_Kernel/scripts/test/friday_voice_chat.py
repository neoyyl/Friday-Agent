#!/usr/bin/env python3
"""
Friday Voice Chat — 交互式语音对话主循环
==========================================
听 (sherpa-onnx SenseVoice) → 想 (LLM) → 说 (edge-tts) → 循环

架构:
  ┌─────────────────────────────────────────────────┐
  │             Voice Chat Loop                     │
  ├─────────────────────────────────────────────────┤
  │   ┌─────────┐   ┌──────┐   ┌──────────┐        │
  │   │ Listen  │──▶│ Think│──▶│  Speak   │──┐     │
  │   │ (ASR)   │   │ (LLM)│   │ (TTS)    │  │     │
  │   └─────────┘   └──────┘   └──────────┘  │     │
  │       ▲                                  │     │
  │       └──────────────────────────────────┘     │
  └─────────────────────────────────────────────────┘

LLM 后端支持:
  1. DeepSeek API (默认)
  2. OpenAI API
  3. Ollama (本地)

用法:
  python scripts/friday_voice_chat.py
  python scripts/friday_voice_chat.py --llm deepseek --api-key sk-xxx
  python scripts/friday_voice_chat.py --llm ollama

作者：Friday Kernel
版本：1.0.0
"""

import sys
import os
import json
import time
import argparse
import threading
from pathlib import Path
from typing import Optional, Callable

# 添加模块路径
sys.path.insert(0, str(Path(__file__).parent.parent / "modules"))


# ========================================================================
# LLM 后端抽象层
# ========================================================================

class LLMBackend:
    """LLM 后端基类"""

    def __init__(self, config: dict):
        self.config = config
        self.system_prompt = config.get("system_prompt", "你叫 Friday，是一个智能语音助手。请用中文回复，简洁明了，不要使用 emoji。")

    def chat(self, messages: list) -> str:
        """发送对话历史，返回 LLM 回复文本"""
        raise NotImplementedError


class DeepSeekBackend(LLMBackend):
    """DeepSeek API"""

    def __init__(self, config: dict):
        super().__init__(config)
        self.api_key = config.get("api_key", os.getenv("DEEPSEEK_API_KEY", ""))
        self.model = config.get("model", "deepseek-chat")
        self.base_url = config.get("base_url", "https://api.deepseek.com")

    def chat(self, messages: list) -> str:
        if not self.api_key:
            return "[配置错误] 未设置 DEEPSEEK_API_KEY。请设置环境变量或通过 --api-key 传入。"

        try:
            import urllib.request
            import urllib.error

            # 构建请求
            url = f"{self.base_url}/v1/chat/completions"
            payload = json.dumps({
                "model": self.model,
                "messages": [{"role": "system", "content": self.system_prompt}] + messages,
                "stream": False,
                "temperature": 0.7,
                "max_tokens": 1024,
            }).encode("utf-8")

            req = urllib.request.Request(
                url, data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}",
                },
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return result["choices"][0]["message"]["content"].strip()

        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            return f"[API 错误 {e.code}] {body[:200]}"
        except Exception as e:
            return f"[请求失败] {e}"


class OpenAIBackend(LLMBackend):
    """OpenAI 兼容 API"""

    def __init__(self, config: dict):
        super().__init__(config)
        self.api_key = config.get("api_key", os.getenv("OPENAI_API_KEY", ""))
        self.model = config.get("model", "gpt-4o-mini")
        self.base_url = config.get("base_url", "https://api.openai.com")

    def chat(self, messages: list) -> str:
        if not self.api_key:
            return "[配置错误] 未设置 OPENAI_API_KEY。"

        try:
            import urllib.request
            import urllib.error

            url = f"{self.base_url}/v1/chat/completions"
            payload = json.dumps({
                "model": self.model,
                "messages": [{"role": "system", "content": self.system_prompt}] + messages,
                "stream": False,
                "temperature": 0.7,
                "max_tokens": 1024,
            }).encode("utf-8")

            req = urllib.request.Request(
                url, data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}",
                },
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return result["choices"][0]["message"]["content"].strip()

        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            return f"[API 错误 {e.code}] {body[:200]}"
        except Exception as e:
            return f"[请求失败] {e}"


class OllamaBackend(LLMBackend):
    """Ollama 本地模型"""

    def __init__(self, config: dict):
        super().__init__(config)
        self.model = config.get("model", "qwen2.5:7b")
        self.base_url = config.get("base_url", os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434"))

    def chat(self, messages: list) -> str:
        try:
            import urllib.request
            import urllib.error

            url = f"{self.base_url}/api/chat"
            payload = json.dumps({
                "model": self.model,
                "messages": [{"role": "system", "content": self.system_prompt}] + messages,
                "stream": False,
                "options": {"temperature": 0.7},
            }).encode("utf-8")

            req = urllib.request.Request(
                url, data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=60) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return result["message"]["content"].strip()

        except urllib.error.HTTPError as e:
            return f"[Ollama 错误 {e.code}] 请确认 Ollama 正在运行 (ollama serve)"
        except ConnectionRefusedError:
            return "[Ollama 未启动] 请运行 'ollama serve' 启动本地模型"
        except Exception as e:
            return f"[请求失败] {e}"


def create_llm_backend(provider: str, config: dict) -> LLMBackend:
    """创建 LLM 后端实例"""
    providers = {
        "deepseek": DeepSeekBackend,
        "openai": OpenAIBackend,
        "ollama": OllamaBackend,
    }
    cls = providers.get(provider)
    if not cls:
        available = ", ".join(providers.keys())
        raise ValueError(f"不支持的 LLM 后端: {provider}。可选: {available}")
    return cls(config)


# ========================================================================
# 语音对话主循环
# ========================================================================

class VoiceChat:
    """交互式语音对话主循环"""

    def __init__(self, llm_backend: LLMBackend,
                 wake_word: str = "",
                 port: int = 3723,
                 enable_bargein: bool = True):
        """
        初始化语音对话

        参数:
            llm_backend: LLM 后端实例
            wake_word: 唤醒词（空 = 持续监听模式）
            port: 本地识别服务端口
            enable_bargein: 是否启用打断
        """
        self.llm = llm_backend
        self.wake_word = wake_word.lower() if wake_word else ""
        self.port = port
        self.enable_bargein = enable_bargein

        # 状态
        self.running = False
        self.conversation_history = []
        self.max_history = 20  # 保留最近 20 轮对话

        # TTS 引擎
        self.tts_engine = None
        self._init_tts()

        # 语音管理器
        self.voice_manager = None

    def _init_tts(self):
        """初始化 TTS 引擎"""
        try:
            sys.path.insert(0, str(Path(__file__).parent.parent / "modules"))
            from friday_voice import FridayVoiceEngine
            self.tts_engine = FridayVoiceEngine()
            print("[TTS] edge-tts 就绪")
        except Exception as e:
            print(f"[TTS] 初始化失败: {e}")
            print("[TTS] 将使用文字输出代替语音")

    def _init_asr(self):
        """初始化语音识别"""
        try:
            from voice_manager import FridayVoiceManager, ASRMode, VoiceState
            self.voice_manager = FridayVoiceManager({
                'asr_mode': ASRMode.LOCAL,
                'sherpa_port': self.port,
                'enable_bargein': self.enable_bargein,
                'enable_duck': True,
            })

            # 设置回调
            self.voice_manager.set_callbacks(
                on_transcript=self._on_transcript,
                on_state_change=self._on_state_change,
                on_error=self._on_error,
                on_bargein=self._on_bargein,
            )

            # 启动本地服务
            print(f"[ASR] 启动 sherpa-onnx SenseVoice (端口 {self.port})...")
            if not self.voice_manager.start_local_server():
                print("[ASR] 启动失败！")
                return False

            print("[ASR] 就绪")
            return True

        except Exception as e:
            print(f"[ASR] 初始化失败: {e}")
            return False

    def _on_transcript(self, text: str, is_final: bool):
        """ASR 识别结果回调"""
        if is_final and text.strip():
            print(f"\n[你] {text}")
            # 将识别结果放入队列由主循环处理
            if hasattr(self, '_text_queue'):
                self._text_queue.append(text.strip())

    def _on_state_change(self, state):
        """ASR 状态变化回调"""
        # 状态名: idle, listening, recognizing, speaking, error, ducking
        pass  # 静默处理

    def _on_error(self, error: str):
        """ASR 错误回调"""
        print(f"\n[ASR 错误] {error}")

    def _on_bargein(self):
        """打断回调"""
        print("\n[打断] 检测到语音，打断 TTS")
        if self.tts_engine:
            self.tts_engine.stop_speaking()

    def speak(self, text: str):
        """说话（TTS 或文字输出）"""
        if not text:
            return

        print(f"\n[Friday] {text}")

        if self.tts_engine:
            if self.voice_manager:
                self.voice_manager.start_tts_playback()
            self.tts_engine.speak(text, wait=True)
            if self.voice_manager:
                self.voice_manager.stop_tts_playback()

    def think(self, user_text: str) -> str:
        """思考并生成回复"""
        print(f"[思考] 正在处理...", end="", flush=True)

        # 维护对话历史
        self.conversation_history.append({"role": "user", "content": user_text})

        # 调用 LLM
        result = self.llm.chat(self.conversation_history[-self.max_history:])

        # 保存助手回复到历史
        self.conversation_history.append({"role": "assistant", "content": result})

        print(f"\r[思考] 完成    ")
        return result

    def run(self, continuous: bool = False):
        """
        运行语音对话

        参数:
            continuous: 如果为 True，持续监听并对话（不需要唤醒词）
        """
        # 初始化 ASR
        if not self._init_asr():
            print("[错误] 语音识别初始化失败，无法启动对话")
            return

        # 文本队列（ASR 回调与主循环之间传递数据）
        self._text_queue = []

        # 打印欢迎信息
        self._print_welcome()

        # 开始监听
        self.running = True
        self.voice_manager.start_listening()
        self.voice_manager.set_state("idle")

        try:
            if continuous:
                self._run_continuous_mode()
            else:
                self._run_wake_word_mode()
        except KeyboardInterrupt:
            print("\n\n[退出] 用户中断")
        finally:
            self.cleanup()

    def _run_continuous_mode(self):
        """持续监听模式：一有语音就自动对话"""
        print("[模式] 持续监听 —— 停顿后自动识别回答")
        print("[提示] 按 Ctrl+C 退出\n")

        last_text = ""
        idle_count = 0

        while self.running:
            # 检测是否有新的识别文本
            if self._text_queue:
                text = self._text_queue.pop(0)

                # 跳过重复文本（ASR 有时会返回相同结果多次）
                if text == last_text:
                    continue
                last_text = text

                # 检查退出命令
                if text in ("退出", "再见", "拜拜", "结束", "关闭"):
                    self.speak("好的，再见！")
                    break

                # 生成回复
                response = self.think(text)
                self.speak(response)

                # 清空可能累积的重复文本
                self._text_queue.clear()
                last_text = ""
                idle_count = 0

            else:
                time.sleep(0.1)
                idle_count += 1

                # 每 30 秒输出状态提示
                if idle_count % 300 == 0:
                    print(f"[待命] 正在倾听... (按 Ctrl+C 退出)", end="\r", flush=True)

    def _run_wake_word_mode(self):
        """唤醒词模式：说唤醒词后再对话"""
        wake = self.wake_word or "friday"
        print(f"[模式] 唤醒词 \"{wake}\" —— 先说唤醒词再说话")
        print(f"[提示] 说 \"{wake} 退出\" 结束对话\n")

        awakened = False
        last_text = ""

        while self.running:
            if self._text_queue:
                text = self._text_queue.pop(0)

                # 跳过重复文本
                if text == last_text:
                    continue
                last_text = text

                text_lower = text.lower()

                # 检查唤醒词
                if not awakened:
                    if wake in text_lower:
                        awakened = True
                        # 去掉唤醒词部分
                        rest = text[text_lower.index(wake) + len(wake):].strip()
                        if rest:
                            text = rest
                        else:
                            self.speak("我在，请说")
                            continue
                    else:
                        continue

                # 检查退出命令
                if any(w in text for w in ["退出", "再见", "拜拜", "结束", "关闭"]):
                    self.speak("好的，再见！")
                    break

                # 生成回复
                response = self.think(text)
                self.speak(response)

                # 回到待唤醒状态
                awakened = False
                self._text_queue.clear()
                last_text = ""

            else:
                time.sleep(0.1)

    def _print_welcome(self):
        """打印欢迎信息"""
        print()
        print("=" * 55)
        print("  Friday 语音对话")
        print("=" * 55)
        print(f"  LLM 后端: {self.llm.__class__.__name__}")
        print(f"  ASR:      sherpa-onnx SenseVoice (port {self.port})")
        print(f"  TTS:      edge-tts")
        print("=" * 55)
        print()

    def cleanup(self):
        """清理资源"""
        self.running = False

        if self.voice_manager:
            self.voice_manager.stop_listening()
            self.voice_manager.stop_local_server()

        print("[清理] 资源已释放")
        print("\n再见！")


# ========================================================================
# 命令行入口
# ========================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Friday 语音对话 — 听 (sherpa-onnx) -> 想 (LLM) -> 说 (edge-tts)"
    )
    parser.add_argument("--llm", choices=["deepseek", "openai", "ollama"],
                        default="deepseek",
                        help="LLM 后端 (默认: deepseek)")
    parser.add_argument("--api-key", default="",
                        help="API Key (默认使用环境变量)")
    parser.add_argument("--model", default="",
                        help="LLM 模型名 (默认按后端自动选择)")
    parser.add_argument("--base-url", default="",
                        help="API 地址 (默认按后端自动选择)")
    parser.add_argument("--wake-word", default="",
                        help="唤醒词 (默认: 持续监听模式)")
    parser.add_argument("--continuous", action="store_true", default=True,
                        help="持续监听模式 (默认开启)")
    parser.add_argument("--wake", action="store_true",
                        help="启用唤醒词模式 (默认关闭)")
    parser.add_argument("--port", type=int, default=3723,
                        help="本地识别服务端口 (默认 3723)")
    parser.add_argument("--no-bargein", action="store_true",
                        help="禁用打断功能")
    parser.add_argument("--system-prompt", default="",
                        help="系统提示词")
    args = parser.parse_args()

    # 构建 LLM 配置
    llm_config = {
        "system_prompt": args.system_prompt or "你叫 Friday，是一个智能语音助手。请用中文回复，简洁明了，控制在 100 字以内。不要使用 emoji，不要使用颜文字。",
    }
    if args.api_key:
        llm_config["api_key"] = args.api_key
    if args.model:
        llm_config["model"] = args.model
    if args.base_url:
        llm_config["base_url"] = args.base_url

    # 创建 LLM 后端
    try:
        llm = create_llm_backend(args.llm, llm_config)
    except ValueError as e:
        print(f"[错误] {e}")
        sys.exit(1)

    # 创建语音对话
    chat = VoiceChat(
        llm_backend=llm,
        wake_word=args.wake_word or ("friday" if args.wake else ""),
        port=args.port,
        enable_bargein=not args.no_bargein,
    )

    # 运行
    use_continuous = args.continuous and not args.wake
    chat.run(continuous=use_continuous)


if __name__ == "__main__":
    main()
