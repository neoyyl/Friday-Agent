"""
Voice Service — 声纹 + 说话人管理 + 个性化
=============================================
统一语音服务层，整合：
  - 声纹识别 (VoiceprintRecognizer)
  - 多说话人注册/管理
  - EventBus 集成（说话人识别事件广播）
  - 个性化回应（识别人后切换到对应的称呼/语气）
  - Web API 后端（供管理面板调用）

依赖:
  friday_voiceprint.py — 底层声纹引擎 (MFCC)
  event_bus.py — 事件总线
"""

import json
import logging
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


class VoiceService:
    """
    统一语音服务

    功能:
      1. 声纹注册（录入说话人声音样本）
      2. 声纹识别（说话人是谁？）
      3. 说话人管理（增删改查）
      4. 个性化设置（每个说话人可配置称呼、语气偏好）
      5. EventBus 事件广播

    用法:
        voice_svc = VoiceService()
        voice_svc.register_speaker("小明", audio_data)
        speaker = voice_svc.identify(audio_data)
        # -> {"name": "小明", "similarity": 0.89, "greeting": "你好小明"}
    """

    def __init__(self, data_dir: str = None, event_bus=None):
        self.data_dir = data_dir or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "..", "data"
        )
        self._profiles_dir = os.path.join(self.data_dir, "speaker_profiles")
        os.makedirs(self._profiles_dir, exist_ok=True)

        self.event_bus = event_bus
        self._lock = threading.Lock()

        # 延迟加载声纹引擎（避免启动时加载 numpy）
        self._recognizer = None

        # 说话人个性化配置
        self._speaker_config = {}  # name -> dict
        self._config_file = os.path.join(self._profiles_dir, "speaker_config.json")
        self._load_config()

        # 当前说话人
        self._current_speaker = None  # name or None
        self._last_identify_time = 0

    @property
    def recognizer(self):
        if self._recognizer is None:
            from services.friday_voiceprint import VoiceprintRecognizer
            self._recognizer = VoiceprintRecognizer(threshold=0.75)
        return self._recognizer

    # ───────── 说话人注册 ─────────

    def register_speaker(self, name: str, audio_data: np.ndarray,
                         metadata: dict = None) -> dict:
        """
        注册一个说话人

        参数:
            name: 说话人名称（唯一标识）
            audio_data: numpy 音频数据 (float, [-1, 1], 16kHz)
            metadata: 额外元数据（如备注、注册日期）

        返回:
            {"success": bool, "samples": int, "name": str}
        """
        with self._lock:
            embedding = self.recognizer.enroll(audio_data, name=name)

            if embedding is None:
                return {"success": False, "error": "音频质量不足，无法提取声纹特征"}

            # 更新个性化配置
            if name not in self._speaker_config:
                self._speaker_config[name] = {
                    "name": name,
                    "alias": name,
                    "greeting": f"你好{name}",
                    "tone": "default",  # default / gentle / energetic
                    "created_at": datetime.now().isoformat(),
                    "sample_count": 1,
                }
            else:
                cfg = self._speaker_config[name]
                cfg["sample_count"] = cfg.get("sample_count", 0) + 1

            profile = self.recognizer.speaker_profiles.get(name, {})
            self._save_config()

        logger.info("Speaker registered: %s (%d samples)", name,
                     profile.get("samples", 1))

        return {
            "success": True,
            "name": name,
            "samples": profile.get("samples", 1),
            "embedding_dim": len(embedding) if embedding is not None else 0,
        }

    def register_from_file(self, name: str, wav_path: str) -> dict:
        """从 WAV 文件注册说话人"""
        audio = self.recognizer._load_wav(wav_path)
        if audio is None:
            return {"success": False, "error": f"无法加载音频文件: {wav_path}"}
        return self.register_speaker(name, audio)

    # ───────── 说话人识别 ─────────

    def identify(self, audio_data: np.ndarray,
                 min_confidence: float = 0.0) -> Optional[dict]:
        """
        识别说话人身份

        参数:
            audio_data: 音频数据
            min_confidence: 最低置信度（低于此值返回 None）

        返回:
            {"name": str, "similarity": float, "profile": dict} or None
        """
        is_match, similarity, name = self.recognizer.verify(audio_data)

        if name and is_match and similarity >= min_confidence:
            config = self._speaker_config.get(name, {})
            self._current_speaker = name
            self._last_identify_time = datetime.now().timestamp()

            result = {
                "name": name,
                "similarity": round(similarity, 4),
                "alias": config.get("alias", name),
                "greeting": config.get("greeting", f"你好{name}"),
                "tone": config.get("tone", "default"),
            }

            # 广播 EventBus 事件
            if self.event_bus:
                self.event_bus.emit("voice.speaker_identified", result)
                self.event_bus.emit("voice.speaker_identified", **result)

            logger.info("Speaker identified: %s (sim=%.4f)", name, similarity)
            return result

        return None

    def identify_from_file(self, wav_path: str) -> Optional[dict]:
        """从 WAV 文件识别说话人"""
        audio = self.recognizer._load_wav(wav_path)
        if audio is None:
            return None
        return self.identify(audio)

    # ───────── 说话人配置管理 ─────────

    def update_speaker_config(self, name: str, config: dict) -> dict:
        """更新说话人个性化配置"""
        with self._lock:
            if name not in self._speaker_config:
                return {"success": False, "error": f"说话人 {name} 不存在"}

            allowed_keys = {"alias", "greeting", "tone"}
            for k, v in config.items():
                if k in allowed_keys:
                    self._speaker_config[name][k] = v

            self._save_config()

        return {"success": True, "name": name, "config": self._speaker_config[name]}

    def delete_speaker(self, name: str) -> dict:
        """删除一个说话人"""
        with self._lock:
            if name not in self.recognizer.speaker_profiles:
                return {"success": False, "error": f"说话人 {name} 不存在"}

            del self.recognizer.speaker_profiles[name]
            self._speaker_config.pop(name, None)

            if self._current_speaker == name:
                self._current_speaker = None

            self._save_config()
            self._save_profiles()

        if self.event_bus:
            self.event_bus.emit("voice.speaker_deleted", name=name)

        logger.info("Speaker deleted: %s", name)
        return {"success": True, "name": name}

    def get_speakers(self) -> list:
        """获取所有说话人列表"""
        speakers = []
        for name, profile in self.recognizer.speaker_profiles.items():
            config = self._speaker_config.get(name, {})
            speakers.append({
                "name": name,
                "alias": config.get("alias", name),
                "samples": profile.get("samples", 1),
                "greeting": config.get("greeting", f"你好{name}"),
                "tone": config.get("tone", "default"),
                "created_at": config.get("created_at", ""),
                "is_current": (name == self._current_speaker),
            })
        return speakers

    def get_current_speaker(self) -> Optional[dict]:
        """获取当前识别的说话人"""
        if not self._current_speaker:
            return None
        config = self._speaker_config.get(self._current_speaker, {})
        return {
            "name": self._current_speaker,
            "alias": config.get("alias", self._current_speaker),
            "greeting": config.get("greeting", ""),
            "tone": config.get("tone", "default"),
        }

    def clear_current_speaker(self):
        """清除当前说话人（如对话结束）"""
        old = self._current_speaker
        self._current_speaker = None
        if self.event_bus and old:
            self.event_bus.emit("voice.speaker_cleared", name=old)

    # ───────── TTS 委托（Web API 用） ─────────

    def _get_tts_player(self):
        """延迟加载 StreamingTTSPlayer"""
        if not hasattr(self, '_tts_player') or self._tts_player is None:
            try:
                from audio.streaming_tts import StreamingTTSPlayer
                self._tts_player = StreamingTTSPlayer()
            except Exception as e:
                logger.warning("StreamingTTSPlayer 加载失败: %s", e)
                self._tts_player = None
        return self._tts_player

    def speak(self, text: str, tone: str = None) -> dict:
        """TTS 语音合成并播放"""
        player = self._get_tts_player()
        if not player:
            return {"success": False, "error": "TTS engine not available"}
        try:
            ok = player.speak(text, tone=tone)
            return {"success": ok, "text": text, "tone": tone}
        except Exception as e:
            logger.error("TTS speak failed: %s", e)
            return {"success": False, "error": str(e)}

    def stop(self):
        """停止 TTS 播放"""
        player = self._get_tts_player()
        if player:
            player.stop()
        return {"success": True}

    def get_status(self) -> dict:
        """获取 TTS 状态"""
        player = self._get_tts_player()
        if not player:
            return {"available": False}
        return {
            "available": True,
            "speaking": getattr(player, '_speaking', False),
        }

    def detect_tone(self, text: str) -> dict:
        """检测文本语气"""
        try:
            from audio.streaming_tts import detect_tone as _detect_tone
            tone = _detect_tone(text)
            return {"tone": tone}
        except Exception:
            return {"tone": "default"}

    # ───────── 个性化回应 ─────────

    def personalize_response(self, text: str) -> str:
        """
        根据当前说话人个性化回应

        示例: 替换 "用户" 为说话人名称
        """
        if not self._current_speaker:
            return text

        config = self._speaker_config.get(self._current_speaker, {})
        alias = config.get("alias", self._current_speaker)

        # 基础替换
        text = text.replace("用户", alias)
        text = text.replace("你好", f"{config.get('greeting', '你好')}")

        return text

    # ───────── 持久化 ─────────

    def _save_config(self):
        try:
            with open(self._config_file, "w", encoding="utf-8") as f:
                json.dump(self._speaker_config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("Failed to save speaker config: %s", e)

    def _load_config(self):
        if os.path.exists(self._config_file):
            try:
                with open(self._config_file, "r", encoding="utf-8") as f:
                    self._speaker_config = json.load(f)
            except Exception as e:
                logger.error("Failed to load speaker config: %s", e)

    def _save_profiles(self):
        """保存声纹特征到磁盘"""
        try:
            profile_file = self.recognizer.profile_file
            import pickle
            # 确保目录存在
            profile_file.parent.mkdir(parents=True, exist_ok=True)
            with open(profile_file, "wb") as f:
                pickle.dump(self.recognizer.speaker_profiles, f)
        except Exception as e:
            logger.error("Failed to save speaker profiles: %s", e)


# ───────── 全局单例 ─────────

_default_voice_service = None


def get_voice_service(event_bus=None):
    global _default_voice_service
    if _default_voice_service is None:
        _default_voice_service = VoiceService(event_bus=event_bus)
    return _default_voice_service
