#!/usr/bin/env python3
"""
Friday Awake — 声纹唤醒集成
==================================
在 Friday Awake 的唤醒流程中加入声纹验证：
  1. 监测到"星期五"唤醒词
  2. 提取声纹特征
  3. 对比已注册声纹
  4. 匹配 → 响应；不匹配 → 忽略

集成方式：
  - 在 friday_listener.py 的 on_wake 回调前插入声纹验证
  - 声纹文件: voiceprint_profiles.pkl（自动保存/加载）

首次使用需先注册声纹：
  python friday_voiceprint.py --enroll

作者：Friday Kernel
版本：0.1.0
"""

import sys
import os
import numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from friday_voiceprint import VoiceprintRecognizer


class VoiceprintGate:
    """
    声纹门禁——验证唤醒者身份
    
    与 Friday Awake 的唤醒流程集成：
    on_wake 回调中先过声纹门禁，通过才响应。
    """

    def __init__(self, threshold=0.78):
        self.recognizer = VoiceprintRecognizer(threshold=threshold)
        self.enrolled = len(self.recognizer.speaker_profiles) > 0

    def check_enrolled(self):
        """检查是否已注册声纹"""
        return self.enrolled

    def verify(self, audio):
        """
        验证一段语音是否来自已注册的说话人
        
        参数:
          audio: numpy array, 语音数据
        
        返回:
          (passed, similarity, name)
          - passed: True=声纹匹配, False=不匹配或未注册
          - similarity: 相似度分数
          - name: 匹配的说话人
        """
        if not self.enrolled:
            # 未注册声纹时，直接放行（兼容模式）
            return (True, 0.0, None)

        is_match, similarity, name = self.recognizer.verify(audio)
        return (is_match, similarity, name)

    def get_status_string(self):
        """获取声纹状态文本"""
        if not self.enrolled:
            return "未注册声纹 — 所有声音都可唤醒（安全模式）"
        
        name = list(self.recognizer.speaker_profiles.keys())[0]
        samples = self.recognizer.speaker_profiles[name]["samples"]
        return f"已注册声纹 [{name}: {samples}条样本] — 仅你的声音可唤醒"

    @staticmethod
    def start_enrollment():
        """启动声纹注册流程（交互式）"""
        print()
        print("=" * 56)
        print("  🎙️ Friday 声纹注册向导")
        print("=" * 56)
        print()
        print("  请找一个安静的环境")
        print("  你将说 3 次「星期五」")
        print("  Friday 会学习你的声音特征")
        print()
        resp = input("  准备好后按 Enter 开始 (输入 n 取消): ")
        if resp.lower() == "n":
            print("  已取消")
            return False

        recognizer = VoiceprintRecognizer()
        recognizer.interactive_enroll()

        # 验证注册结果
        if recognizer.speaker_profiles:
            print()
            print("  ✅ 声纹注册成功！")
            print(f"  现在只有你的声音能唤醒 Friday")
            print()
            return True
        else:
            print()
            print("  ❌ 注册失败，请重试")
            print()
            return False


# ==================== 快捷命令 ====================

def cmd_enroll():
    """命令行声纹注册"""
    # 先检查是否已有声纹
    gate = VoiceprintGate()
    if gate.enrolled:
        print(f"  当前已注册: {gate.get_status_string()}")
        resp = input("  是否覆盖重新注册？(y/n): ")
        if resp.lower() != "y":
            print("  已取消")
            return

    VoiceprintGate.start_enrollment()


def cmd_status():
    """查看声纹状态"""
    gate = VoiceprintGate()
    print(f"  🔑 声纹状态: {gate.get_status_string()}")


if __name__ == "__main__":
    if "--enroll" in sys.argv:
        cmd_enroll()
    elif "--status" in sys.argv:
        cmd_status()
    else:
        print("用法:")
        print("  python voiceprint_gate.py --enroll   → 注册/重新注册声纹")
        print("  python voiceprint_gate.py --status   → 查看声纹状态")
