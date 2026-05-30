#!/usr/bin/env python3
"""Test microphone and speech recognition"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'modules'))

import sounddevice as sd
import numpy as np
import speech_recognition as sr

print("=" * 50)
print("Microphone & Speech Recognition Test")
print("=" * 50)

# 1. Check microphones
print("\n[1] Available microphones:")
devices = sd.query_devices()
for i, d in enumerate(devices):
    if d['max_input_channels'] > 0:
        print(f"  [{i}] {d['name']}")

# 2. Test recording
print("\n[2] Recording 3 seconds... Speak now!")
try:
    audio_data = sd.rec(int(3 * 16000), samplerate=16000, channels=1, dtype='float32')
    for i in range(3, 0, -1):
        print(f"  {i}...")
        sd.sleep(1000)
    sd.wait()
    audio_flat = audio_data.flatten()
    volume = np.abs(audio_flat).mean()
    print(f"  Recorded {len(audio_flat)} samples, volume={volume:.5f}")
    
    if volume < 0.003:
        print("  WARNING: Very low volume! Check microphone.")
    else:
        print("  Microphone OK!")

    # 3. Test Google Speech Recognition
    print("\n[3] Testing Google Speech Recognition (needs internet)...")
    recognizer = sr.Recognizer()
    
    # Convert to format SR expects
    audio_int16 = (audio_flat * 32767).astype(np.int16)
    audio = sr.AudioData(audio_int16.tobytes(), 16000, 2)
    
    try:
        text = recognizer.recognize_google(audio, language="zh-CN")
        print(f"  Recognized: \"{text}\"")
        if "五" in text:
            print("  Contains 五 - wake word might be detected!")
    except sr.UnknownValueError:
        print("  Google could not understand audio")
    except sr.RequestError as e:
        print(f"  Google API error: {e}")
    except Exception as e:
        print(f"  Error: {e}")

except Exception as e:
    print(f"  Recording failed: {e}")

print("\n" + "=" * 50)
print("Done")
print("=" * 50)
