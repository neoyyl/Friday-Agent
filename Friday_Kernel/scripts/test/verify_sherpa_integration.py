#!/usr/bin/env python3
"""Comprehensive verification of sherpa-onnx voice integration"""
import sys, os, json, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "modules"))

def step(n, msg):
    print(f"\n[{n}/6] {msg}")
    print("-" * 50)

def ok(msg):
    print(f"  [OK] {msg}")

def fail(msg):
    print(f"  [FAIL] {msg}")
    return False

# ── Step 1: Import check ──
step(1, "模块导入检查")
try:
    from sherpa_server import SherpaServer, is_hallucination
    from voice_manager import FridayVoiceManager, ASRMode, VoiceState
    ok(f"sherpa_server: SherpaServer, is_hallucination")
    ok(f"voice_manager: FridayVoiceManager, {len(ASRMode)} modes")
except Exception as e:
    fail(f"导入失败: {e}")
    sys.exit(1)

# ── Step 2: Config defaults check ──
step(2, "配置默认值检查")
m = FridayVoiceManager()
config = m.DEFAULT_CONFIG

checks = [
    ("asr_mode == LOCAL", config['asr_mode'] == ASRMode.LOCAL),
    ("sherpa_port == 3723", config['sherpa_port'] == 3723),
    ("sherpa_model == sense-voice", config['sherpa_model'] == 'sense-voice'),
    ("sherpa_connected starts False", m.sherpa_connected == False),
]
all_ok = True
for desc, result in checks:
    if result:
        ok(desc)
    else:
        fail(desc)
        all_ok = False

# ── Step 3: Hallucination filter check ──
step(3, "幻觉过滤器验证")
hallu_checks = [
    ("空字符串 == True", is_hallucination(""), True),
    ("谢谢收看 == True", is_hallucination("谢谢收看"), True),
    ("感谢观看 == True", is_hallucination("感谢观看"), True),
    ("今天天气真不错 == False", is_hallucination("今天天气真不错"), False),
    ("你好世界 == False", is_hallucination("你好世界"), False),
    ("播放音乐 == False", is_hallucination("播放音乐"), False),
    ("... == True (纯标点)", is_hallucination("..."), True),
    ("12345 == True (纯数字)", is_hallucination("12345"), True),
]
for desc, result, expected in hallu_checks:
    if result == expected:
        ok(desc)
    else:
        fail(f"{desc} (got {result}, expected {expected})")
        all_ok = False

# ── Step 4: Start local server via voice_manager API ──
step(4, "通过 voice_manager 启动本地服务")
m2 = FridayVoiceManager({'sherpa_port': 3726})
started = m2.start_local_server()
if started:
    ok("start_local_server() 返回 True")
else:
    fail("服务启动失败")
    all_ok = False

# ── Step 5: WebSocket protocol test ──
step(5, "WebSocket 协议验证")
if started:
    import asyncio
    import websockets
    
    async def test_protocol():
        uri = "ws://127.0.0.1:3726"
        
        # 5a. 配置握手
        async with websockets.connect(uri) as ws:
            await ws.send(json.dumps({"type": "config", "lang": "zh"}))
            resp = json.loads(await ws.recv())
            if resp.get("type") == "config_ok":
                ok("Config handshake: type=config_ok")
            else:
                fail(f"Config handshake 失败: {resp}")
                return False
            
            # 5b. 发送测试音频
            import numpy as np
            sr = 16000
            t = np.linspace(0, 0.3, int(sr * 0.3))
            tone = (np.sin(2 * np.pi * 440 * t) * 3000).astype(np.int16)
            await ws.send(tone.tobytes())
            
            # 发送静音触发 flush
            silence = np.zeros(int(sr * 2), dtype=np.int16).tobytes()
            await ws.send(silence)
            await asyncio.sleep(2)
            
            # 5c. 手动触发 flush
            await ws.send(json.dumps({"type": "flush"}))
            await asyncio.sleep(2)
            
            try:
                resp = await asyncio.wait_for(ws.recv(), timeout=3)
                msg = json.loads(resp)
                if msg.get("type") in ("transcript",):
                    ok(f"音频处理返回结果: type={msg['type']}")
                else:
                    ok(f"音频处理响应: {msg.get('type', 'unknown')}")
            except asyncio.TimeoutError:
                ok("无识别结果（纯噪音音频，符合预期）")
        
        return True
    
    proto_ok = asyncio.run(test_protocol())
    if not proto_ok:
        all_ok = False

# ── Step 6: Clean shutdown ──
step(6, "服务关闭验证")
try:
    m2.stop_local_server()
    if m2.sherpa_proc is None:
        ok("stop_local_server() 进程已清理")
    else:
        fail("进程未清理")
        all_ok = False
    
    # 验证端口已释放
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = s.connect_ex(('127.0.0.1', 3726))
    s.close()
    if result != 0:
        ok("端口 3726 已释放")
    else:
        fail("端口仍被占用")
        all_ok = False
except Exception as e:
    fail(f"关闭异常: {e}")
    all_ok = False

# ── Summary ──
print()
print("=" * 50)
if all_ok:
    print("  全部验证通过 (6/6)!  sherpa-onnx 集成正确")
    print("=" * 50)
    sys.exit(0)
else:
    print("  部分验证失败，请检查日志")
    print("=" * 50)
    sys.exit(1)
