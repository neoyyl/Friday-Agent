#!/usr/bin/env python3
"""Quick smoke test for voice chat pipeline"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "modules"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from friday_voice_chat import VoiceChat, create_llm_backend

print("=== Voice Chat Smoke Test ===\n")

# 1. Create mock LLM backend
class MockLLM:
    def chat(self, msgs):
        return "你好！我是 Friday，你的语音助手。"

llm = MockLLM()
print("[OK] LLM backend (mock)")

# 2. Create VoiceChat
chat = VoiceChat(llm_backend=llm, port=3729)
print("[OK] VoiceChat created")

# 3. Init ASR
if chat._init_asr():
    print("[OK] ASR init (sherpa-onnx)")
else:
    print("[FAIL] ASR init failed")
    sys.exit(1)

# 4. Test think
response = chat.think("你好，今天天气怎么样？")
print(f"[OK] think() -> \"{response[:50]}...\"")
assert len(response) > 0, "Empty response"

# 5. Test speak
chat.speak("测试语音输出")
print("[OK] speak()")

# 6. Cleanup
chat.cleanup()
print("[OK] cleanup")

print("\n=== All tests passed! ===")
print("Run the real thing with:")
print("  python scripts/friday_voice_chat.py --llm ollama")
print("  python scripts/friday_voice_chat.py --llm deepseek --api-key sk-xxx")
