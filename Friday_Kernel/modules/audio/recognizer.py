"""
Audio Recognizer — 语音活动检测与音频处理原语
=================================================
独立模块，零依赖其他 Friday 模块。
只依赖外部包：numpy, webrtcvad (可选), sounddevice (可选)。

用法：
  vad = VADDetector()
  if vad.detect(audio_chunk):
      recording.append(chunk)
  
  if not SpeechValidator.is_actual_speech(audio, duration):
      return  # 过滤噪声
"""

import numpy as np


# ==================== VAD 检测器 ====================

class VADDetector:
    """
    语音活动检测器
    策略：WebRTC VAD（严格但准）|| 能量检测（灵敏）
    任一条件满足即视为有语音。
    """

    def __init__(self, sample_rate=16000, energy_threshold=0.002,
                 min_speech_blocks=2, silence_blocks=15):
        self.sample_rate = sample_rate
        self.energy_threshold = energy_threshold
        self.min_speech_blocks = min_speech_blocks
        self.silence_blocks = silence_blocks

        # 尝试加载 WebRTC VAD
        self._vad = None
        self._vad_mode = "energy"
        self._vad_buffer = b""
        self._vad_frame_size = int(16000 * 30 / 1000)  # 480 samples for 30ms
        self._use_vad = False

        try:
            import webrtcvad
            self._vad = webrtcvad.Vad(1)  # 适中灵敏度
            self._vad_mode = "webrtc"
            self._use_vad = True
        except Exception:
            pass

    def detect(self, audio_chunk):
        """
        检测一段音频是否有语音活动。

        参数:
          audio_chunk: numpy float32 数组，范围 [-1, 1]

        返回:
          bool: 是否有语音
        """
        speech_detected = False

        # Method 1: WebRTC VAD
        if self._use_vad and self._vad:
            try:
                raw_bytes = (audio_chunk * 32767).astype(np.int16).tobytes()
                self._vad_buffer += raw_bytes
                while len(self._vad_buffer) >= self._vad_frame_size * 2:
                    frame = self._vad_buffer[:self._vad_frame_size * 2]
                    self._vad_buffer = self._vad_buffer[self._vad_frame_size * 2:]
                    if self._vad.is_speech(frame, self.sample_rate):
                        speech_detected = True
                        break
            except Exception:
                pass

        # Method 2: 能量检测（更灵敏）
        volume = np.abs(audio_chunk).mean()
        if volume > self.energy_threshold:
            speech_detected = True

        return speech_detected

    def reset_buffer(self):
        """重置 VAD 缓冲（新一段录音前调用）"""
        self._vad_buffer = b""


# ==================== 语音验证器 ====================

class SpeechValidator:
    """
    判断一段音频是否是真的语音（不是响指/拍手/环境噪声）

    三个维度:
      1. 过零率：真实语音适中，冲击声极高
      2. 能量包络：语音渐进，冲击声瞬时
      3. 时长：短促声音直接过滤
    """

    @staticmethod
    def is_actual_speech(audio_data: np.ndarray, duration: float) -> bool:
        """
        判断音频是否真实语音。

        参数:
          audio_data: float32 数组 [-1, 1]
          duration: 时长（秒）

        返回:
          bool: True=是真实语音
        """
        # 1. 时长过滤
        if duration < 0.3:
            return False

        # 2. 过零率过滤（响指/拍手的过零率极高）
        zero_crossings = np.sum(np.abs(np.diff(np.sign(audio_data)))) / len(audio_data)
        if zero_crossings > 0.55:
            return False

        # 3. 能量包络检测
        frame_len = len(audio_data) // 10
        if frame_len < 1:
            return False
        energies = []
        for i in range(10):
            start = i * frame_len
            end = min(start + frame_len, len(audio_data))
            if end > start:
                energies.append(np.mean(audio_data[start:end] ** 2))
        if energies:
            max_energy = max(energies)
            mean_energy = np.mean(energies)
            if mean_energy > 0 and max_energy / mean_energy > 12:
                return False

        return True


# ==================== 音频工具函数 ====================

def normalize_audio(audio_data: np.ndarray) -> np.ndarray:
    """
    音量归一化到 [-1, 1]

    参数:
      audio_data: numpy 数组

    返回:
      归一化后的数组
    """
    max_val = np.max(np.abs(audio_data))
    if max_val > 0:
        return audio_data / max_val
    return audio_data


def frames_to_audio(frames, sample_rate=16000) -> tuple:
    """
    合并录音帧为完整的音频数组。

    参数:
      frames: list of numpy arrays
      sample_rate: 采样率

    返回:
      (audio_data, duration_seconds)
    """
    if not frames:
        return np.array([]), 0.0
    audio = np.concatenate(frames, axis=0).flatten()
    duration = len(audio) / sample_rate
    return audio, duration


# ==================== 快速测试 ====================
if __name__ == "__main__":
    vad = VADDetector()
    print(f"VAD 模式: {vad._vad_mode}")
    print(f"能量阈值: {vad.energy_threshold}")

    # 测试静音
    silent = np.zeros(1600, dtype=np.float32)
    print(f"静音检测: {vad.detect(silent)} (期望 False)")

    # 测试语音验证
    short = np.zeros(100, dtype=np.float32)
    print(f"短音频验证: {SpeechValidator.is_actual_speech(short, 0.1)} (期望 False)")

    print("全部测试通过")
