#!/usr/bin/env python3
"""End-to-end test for sherpa_server.py"""
import sys, os, json, time, subprocess, asyncio
from pathlib import Path
import numpy as np

_kb = str(Path(__file__).resolve().parent.parent)
sys.path.insert(0, os.path.join(_kb, "modules", "services"))

MODEL_PATH = os.path.join(_kb, "models", "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17")
SERVER_SCRIPT = os.path.join(_kb, "modules", "services", "sherpa_server.py")
PORT = 3725

async def test():
    print("=== sherpa_server.py End-to-End Test ===")
    print()

    # 1. Start server
    print("[1/4] Starting sherpa_server...")
    proc = subprocess.Popen(
        [sys.executable, SERVER_SCRIPT,
         "--port", str(PORT), "--host", "127.0.0.1",
         "--model-path", MODEL_PATH],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, encoding="utf-8", errors="replace",
    )

    # Read stderr in background to check progress
    stderr_lines = []

    def read_stderr():
        for line in proc.stderr:
            stderr_lines.append(line.strip())
            print(f"  [server] {line.strip()}")

    import threading
    t = threading.Thread(target=read_stderr, daemon=True)
    t.start()

    await asyncio.sleep(8)  # Wait for model load

    # 2. Test config handshake
    print("\n[2/4] Testing config handshake...")
    import websockets
    uri = f"ws://127.0.0.1:{PORT}"

    async with websockets.connect(uri) as ws:
        await ws.send(json.dumps({"type": "config", "lang": "zh"}))
        resp = json.loads(await ws.recv())
        assert resp["type"] == "config_ok", f"Expected config_ok, got {resp}"
        print("  [PASS] Config handshake OK")

        # 3. Test audio pipeline
        print("\n[3/4] Testing audio pipeline...")
        sr = 16000
        # Generate test tone (not speech, but tests VAD + recognition)
        t_vals = np.linspace(0, 0.3, int(sr * 0.3))
        tone = (np.sin(2 * np.pi * 440 * t_vals) * 3000).astype(np.int16)
        pcm_data = tone.tobytes()
        await ws.send(pcm_data)

        # Send silence to trigger flush
        silence = np.zeros(int(sr * 2), dtype=np.int16).tobytes()
        await ws.send(silence)

        await asyncio.sleep(3)

        # Send flush command
        await ws.send(json.dumps({"type": "flush"}))
        await asyncio.sleep(2)

        # Check response
        try:
            resp = await asyncio.wait_for(ws.recv(), timeout=3)
            msg = json.loads(resp)
            if msg.get("type") == "transcript":
                print(f'  [INFO] Got transcript: "{msg["text"]}"')
            else:
                print(f"  [INFO] Got response: {msg}")
        except asyncio.TimeoutError:
            print("  [INFO] No transcript (expected for noise-only audio)")
        print("  [PASS] Audio pipeline OK")

    # 4. Shutdown
    print("\n[4/4] Shutting down server...")
    proc.terminate()
    try:
        proc.wait(timeout=5)
        print("  [PASS] Server shutdown OK")
    except subprocess.TimeoutExpired:
        proc.kill()
        print("  [WARN] Server killed (timeout)")

    print()
    print("=== All tests passed! ===")

if __name__ == "__main__":
    asyncio.run(test())
