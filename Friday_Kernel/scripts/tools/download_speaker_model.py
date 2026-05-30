#!/usr/bin/env python3
"""Download speaker embedding model"""
import os, urllib.request
from pathlib import Path

model_dir = os.path.join(str(Path(__file__).resolve().parent.parent), "models")
os.makedirs(model_dir, exist_ok=True)
model_file = os.path.join(model_dir, "speaker_model.onnx")

if os.path.exists(model_file) and os.path.getsize(model_file) > 1000000:
    print(f"Already exists: {os.path.getsize(model_file)/1024/1024:.1f} MB")
    exit()

# sherpa-onnx speaker model from hf-mirror
urls = [
    "https://hf-mirror.com/csukuangfj/sherpa-onnx-3d-speaker-eres2net-base-sv-zh-cn-3dspeaker-16k/resolve/main/model.onnx",
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx",
]

for url in urls:
    print(f"Trying...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            with open(model_file, "wb") as f:
                f.write(resp.read())
        size = os.path.getsize(model_file)
        print(f"OK! {size/1024/1024:.1f} MB")
        break
    except Exception as e:
        print(f"  Failed: {str(e)[:80]}")
else:
    print("All URLs failed")
    print("\nManual download:")
    print("  https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models")
    print("  Look for: 3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx")
