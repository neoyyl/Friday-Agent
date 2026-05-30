"""
Emotion Service — 情感识别引擎
===============================
从文本和语音推断用户情绪状态，为拟人化交互提供基础。

双重引擎：
  1. 深度学习 (transformers) — 高精度情感分类
  2. 关键词规则 — 快速轻量，中英文支持

情绪模型:
  - 6 种基本情绪: happy / sad / angry / surprised / anxious / neutral
  - 强度: 0.0 ~ 1.0
  - 复合情绪: 如 "happy+surprised"

用法:
    from services.emotion_service import EmotionEngine
    engine = EmotionEngine()
    
    emotion = engine.analyze_text("今天真是太开心了！")
    # {"emotion": "happy", "intensity": 0.85, "confidence": 0.92}
    
    # 流式分析（对话中逐句更新）
    engine.update_conversation("user", "你好")
    engine.update_conversation("assistant", "你好！有什么可以帮你的？")
    state = engine.get_emotional_state()
    # {"current": "happy", "trend": "up", "history": [...], "dominant": "happy"}
"""

import json
import logging
import os
import re
import threading
from collections import Counter, deque
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


# ───────── 情绪定义 ─────────

EMOTIONS = ["happy", "sad", "angry", "surprised", "anxious", "neutral"]

EMOTION_LABELS_CN = {
    "happy": "开心",
    "sad": "难过",
    "angry": "生气",
    "surprised": "惊讶",
    "anxious": "焦虑",
    "neutral": "平静",
}

EMOTION_DISPLAY = {
    "happy": {"icon": "😊", "expression": "smile", "color": "#FFD700"},
    "sad": {"icon": "😢", "expression": "sad", "color": "#6B8EC4"},
    "angry": {"icon": "😠", "expression": "angry", "color": "#FF6B6B"},
    "surprised": {"icon": "😮", "expression": "surprised", "color": "#FFB347"},
    "anxious": {"icon": "😰", "expression": "worried", "color": "#9B8EC4"},
    "neutral": {"icon": "😐", "expression": "neutral", "color": "#B8B8B8"},
}


@dataclass
class EmotionResult:
    """单次分析结果"""
    emotion: str = "neutral"
    intensity: float = 0.0   # 0-1
    confidence: float = 0.0   # 0-1
    scores: dict = field(default_factory=dict)  # 各情绪得分
    source: str = "text"      # text / voice / combined
    timestamp: str = ""


@dataclass
class ConversationTurn:
    """对话轮次"""
    role: str          # user / assistant
    text: str
    emotion: EmotionResult = None
    timestamp: str = ""


@dataclass
class EmotionalState:
    """整体情绪状态"""
    current: str = "neutral"
    intensity: float = 0.0
    trend: str = "stable"     # up / down / stable
    dominant_emotions: list = field(default_factory=list)
    recent_history: list = field(default_factory=list)
    summary: str = ""


# ───────── 关键词规则引擎 ─────────

# 中文情绪关键词
CN_KEYWORDS = {
    "happy": [
        "开心", "高兴", "快乐", "太好", "棒", "赞", "喜欢", "爱",
        "哈哈", "呵呵", "不错", "完美", "厉害", "优秀", "感谢",
        "太好了", "真棒", "好开心", "幸福", "满足", "期待",
    ],
    "sad": [
        "难过", "伤心", "悲伤", "失望", "遗憾", "可惜", "唉",
        "不开心", "郁闷", "沮丧", "痛苦", "孤独", "寂寞",
        "哭", "泪", "想哭", "不开心", "难受",
    ],
    "angry": [
        "生气", "愤怒", "烦", "讨厌", "可恶", "受不了", "气死",
        "恼火", "不满", "抱怨", "滚", "闭嘴", "烦死了",
        "忍不了", "过分", "有病", "垃圾",
    ],
    "surprised": [
        "哇", "天哪", "真的吗", "不敢相信", "惊讶", "竟然",
        "居然", "没想到", "神奇", "震惊", "意外", "咦",
        "wow", "想不到", "厉害了",
    ],
    "anxious": [
        "担心", "焦虑", "紧张", "害怕", "不安", "慌",
        "怎么办", "糟了", "完蛋", "急", "来不及",
        "压力", "焦虑", "愁", "担心", "忐忑",
    ],
}

