#!/usr/bin/env python3
"""
Friday Voice 测试脚本
=====================
测试本地 sherpa-onnx SenseVoice 服务和云端 ASR 功能

用法:
  python test_voice.py --mode local    # 测试本地 sherpa-onnx
  python test_voice.py --mode cloud    # 测试云端 ASR
  python test_voice.py --mode hybrid   # 测试混合模式

作者：Friday Kernel
版本：1.0.0 (sherpa-onnx)
"""

import argparse
import asyncio
import time
import sys
from pathlib import Path

# 添加模块路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from voice_manager import FridayVoiceManager, ASRMode, VoiceState


def test_local_sherpa():
    """测试本地 sherpa-onnx 服务"""
    print("=" * 60)
    print("测试本地 sherpa-onnx SenseVoice 服务")
    print("=" * 60)
    
    manager = FridayVoiceManager({
        'asr_mode': ASRMode.LOCAL,
        'enable_bargein': True,
        'enable_duck': True,
    })
    
    # 设置回调
    def on_transcript(text, is_final):
        print(f"[VOICE] 识别: {text} (最终: {is_final})")
    
    def on_state_change(state):
        print(f"[STATUS] 状态: {state.value}")
    
    def on_error(error):
        print(f"[ERROR] 错误: {error}")
    
    manager.set_callbacks(
        on_transcript=on_transcript,
        on_state_change=on_state_change,
        on_error=on_error,
    )
    
    # 启动本地识别服务
    print("\n[START] 启动本地识别服务 (sherpa-onnx SenseVoice)...")
    if not manager.start_local_server():
        print("[ERROR] 本地服务启动失败")
        return False
    
    print("[OK] 本地服务启动成功")
    print("\n[MIC]  开始监听（说话测试，说'退出'结束）...")
    print("[TIP] 提示：说话后停顿 2 秒会自动识别")
    
    # 开始监听
    manager.start_listening()
    
    # 运行 30 秒或直到用户中断
    try:
        start_time = time.time()
        while time.time() - start_time < 30:
            time.sleep(0.1)
            
            # 检查是否有最终识别结果包含"退出"
            if manager.accumulated_text and "退出" in manager.accumulated_text:
                print("\n[BYE] 检测到'退出'，结束测试")
                break
    except KeyboardInterrupt:
        print("\n\n[STOP]  用户中断")
    
    # 清理
    manager.stop_listening()
    manager.stop_local_server()
    
    print("\n[OK] 本地 sherpa-onnx 测试完成")
    return True


async def test_cloud_asr():
    """测试云端 ASR"""
    print("=" * 60)
    print("测试云端 ASR")
    print("=" * 60)
    
    # 检查是否有 API Key
    import os
    api_key = os.getenv('ALIYUN_API_KEY') or input("请输入阿里云 API Key: ")
    
    if not api_key:
        print("[ERROR] 未提供 API Key")
        return False
    
    manager = FridayVoiceManager({
        'asr_mode': ASRMode.CLOUD,
        'cloud_provider': 'aliyun',
        'aliyun_api_key': api_key,
        'enable_bargein': True,
        'enable_duck': True,
    })
    
    # 设置回调
    def on_transcript(text, is_final):
        print(f"[VOICE] 识别: {text} (最终: {is_final})")
    
    def on_state_change(state):
        print(f"[STATUS] 状态: {state.value}")
    
    def on_error(error):
        print(f"[ERROR] 错误: {error}")
    
    manager.set_callbacks(
        on_transcript=on_transcript,
        on_state_change=on_state_change,
        on_error=on_error,
    )
    
    # 初始化云端 ASR
    print("\n[START] 连接云端 ASR...")
    connected = await manager.init_cloud_asr()
    
    if not connected:
        print("[ERROR] 云端 ASR 连接失败")
        return False
    
    print("[OK] 云端 ASR 连接成功")
    print("\n[MIC]  开始监听（说话测试，说'退出'结束）...")
    
    # 开始监听
    manager.start_listening()
    
    # 运行 30 秒或直到用户中断
    try:
        start_time = time.time()
        while time.time() - start_time < 30:
            time.sleep(0.1)
            
            if manager.accumulated_text and "退出" in manager.accumulated_text:
                print("\n[BYE] 检测到'退出'，结束测试")
                break
    except KeyboardInterrupt:
        print("\n\n[STOP]  用户中断")
    
    # 清理
    manager.stop_listening()
    await manager.close_cloud_asr()
    
    print("\n[OK] 云端 ASR 测试完成")
    return True


def test_hybrid_mode():
    """测试混合模式"""
    print("=" * 60)
    print("测试混合模式（本地优先，云端备选）")
    print("=" * 60)
    
    manager = FridayVoiceManager({
        'asr_mode': ASRMode.HYBRID,
        'enable_bargein': True,
        'enable_duck': True,
    })
    
    # 设置回调
    def on_transcript(text, is_final):
        print(f"[VOICE] 识别: {text} (最终: {is_final})")
    
    def on_state_change(state):
        print(f"[STATUS] 状态: {state.value}")
    
    def on_error(error):
        print(f"[ERROR] 错误: {error}")
    
    def on_mode_switch(mode):
        print(f"[SWITCH] 模式切换: {mode.value}")
    
    manager.set_callbacks(
        on_transcript=on_transcript,
        on_state_change=on_state_change,
        on_error=on_error,
        on_mode_switch=on_mode_switch,
    )
    
    # 启动本地服务
    print("\n[START] 启动本地识别服务 (sherpa-onnx)...")
    local_ok = manager.start_local_server()
    
    if local_ok:
        print("[OK] 本地服务启动成功")
    else:
        print("[WARN]  本地服务启动失败，将使用云端备选")
        # 这里可以添加云端初始化逻辑
    
    print("\n[MIC]  开始监听（说话测试）...")
    manager.start_listening()
    
    # 运行 15 秒
    try:
        time.sleep(15)
    except KeyboardInterrupt:
        print("\n\n[STOP]  用户中断")
    
    # 清理
    manager.stop_listening()
    manager.stop_local_server()
    
    print("\n[OK] 混合模式测试完成")
    return True


def main():
    parser = argparse.ArgumentParser(description="Friday Voice 测试脚本")
    parser.add_argument('--mode', choices=['local', 'cloud', 'hybrid'],
                       default='local', help='测试模式')
    args = parser.parse_args()
    
    print("\n[TEST] Friday Voice 测试")
    print(f"[INFO] 测试模式: {args.mode}")
    print()
    
    if args.mode == 'local':
        success = test_local_sherpa()
    elif args.mode == 'cloud':
        success = asyncio.run(test_cloud_asr())
    elif args.mode == 'hybrid':
        success = test_hybrid_mode()
    else:
        print(f"[ERROR] 未知模式: {args.mode}")
        success = False
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
