#!/usr/bin/env python3
"""Test listener offline recognition"""
import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "modules"))
import numpy as np
from friday_listener import FridayListener

l = FridayListener()

# 模拟音频（正弦波，模拟人声频率范围）
sr = 16000
t = np.linspace(0, 0.5, int(sr * 0.5))
audio = (np.sin(2 * np.pi * 200 * t) + 0.5 * np.sin(2 * np.pi * 300 * t)).astype(np.float32)
audio = audio * 0.3

print("Testing offline recognition...")
result = l._try_recognize(audio)
print(f'Result: "{result}"')
print("Listener offline recognition OK")