# 英文情绪关键词
EN_KEYWORDS = {
    "happy": ["happy", "great", "awesome", "love", "wonderful", "amazing",
              "excellent", "fantastic", "perfect", "thanks", "good", "nice",
              "delighted", "joy", "excited", "yay", "woohoo"],
    "sad": ["sad", "unhappy", "disappointed", "sorry", "regret", "unfortunate",
            "depressed", "lonely", "hurt", "cry", "miserable", "heartbroken"],
    "angry": ["angry", "mad", "furious", "annoyed", "hate", "terrible",
              "horrible", "awful", "shut up", "stop", "enough", "ridiculous"],
    "surprised": ["wow", "really", "unbelievable", "surprising", "amazing",
                  "shocked", "unexpected", "incredible", "no way", "omg"],
    "anxious": ["worried", "anxious", "nervous", "scared", "afraid", "panic",
                "stress", "fear", "concerned", "uneasy", "desperate"],
}

# 感叹号 / 问号 / 语气助词 增强器
INTENSITY_BOOSTERS = {
    "!": 0.15,
    "？": 0.10,
    "？!": 0.20,
    "！！！": 0.30,
    "？？": 0.15,
    "~": 0.05,
}


# ───────── Emotion Engine ─────────

class EmotionEngine:
    """
    情感识别引擎

    支持:
      - 文本情感分析（transformers + 关键词混合）
      - 对话流式分析
      - 情绪趋势追踪
      - 历史窗口管理
    """

    def __init__(self, window_size: int = 20):
        self._window_size = window_size
        self._conversation: deque[ConversationTurn] = deque(maxlen=window_size)
        self._history: list[EmotionResult] = []
        self._lock = threading.Lock()
        self._classifier = None  # lazy load transformers

    # ───────── 文本分析 ─────────

    def analyze_text(self, text: str) -> EmotionResult:
        """
        分析单句文本的情绪。

        策略：
          1. 尝试 transformers pipeline（高精度）
          2. 回退到关键词规则引擎
        """
        if not text or not text.strip():
            return EmotionResult(emotion="neutral", timestamp=datetime.now().isoformat())

        # 尝试深度学习
        if self._classifier is not None:
            try:
                return self._dl_analyze(text)
            except Exception as e:
                logger.debug("DL emotion failed, fallback: %s", e)

        # 关键词规则
        return self._rule_analyze(text)

    def _ensure_classifier(self):
        """懒加载 transformers 情感分类器"""
        if self._classifier is not None:
            return True
        try:
            from transformers import pipeline
            # 使用轻量模型
            self._classifier = pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                device=-1,  # CPU
                top_k=None,
            )
            logger.info("Emotion DL classifier loaded (distilbert)")
            return True
        except Exception as e:
            logger.warning("Failed to load DL classifier: %s", e)
            self._classifier = False  # 标记为不可用
            return False

    def _dl_analyze(self, text: str) -> EmotionResult:
        """深度学习情感分析"""
        self._ensure_classifier()
        if not self._classifier:
            return self._rule_analyze(text)

        result = self._classifier(text[:512])
        # distilbert 返回 POSITIVE/NEGATIVE，映射到我们的情绪
        scores = {"positive": 0, "negative": 0}
        for item in result:
            if isinstance(item, dict):
                scores[item["label"].lower()] = item["score"]

        # 映射到 6 分类
        emotion_scores = dict.fromkeys(EMOTIONS, 0.0)
        if scores.get("positive", 0) > 0.6:
            # 检查是否有 happy 关键词
            if any(kw in text.lower() for kw in EN_KEYWORDS["happy"]):
                emotion_scores["happy"] = scores["positive"]
            else:
                emotion_scores["neutral"] = scores["positive"]
        else:
            # 检查具体负面情绪
            text_lower = text.lower()
            neg_score = scores.get("negative", 0)
            if any(kw in text_lower for kw in EN_KEYWORDS["angry"]):
                emotion_scores["angry"] = neg_score
            elif any(kw in text_lower for kw in EN_KEYWORDS["sad"]):
                emotion_scores["sad"] = neg_score
            elif any(kw in text_lower for kw in EN_KEYWORDS["anxious"]):
                emotion_scores["anxious"] = neg_score
            else:
                emotion_scores["neutral"] = 1.0 - neg_score

        dominant = max(emotion_scores, key=emotion_scores.get)
        return EmotionResult(
            emotion=dominant,
            intensity=emotion_scores[dominant],
            confidence=scores.get("positive", 0.5),
            scores=emotion_scores,
            source="dl",
            timestamp=datetime.now().isoformat(),
        )

    def _rule_analyze(self, text: str) -> EmotionResult:
        """关键词规则引擎情感分析"""
        scores = dict.fromkeys(EMOTIONS, 0.0)

        # 中英文匹配
        for emotion, keywords in CN_KEYWORDS.items():
            for kw in keywords:
                if kw in text:
                    scores[emotion] += 1.0

        for emotion, keywords in EN_KEYWORDS.items():
            for kw in keywords:
                if kw.lower() in text.lower():
                    scores[emotion] += 1.0

        # 增强器
        for booster, boost in INTENSITY_BOOSTERS.items():
            if booster in text:
                # 增强最可能的情绪
                dominant = max(scores, key=scores.get)
                if scores[dominant] > 0:
                    scores[dominant] += boost

        # 归一化
        max_score = max(scores.values()) if any(scores.values()) else 0
        if max_score > 0:
            for k in scores:
                scores[k] = min(1.0, scores[k] / max(1.0, max_score + 2))

        # 无匹配 → neutral
        if max_score < 0.01:
            scores["neutral"] = 0.8

        # 提取 dominant
        dominant = max(scores, key=scores.get)
        intensity = scores[dominant]

        return EmotionResult(
            emotion=dominant,
            intensity=intensity,
            confidence=min(1.0, max_score * 0.3),
            scores=scores,
            source="rule",
            timestamp=datetime.now().isoformat(),
        )

    # ───────── 对话流分析 ─────────

    def update_conversation(self, role: str, text: str) -> EmotionResult:
        """更新对话轮次并分析"""
        emotion = self.analyze_text(text)

        turn = ConversationTurn(
            role=role,
            text=text,
            emotion=emotion,
            timestamp=datetime.now().isoformat(),
        )

        with self._lock:
            self._conversation.append(turn)
            self._history.append(emotion)

        return emotion

    def get_emotional_state(self) -> dict:
        """获取当前整体情绪状态"""
        with self._lock:
            if not self._conversation:
                return asdict(EmotionalState())

            # 最近 3 轮的情绪
            recent = list(self._conversation)[-3:]
            user_turns = [t for t in recent if t.role == "user"]

            if not user_turns:
                return asdict(EmotionalState(current="neutral"))

            # 取最后一轮用户情绪
            last_user = user_turns[-1]
            current_emotion = last_user.emotion.emotion if last_user.emotion else "neutral"
            current_intensity = last_user.emotion.intensity if last_user.emotion else 0.0

            # 趋势分析
            if len(self._history) >= 3:
                recent_3 = self._history[-3:]
                happy_count = sum(1 for e in recent_3 if e.emotion == "happy")
                sad_count = sum(1 for e in recent_3 if e.emotion in ("sad", "angry"))
                if happy_count >= 2:
                    trend = "up"
                elif sad_count >= 2:
                    trend = "down"
                else:
                    trend = "stable"
            else:
                trend = "stable"

            # 主导情绪
            if len(self._history) >= 5:
                recent_5 = self._history[-5:]
                emotion_counts = Counter(e.emotion for e in recent_5)
                dominant = emotion_counts.most_common(3)
            else:
                dominant = [(current_emotion, 1)]

            # 摘要
            if current_emotion != "neutral":
                cn = EMOTION_LABELS_CN.get(current_emotion, current_emotion)
                summary = f"用户情绪: {cn} (强度: {current_intensity:.0%})"
            else:
                summary = "情绪平稳"

            return {
                "current": current_emotion,
                "intensity": current_intensity,
                "trend": trend,
                "dominant_emotions": [
                    {"emotion": e, "label": EMOTION_LABELS_CN.get(e, e),
                     "display": EMOTION_DISPLAY.get(e, {})}
                    for e, _ in dominant
                ],
                "summary": summary,
                "history": [
                    {"role": t.role, "emotion": t.emotion.emotion if t.emotion else "neutral",
                     "text": t.text[:50]}
                    for t in list(self._conversation)[-10:]
                ],
            }

    # ───────── 颜色/显示 ─────────

    def get_emotion_display(self, emotion: str = None) -> dict:
        """获取情绪对应的显示信息"""
        if not emotion:
            state = self.get_emotional_state()
            emotion = state.get("current", "neutral")
        return EMOTION_DISPLAY.get(emotion, EMOTION_DISPLAY["neutral"])

    def get_expression_target(self, emotion: str = None) -> str:
        """获取目标表情名称"""
        display = self.get_emotion_display(emotion)
        return display.get("expression", "neutral")

    # ───────── 序列化 ─────────

    def get_conversation_log(self, limit: int = 20) -> list:
        """获取最近对话日志"""
        with self._lock:
            return [
                {
                    "role": t.role,
                    "text": t.text[:100],
                    "emotion": t.emotion.emotion if t.emotion else None,
                    "time": t.timestamp,
                }
                for t in list(self._conversation)[-limit:]
            ]


# ───────── 全局单例 ─────────

_default_engine = None


def get_emotion_engine():
    global _default_engine
    if _default_engine is None:
        _default_engine = EmotionEngine()
    return _default_engine
