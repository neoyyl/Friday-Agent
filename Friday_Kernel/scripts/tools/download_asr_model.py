#!/usr/bin/env python3
"""下载离线语音识别模型"""
import os
import sys
import urllib.request
from pathlib import Path

model_dir = os.path.join(str(Path(__file__).resolve().parent.parent), "models")
os.makedirs(model_dir, exist_ok=True)

models = [
    {
        "name": "sherpa-onnx-sense-voice-zh",
        "url": "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2",
        "fallback": "https://hf-mirror.com/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/model.onnx",
        "note": "SenseVoice 多语言（中英日韩粤）",
    },
]

for m in models:
    name = m["name"]
    path = os.path.join(model_dir, name)

    if os.path.exists(path):
        print(f"✅ {name} 已存在")
        continue

    # 尝试所有可用源
    urls = [m["url"], m.get("fallback", "")]
    for url in urls:
        if not url:
            continue
        print(f"下载 {name}...")
        print(f"  来源: {url}")
        print(f"  说明: {m['note']}")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=600) as resp:
                total = int(resp.headers.get("Content-Length", 0))
                print(f"  大小: {total/1024/1024:.1f} MB")
                data = resp.read()
                save_path = os.path.join(model_dir, f"{name}.tar.bz2")
                with open(save_path, "wb") as f:
                    f.write(data)
            print(f"✅ {name} 下载完成！")
            break
        except Exception as e:
            print(f"  ❌ {e}")
            continue
    else:
        print(f"❌ {name} 所有源都失败了")
        print(f"   请手动下载后解压到: {model_dir}")
