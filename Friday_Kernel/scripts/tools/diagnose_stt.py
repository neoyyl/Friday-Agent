#!/usr/bin/env python3
"""诊断：测试 sherpa-onnx 对人声的识别效果"""
import sys, os
from pathlib import Path
_kb = str(Path(__file__).resolve().parent.parent)
sys.path.insert(0, os.path.join(_kb, "modules"))

import sounddevice as sd
import numpy as np
from sherpa_onnx.offline_recognizer import OfflineRecognizer

# 加载模型
model_path = os.path.join(_kb, "models", "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17")
model_file = os.path.join(model_path, "model.int8.onnx")
tokens_file = os.path.join(model_path, "tokens.txt")

print("加载离线语音模型...")
recognizer = OfflineRecognizer.from_sense_voice(
    model=model_file, tokens=tokens_file,
    num_threads=4, language="zh", use_itn=True,
)
print("模型就绪")

# 录制
duration = 3  # 秒
sr = 16000
print(f"\n请在 {duration} 秒内说话（随便说什么都行）...")
for i in range(duration, 0, -1):
    print(f"  {i}...")
    sd.sleep(1000)

audio = sd.rec(int(duration * sr), samplerate=sr, channels=1, dtype="float32")
sd.wait()
audio = audio.flatten()

# 音量检测
volume = np.abs(audio).mean()
print(f"\n录制完成: {len(audio)} samples, 音量={volume:.5f}")
if volume < 0.005:
    print("⚠️ 音量过低，可能没录到声音")

# ===== 测试 1：直接 float32 输入 =====
print("\n--- 测试 1: float32 直接输入 ---")
audio_int16 = (audio * 32767).astype(np.int16)
stream = recognizer.create_stream()
stream.accept_waveform(sr, audio_int16.tolist())
recognizer.decode_stream(stream)
result1 = stream.result.text
print(f'识别结果: "{result1}"')

# ===== 测试 2：int16 输入（经过归一化） =====
print("\n--- 测试 2: int16 归一化输入 ---")
max_val = np.max(np.abs(audio))
if max_val > 0:
    audio_norm = audio / max_val
else:
    audio_norm = audio
audio_int16_2 = (audio_norm * 32767).astype(np.int16)
stream2 = recognizer.create_stream()
stream2.accept_waveform(sr, audio_int16_2.tolist())
recognizer.decode_stream(stream2)
result2 = stream2.result.text
print(f'识别结果: "{result2}"')

# ===== 结论 =====
print("\n" + "=" * 50)
print("诊断结果:")
print(f"  原始音量: {volume:.5f}")
print(f"  float32 输入: \"{result1}\"")
print(f"  int16 输入:   \"{result2}\"")
if result1 in ("", "嗯", "啊", "呃", "哦") and result2 in ("", "嗯", "啊", "呃", "哦"):
    print("  ❌ 模型未能识别出有效文字")
    print("  可能原因：模型对短句/单字识别率有限，或音量/清晰度不够")
elif result1 != result2:
    print("  ⚠️ 两种输入格式结果不一致，需要统一格式")
else:
    print("  ✅ 识别正常")
print("=" * 50)
