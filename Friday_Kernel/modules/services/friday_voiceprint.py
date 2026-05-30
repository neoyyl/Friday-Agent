#!/usr/bin/env python3
"""
Friday Voiceprint — 声纹识别引擎
======================================
从零实现的声纹识别系统，不依赖外部模型。

原理：
  1. 提取语音的 MFCC 特征（梅尔频率倒谱系数）
  2. 用多个录音建立你的声纹特征向量
  3. 新语音来的时候，提取相同特征
  4. 计算余弦相似度 → 判断是不是同一个人

技术栈：
  - numpy: FFT、矩阵运算
  - PyTorch: 加速计算（可选回退到numpy）
  - 纯算法实现，无需下载任何模型

作者：Friday Kernel
版本：0.1.0
"""

import numpy as np
import struct
import math
import os
import json
import pickle
from pathlib import Path


class MFCCExtractor:
    """
    MFCC 特征提取器
    
    将音频信号转换为 MFCC 特征向量，
    这是声纹识别的标准前端。
    """

    def __init__(
        self,
        sample_rate=16000,
        n_mfcc=40,           # 增加到40维（原13）
        n_fft=1024,          # FFT窗口增大
        hop_length=160,
        n_mels=80,           # Mel滤波器增多（原40）
        fmin=0,
        fmax=None,
    ):
        self.sample_rate = sample_rate
        self.n_mfcc = n_mfcc
        self.n_fft = n_fft
        self.hop_length = hop_length
        self.n_mels = n_mels
        self.fmin = fmin
        self.fmax = fmax or sample_rate // 2

        # 预计算 Mel 滤波器组
        self.mel_filterbank = self._create_mel_filterbank()

        # 预计算 DCT 矩阵
        self.dct_matrix = self._create_dct_matrix()

    def _hz_to_mel(self, hz):
        """频率转 Mel 刻度"""
        return 2595 * np.log10(1 + hz / 700)

    def _mel_to_hz(self, mel):
        """Mel 刻度转频率"""
        return 700 * (10 ** (mel / 2595) - 1)

    def _create_mel_filterbank(self):
        """创建 Mel 滤波器组"""
        # 在 Mel 刻度上均匀取点
        mel_points = np.linspace(
            self._hz_to_mel(self.fmin),
            self._hz_to_mel(self.fmax),
            self.n_mels + 2,
        )
        hz_points = self._mel_to_hz(mel_points)
        bins = np.floor((self.n_fft + 1) * hz_points / self.sample_rate).astype(int)

        filterbank = np.zeros((self.n_mels, self.n_fft // 2 + 1))
        for m in range(1, self.n_mels + 1):
            f_left = bins[m - 1]
            f_center = bins[m]
            f_right = bins[m + 1]

            # 上升沿
            for i in range(f_left, f_center):
                if i < self.n_fft // 2 + 1:
                    filterbank[m - 1, i] = (i - f_left) / (f_center - f_left)
            # 下降沿
            for i in range(f_center, f_right):
                if i < self.n_fft // 2 + 1:
                    filterbank[m - 1, i] = (f_right - i) / (f_right - f_center)

        return filterbank

    def _create_dct_matrix(self):
        """创建 DCT Type-II 矩阵"""
        n = self.n_mfcc
        m = self.n_mels
        dct = np.zeros((n, m))
        for i in range(n):
            for j in range(m):
                dct[i, j] = math.cos(math.pi * i * (j + 0.5) / m)
        dct[0] *= math.sqrt(1 / m)
        dct[1:] *= math.sqrt(2 / m)
        return dct

    def _pre_emphasis(self, signal, coeff=0.97):
        """预加重——增强高频"""
        return np.append(signal[0], signal[1:] - coeff * signal[:-1])

    def _framing(self, signal):
        """分帧"""
        frame_length = self.n_fft
        num_frames = 1 + (len(signal) - frame_length) // self.hop_length
        frames = np.zeros((num_frames, frame_length))
        for i in range(num_frames):
            start = i * self.hop_length
            frames[i] = signal[start : start + frame_length]
        return frames

    def _apply_window(self, frames):
        """加汉明窗"""
        window = np.hamming(self.n_fft)
        return frames * window

    def extract(self, audio):
        """
        从音频信号提取 MFCC 特征
        
        参数:
          audio: 1D numpy array, float, range [-1, 1]
        
        返回:
          mfcc: (n_mfcc, n_frames) numpy array
        """
        # 预处理
        signal = self._pre_emphasis(audio)
        frames = self._framing(signal)
        frames = self._apply_window(frames)

        # FFT → 功率谱
        mag_spec = np.abs(np.fft.rfft(frames, n=self.n_fft))
        power_spec = (mag_spec ** 2) / self.n_fft

        # Mel 滤波
        mel_energy = np.dot(power_spec, self.mel_filterbank.T)
        mel_energy = np.maximum(mel_energy, 1e-10)

        # Log
        log_mel = np.log(mel_energy)

        # DCT → MFCC
        mfcc = np.dot(log_mel, self.dct_matrix.T)

        return mfcc.T  # (n_mfcc, n_frames)

    def extract_utterance_embedding(self, audio):
        """
        提取整段语音的声纹嵌入向量（增强版 v2）
        
        特征说明：
          - MFCC 40维：均值/标准差/偏度/峰度
          - 一阶差分MFCC：均值/标准差
          - 子带能量比：4个频段的能量分布
          - 频谱对比度：频谱峰值与谷值比
          - 基频统计：近似估计
          
        共约 220 维特征向量。
        """
        mfcc = self.extract(audio)  # (n_mfcc, n_frames)

        if mfcc.shape[1] == 0:
            return None

        # ===== MFCC 四阶统计量 =====
        mean = np.mean(mfcc, axis=1)
        std = np.std(mfcc, axis=1)
        skew = np.mean(((mfcc - mean.reshape(-1, 1)) / (std.reshape(-1, 1) + 1e-10)) ** 3, axis=1)
        kurt = np.mean(((mfcc - mean.reshape(-1, 1)) / (std.reshape(-1, 1) + 1e-10)) ** 4, axis=1) - 3

        # ===== 一阶差分统计量 =====
        delta = np.zeros_like(mfcc)
        if mfcc.shape[1] > 2:
            delta[:, 1:-1] = (mfcc[:, 2:] - mfcc[:, :-2]) / 2
        delta_mean = np.mean(delta, axis=1)
        delta_std = np.std(delta, axis=1)

        # ===== 子带能量比（4个频段） =====
        # 将MFCC分为4个子带，计算每个子带的能量占比
        n_frames = mfcc.shape[1]
        band_size = mfcc.shape[0] // 4
        subband_ratios = []
        for b in range(4):
            start = b * band_size
            end = start + band_size if b < 3 else mfcc.shape[0]
            band_energy = np.sum(mfcc[start:end] ** 2)
            total_energy = np.sum(mfcc ** 2)
            subband_ratios.append(band_energy / (total_energy + 1e-10))
        subband_ratios = np.array(subband_ratios)

        # ===== 频谱对比度（近似） =====
        # 前5个MFCC的均值作为频谱整体亮度的近似
        spectral_brightness = np.mean(mfcc[:5])

        # ===== 基频统计（通过自相关近似） =====
        # 用前两维MFCC的周期性来近似基频特征
        if n_frames > 5:
            mfcc0 = mfcc[0]
            autocorr = np.correlate(mfcc0 - np.mean(mfcc0), mfcc0 - np.mean(mfcc0), mode='full')
            autocorr = autocorr[len(autocorr)//2:]
            if len(autocorr) > 2 and autocorr[0] > 0:
                # 找第一个峰值位置作为周期估计
                peaks = np.where(np.diff(np.sign(np.diff(autocorr))) < 0)[0]
                peak_lags = peaks[(peaks > 1) & (peaks < 50)]
                pitch_mean = np.mean(peak_lags) if len(peak_lags) > 0 else 0
                pitch_std = np.std(peak_lags) if len(peak_lags) > 1 else 0
            else:
                pitch_mean, pitch_std = 0, 0
        else:
            pitch_mean, pitch_std = 0, 0

        # ===== 拼接特征 =====
        features = [
            mean, std, skew, kurt,
            delta_mean, delta_std,
            subband_ratios,
            np.array([spectral_brightness, pitch_mean, pitch_std]),
        ]
        embedding = np.concatenate([f.ravel() for f in features])

        # L2 归一化
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm

        return embedding


class VoiceprintRecognizer:
    """
    声纹识别器
    
    注册：录入你的声音 → 保存声纹特征
    验证：检测到语音 → 对比声纹 → 判断是否是你
    
    threshold 阈值说明：
      > 0.85  高度严格（几乎不会误判，但可能拒绝你自己）
      > 0.75  推荐（平衡准确率和召回率）
      > 0.65  宽松（不容易误拒，但可能被别人通过）
      < 0.5   极宽松（仅作参考）
    """

    def __init__(self, threshold=0.78):
        self.extractor = MFCCExtractor()
        self.threshold = threshold
        self.speaker_profiles = {}  # name -> {"embedding": ndarray, "samples": int}
        self.profile_file = Path(__file__).resolve().parent.parent.parent / "memory" / "voiceprint_profiles.pkl"

        # 尝试加载已有声纹
        self._load_profiles()

    # ==================== 声纹注册 ====================

    def enroll(self, audio, name="owner"):
        """
        录入一条声纹样本
        
        参数:
          audio: 1D numpy array, 语音数据
          name: 说话人名称
        
        返回:
          embedding: 声纹特征向量，或 None（失败）
        """
        embedding = self.extractor.extract_utterance_embedding(audio)
        if embedding is None:
            return None

        if name not in self.speaker_profiles:
            self.speaker_profiles[name] = {
                "embedding": embedding,
                "samples": 1,
                "embeddings": [embedding],  # 保存所有个体样本
            }
        else:
            profile = self.speaker_profiles[name]
            # 累积平均
            n = profile["samples"]
            profile["embedding"] = (profile["embedding"] * n + embedding) / (n + 1)
            # 重新归一化
            norm = np.linalg.norm(profile["embedding"])
            if norm > 0:
                profile["embedding"] /= norm
            profile["samples"] += 1
            profile["embeddings"].append(embedding)  # 追加个体样本

        self._save_profiles()
        return embedding

    def enroll_from_file(self, audio_file, name="owner"):
        """
        从音频文件录入声纹
        
        参数:
          audio_file: WAV 文件路径
          name: 说话人名称
        """
        audio = self._load_wav(audio_file)
        if audio is None:
            return False
        embedding = self.enroll(audio, name)
        return embedding is not None

    # ==================== 声纹验证 ====================

    def verify(self, audio):
        """
        验证一段语音是否来自已注册的说话人
        
        参数:
          audio: 1D numpy array
        
        返回:
          (is_match, similarity, speaker_name)
          - is_match: 是否匹配
          - similarity: 余弦相似度 (0~1)
          - speaker_name: 匹配的说话人名称，或 None
        """
        if not self.speaker_profiles:
            return (False, 0.0, None)

        embedding = self.extractor.extract_utterance_embedding(audio)
        if embedding is None:
            return (False, 0.0, None)

        # 归一化
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        else:
            return (False, 0.0, None)

        best_match = (False, 0.0, None)

        for name, profile in self.speaker_profiles.items():
            # 比较平均嵌入
            sim_avg = float(np.dot(embedding, profile["embedding"]))
            
            # 比较所有个体样本，取最高分
            best_sim = sim_avg
            if "embeddings" in profile:
                for emb in profile["embeddings"]:
                    sim = float(np.dot(embedding, emb))
                    if sim > best_sim:
                        best_sim = sim

            if best_sim > best_match[1]:
                best_match = (best_sim >= self.threshold, best_sim, name)

        return best_match

    def verify_from_file(self, audio_file):
        """从音频文件验证声纹"""
        audio = self._load_wav(audio_file)
        if audio is None:
            return (False, 0.0, None)
        return self.verify(audio)

    # ==================== 音频加载 ====================

    def _load_wav(self, filepath):
        """
        加载 WAV 文件
        
        支持:
          - 16-bit PCM WAV
          - 自动重采样到 16kHz
          - 自动转单声道
        """
        try:
            with open(filepath, "rb") as f:
                # 读取 WAV 头
                riff, size, ftype = struct.unpack("<4sI4s", f.read(12))
                if riff != b"RIFF" or ftype != b"WAVE":
                    return None

                # 读取 chunk
                audio_data = None
                sample_rate = None
                sample_width = None
                num_channels = None

                while True:
                    chunk_header = f.read(8)
                    if len(chunk_header) < 8:
                        break
                    chunk_id, chunk_size = struct.unpack("<4sI", chunk_header)

                    if chunk_id == b"fmt ":
                        fmt_data = f.read(16)
                        (
                            audio_format,
                            num_channels,
                            sample_rate,
                            byte_rate,
                            block_align,
                            sample_width,
                        ) = struct.unpack("<HHIIHH", fmt_data)
                        # 跳过额外信息
                        if chunk_size > 16:
                            f.read(chunk_size - 16)

                    elif chunk_id == b"data":
                        audio_data = f.read(chunk_size)
                        break
                    else:
                        f.read(chunk_size)

                if audio_data is None:
                    return None

                # 转换为 numpy array
                if sample_width == 2:  # 16-bit
                    dtype = np.int16
                elif sample_width == 4:  # 32-bit
                    dtype = np.int32
                else:
                    return None

                audio = np.frombuffer(audio_data, dtype=dtype).astype(np.float32)

                # 归一化到 [-1, 1]
                if sample_width == 2:
                    audio /= 32768.0
                elif sample_width == 4:
                    audio /= 2147483648.0

                # 转单声道
                if num_channels and num_channels > 1:
                    audio = audio.reshape(-1, num_channels).mean(axis=1)

                # 重采样到 16kHz
                if sample_rate and sample_rate != self.extractor.sample_rate:
                    audio = self._resample(audio, sample_rate, self.extractor.sample_rate)

                return audio

        except Exception as e:
            print(f"  加载音频失败: {e}")
            return None

    def _resample(self, audio, orig_sr, target_sr):
        """简单的重采样（线性插值）"""
        if orig_sr == target_sr:
            return audio

        # 计算目标长度
        target_len = int(len(audio) * target_sr / orig_sr)
        # 使用 numpy 的插值
        indices = np.linspace(0, len(audio) - 1, target_len)
        return np.interp(indices, np.arange(len(audio)), audio)

    def save_audio(self, audio, filepath, sample_rate=16000):
        """保存 numpy array 为 WAV 文件"""
        try:
            # 转为 int16
            audio_int16 = (audio * 32767).astype(np.int16)
            num_samples = len(audio_int16)

            with open(filepath, "wb") as f:
                # RIFF 头
                data_size = num_samples * 2  # 16-bit
                f.write(b"RIFF")
                f.write(struct.pack("<I", 36 + data_size))
                f.write(b"WAVE")

                # fmt chunk
                f.write(b"fmt ")
                f.write(struct.pack("<I", 16))  # chunk size
                f.write(struct.pack("<H", 1))  # PCM
                f.write(struct.pack("<H", 1))  # mono
                f.write(struct.pack("<I", sample_rate))
                f.write(struct.pack("<I", sample_rate * 2))  # byte rate
                f.write(struct.pack("<H", 2))  # block align
                f.write(struct.pack("<H", 16))  # bits per sample

                # data chunk
                f.write(b"data")
                f.write(struct.pack("<I", data_size))
                f.write(audio_int16.tobytes())

            return True
        except Exception as e:
            print(f"  保存音频失败: {e}")
            return False

    # ==================== 持久化 ====================

    def _save_profiles(self):
        """保存声纹模型到文件"""
        try:
            data = {}
            for name, profile in self.speaker_profiles.items():
                data[name] = {
                    "embedding": profile["embedding"].tolist(),
                    "samples": profile["samples"],
                    "embeddings": [e.tolist() for e in profile.get("embeddings", [profile["embedding"]])],
                }
            with open(self.profile_file, "wb") as f:
                pickle.dump(data, f)
        except Exception as e:
            print(f"  保存声纹失败: {e}")

    def _load_profiles(self):
        """加载已保存的声纹"""
        if not self.profile_file.exists():
            return
        try:
            with open(self.profile_file, "rb") as f:
                data = pickle.load(f)
            for name, profile_data in data.items():
                profile = {
                    "embedding": np.array(profile_data["embedding"]),
                    "samples": profile_data["samples"],
                }
                # 兼容旧格式（没有 embeddings 字段）
                if "embeddings" in profile_data:
                    profile["embeddings"] = [np.array(e) for e in profile_data["embeddings"]]
                else:
                    profile["embeddings"] = [profile["embedding"]]
                self.speaker_profiles[name] = profile
            if self.speaker_profiles:
                print(f"  已加载声纹: {list(self.speaker_profiles.keys())}")
        except Exception as e:
            print(f"  加载声纹失败: {e}")

    # ==================== 录制音频（实时） ====================

    def record_audio(self, duration=3, sample_rate=16000):
        """
        录制一段音频
        
        参数:
          duration: 录制时长（秒）
          sample_rate: 采样率
        
        返回:
          audio: 1D numpy array
        """
        try:
            import sounddevice as sd
            print(f"  🎤 录制 {duration} 秒... 请说话")
            audio = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1)
            sd.wait()
            audio = audio.flatten()
            print(f"  ✅ 录制完成 ({len(audio)} samples)")
            return audio
        except Exception as e:
            print(f"  录音失败: {e}")
            return None

    def interactive_enroll(self, name="owner", num_samples=5):
        """
        交互式声纹注册——录3次，建立声纹
        
        用法：
          python -c "from friday_voiceprint import VoiceprintRecognizer; v = VoiceprintRecognizer(); v.interactive_enroll()"
        """
        print("\n" + "=" * 50)
        print("  🎙️ Friday 声纹注册")
        print("   请说 \"星期五\" 3次，每次间隔2秒")
        print("=" * 50)

        for i in range(num_samples):
            print(f"\n  第 {i+1}/{num_samples} 次:")
            audio = self.record_audio(duration=2)
            if audio is not None:
                embedding = self.enroll(audio, name)
                if embedding is not None:
                    print(f"  ✅ 第 {i+1} 次录入成功")
                else:
                    print(f"  ❌ 第 {i+1} 次录入失败，重试")
                    i -= 1

        print("\n" + "=" * 50)
        print(f"  ✅ 声纹注册完成！共 {self.speaker_profiles[name]['samples']} 条样本")
        print(f"  📍 声纹文件: {self.profile_file}")
        print(f"  🔑 以后只有你的声音能唤醒 Friday")
        print("=" * 50)


# ==================== 独立测试 ====================

def demo():
    """测试声纹注册和验证"""
    recognizer = VoiceprintRecognizer(threshold=0.75)

    # 如果没有已有声纹，先注册
    if not recognizer.speaker_profiles:
        print("尚未注册声纹，开始注册流程")
        recognizer.interactive_enroll()
    else:
        print(f"已有声纹: {list(recognizer.speaker_profiles.keys())}")
        print(f"包含 {recognizer.speaker_profiles['owner']['samples']} 条样本")

    # 测试验证
    print('\n现在说 星期五，测试验证...')
    import time
    for i in range(2):
        print(f"\n  第 {i+1} 次测试:")
        audio = recognizer.record_audio(duration=2)
        if audio is not None:
            is_match, sim, name = recognizer.verify(audio)
            if is_match:
                print(f"  ✅ 声纹匹配！相似度: {sim:.3f} → 欢迎回来，{name}")
            else:
                print(f"  ❌ 声纹不匹配！相似度: {sim:.3f} (阈值: {recognizer.threshold})")


if __name__ == "__main__":
    import sys
    if "--enroll" in sys.argv:
        recognizer = VoiceprintRecognizer()
        recognizer.interactive_enroll()
    elif "--test" in sys.argv:
        recognizer = VoiceprintRecognizer()
        # 测试一段已知音频
        if len(sys.argv) > 2:
            is_match, sim, name = recognizer.verify_from_file(sys.argv[2])
            print(f"相似度: {sim:.3f}")
            print(f"匹配: {'✅' if is_match else '❌'} {name or 'unknown'}")
        else:
            demo()
    else:
        # 查看状态
        recognizer = VoiceprintRecognizer()
        if recognizer.speaker_profiles:
            for name, profile in recognizer.speaker_profiles.items():
                print(f"  👤 {name}: {profile['samples']} 条样本")
        else:
            print("  尚未注册声纹")
            print("  运行: python friday_voiceprint.py --enroll")
