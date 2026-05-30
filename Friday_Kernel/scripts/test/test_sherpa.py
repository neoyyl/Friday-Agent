#!/usr/bin/env python3
"""Test sherpa-onnx recognition"""
import os, sys
from pathlib import Path
import numpy as np
from sherpa_onnx.offline_recognizer import OfflineRecognizer

_kb = str(Path(__file__).resolve().parent.parent)
model_path = os.path.join(_kb, "models", "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17")
model_file = os.path.join(model_path, "model.int8.onnx")
tokens_file = os.path.join(model_path, "tokens.txt")

print("Loading model...")
r = OfflineRecognizer.from_sense_voice(
    model=model_file, tokens=tokens_file,
    num_threads=4, language="zh", use_itn=True,
)
print("Model loaded!")

# Test with sine wave
sr = 16000
t = np.linspace(0, 0.5, int(sr * 0.5))
wave = (np.sin(2 * np.pi * 440 * t) * 32767).astype(np.int16).tolist()

s = r.create_stream()
s.accept_waveform(sr, wave)
r.decode_stream(s)
result = s.result.text
print(f'Test result: "{result}"')
print("OK - sherpa-onnx ready for voice recognition")
