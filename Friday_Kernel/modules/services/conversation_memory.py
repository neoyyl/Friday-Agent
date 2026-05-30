"""
Conversation Memory — 持续对话 + 分层记忆系统
==============================================
永不结束的会话，长期上下文管理。

三层记忆架构:
  Buffer (~5轮)  →  Recent (~50轮)  →  Archive (摘要)
    工作记忆         短期上下文          长期知识

核心能力：
  - 自动摘要：超过阈值后自动压缩旧对话
  - 关键信息持久化：用户偏好、事实、TODO
  - 分层检索：先查 buffer → recent → archive
  - 关联记忆：按主题/人物/项目分组

用法:
    memory = ConversationMemory()
    memory.add("user", "我叫小明")
    memory.add("assistant", "你好小明！")
    
    context = memory.get_context()  # 获取完整上下文
    facts = memory.get_facts()      # 获取关键信息
"""

import json
import logging
import os
import re
import threading
from collections import defaultdict, deque
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# 阈值配置
BUFFER_SIZE = 5          # 工作记忆轮次
RECENT_SIZE = 50         # 短期记忆轮次
ARCHIVE_AFTER = 30       # 超过多少轮触发归档摘要
SUMMARIZE_EVERY = 20     # 每 N 轮自动摘要


@dataclass
class MemoryEntry:
    """记忆条目"""
    id: str
    role: str           # user / assistant / system
    content: str
    timestamp: str = ""
    emotion: str = ""
    topic: str = ""
    summary: str = ""    # 摘要（archive 层）
    metadata: dict = field(default_factory=dict)


@dataclass
class Factoid:
    """关键信息（知识）"""
    id: str
    category: str        # preference / fact / todo / personal
    key: str
    value: str
    source: str = ""     # 来源
    confidence: float = 1.0
    created_at: str = ""
    updated_at: str = ""


@dataclass
class ConversationSummary:
    """对话摘要"""
    id: str
    period: str          # time range
    summary: str
    topics: list = field(default_factory=list)
    key_points: list = field(default_factory=list)
    entry_count: int = 0


class ConversationMemory:
    """
    分层对话记忆系统

    层级：
      Level 1 (Buffer): 最近 5 轮，完整保留
      Level 2 (Recent): 最近 50 轮，自动摘要
      Level 3 (Archive): 超过 50 轮的压缩摘要

    关键信息提取：
      - 用户偏好（"我喜欢..." "我不喜欢..."）
      - 事实陈述（"我是..." "我在..."）
      - 待办事项（"我要..." "请帮我..."）
    """

    def __init__(self, data_dir: str = None):
        self.data_dir = data_dir or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data"
        )
        self._mem_file = os.path.join(self.data_dir, "conversation_memory.json")
        self._facts_file = os.path.join(self.data_dir, "conversation_facts.json")

        # 三层记忆
        self._buffer: deque[MemoryEntry] = deque(maxlen=BUFFER_SIZE)
        self._recent: deque[MemoryEntry] = deque(maxlen=RECENT_SIZE)
        self._archive: list[ConversationSummary] = []

        # 关键信息
        self._facts: dict[str, Factoid] = {}  # key -> Factoid

        self._lock = threading.RLock()
        self._total_entries = 0
        self._last_summary_index = 0
        self._load()
        self._session_id = datetime.now().strftime("%Y%m%d-%H%M%S")

    # ───────── 添加对话 ─────────

    def add(self, role: str, content: str, emotion: str = "",
            topic: str = "", metadata: dict = None) -> str:
        """添加一轮对话"""
        import uuid
        entry = MemoryEntry(
            id=str(uuid.uuid4())[:8],
            role=role,
            content=content,
            timestamp=datetime.now().isoformat(),
            emotion=emotion,
            topic=topic,
            metadata=metadata or {},
        )

        with self._lock:
            self._buffer.append(entry)
            self._recent.append(entry)
            self._total_entries += 1

            # 自动提取关键信息
            if role == "user":
                self._extract_facts(entry)

            # 检查是否需要归档摘要
            if self._total_entries - self._last_summary_index >= SUMMARIZE_EVERY:
                self._auto_summarize()

            self._save()

        return entry.id

    # ───────── 上下文获取 ─────────

    def get_context(self, max_turns: int = 20) -> list[dict]:
        """
        获取用于 LLM 的上下文。

        返回: [{role, content, ...}]
          优先从 buffer 取，不足从 recent 补。
        """
        with self._lock:
            # Buffer (完整)
            buffer_list = list(self._buffer)
            remaining = max_turns - len(buffer_list)

            context = []
            if remaining > 0 and self._archive:
                # 加入最近的归档摘要
                archive_summary = self._archive[-1].summary if self._archive else ""
                if archive_summary:
                    context.append({
                        "role": "system",
                        "content": f"[对话历史摘要]\n{archive_summary}",
                        "type": "summary",
                    })

            if remaining > 0:
                # 从 recent 补充（跳过已在 buffer 中的）
                recent_list = list(self._recent)
                buffer_ids = {e.id for e in buffer_list}
                extra = [e for e in recent_list if e.id not in buffer_ids]
                for e in extra[-remaining:]:
                    context.append(self._entry_to_dict(e))

            # Buffer 完整保留
            for e in buffer_list:
                context.append(self._entry_to_dict(e))

            # 关键信息
            facts = self.get_facts_text()
            if facts:
                context.append({
                    "role": "system",
                    "content": f"[关于用户]\n{facts}",
                    "type": "facts",
                })

            return context

    def _entry_to_dict(self, entry: MemoryEntry) -> dict:
        d = {"role": entry.role, "content": entry.content}
        if entry.emotion:
            d["emotion"] = entry.emotion
        return d

    # ───────── 关键信息提取 ─────────

    def _extract_facts(self, entry: MemoryEntry):
        """从用户输入中提取关键信息"""
        text = entry.content

        # 偏好提取: "我喜欢/不喜欢/爱/讨厌 ..."
        patterns = [
            (r'(?:我|俺)(?:喜欢|爱|欣赏|中意)\s*(.*?)(?:[。！？\n]|$)', "preference"),
            (r'(?:我|俺)(?:不喜欢|讨厌|烦|受不了)\s*(.*?)(?:[。！？\n]|$)', "preference"),
            (r'(?:我|俺)(?:是|叫|叫名字)\s*(.*?)(?:[。！？\n,，]|$)', "fact"),
            (r'(?:我|俺)(?:在|就职|工作于|就读|学习)\s*(.*?)(?:[。！？\n]|$)', "fact"),
            (r'(?:我|俺)(?:想|要|打算|准备)\s*(.*?)(?:[。！？\n]|$)', "todo"),
            (r'(?:请|求|帮)(?:你|帮我)\s*(.*?)(?:[。！？\n]|$)', "todo"),
            (r'(?:我|俺)(?:的|有)\s*([^\s，。]{2,10})(?:\s*是|为)\s*(.*?)(?:[。！？\n]|$)', "fact"),
        ]

        for pattern, category in patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                if isinstance(match, tuple):
                    key, value = match[0].strip(), match[1].strip()
                else:
                    key = match.strip()
                    value = match.strip()

                if key and len(key) > 1:
                    fact_key = f"{category}_{key[:20]}"
                    self._upsert_fact(Factoid(
                        id=fact_key,
                        category=category,
                        key=key[:50],
                        value=value[:200] or key[:50],
                        source="conversation",
                        created_at=datetime.now().isoformat(),
                        updated_at=datetime.now().isoformat(),
                    ))

    def _upsert_fact(self, fact: Factoid):
        """更新或插入事实"""
        with self._lock:
            key = fact.key
            if key in self._facts:
                old = self._facts[key]
                old.value = fact.value
                old.updated_at = datetime.now().isoformat()
                old.confidence = min(1.0, old.confidence + 0.1)
            else:
                self._facts[key] = fact

    def get_facts(self, category: str = None) -> list[dict]:
        """获取关键信息"""
        with self._lock:
            facts = self._facts.values()
            if category:
                facts = [f for f in facts if f.category == category]
            return [asdict(f) for f in sorted(facts, key=lambda x: x.updated_at, reverse=True)]

    def get_facts_text(self) -> str:
        """获取可读的关键信息文本"""
        facts = self.get_facts()
        if not facts:
            return ""
        lines = []
        for f in facts:
            cat = f.get("category", "")
            key = f.get("key", "")
            value = f.get("value", "")
            if cat == "preference":
                lines.append(f"- 偏好: {key}")
            elif cat == "todo":
                lines.append(f"- 待办: {value}")
            elif cat == "fact":
                lines.append(f"- 信息: {key}")
            else:
                lines.append(f"- {key}: {value}")
        return "\n".join(lines)

    # ───────── 自动摘要 ─────────

    def _auto_summarize(self):
        """自动归档摘要"""
        recent_entries = list(self._recent)
        if len(recent_entries) < 5:
            return

        # 提取话题和关键点
        all_text = " ".join(e.content for e in recent_entries)
        topics = self._extract_topics(all_text)

        # 生成摘要（简单截取策略）
        user_lines = [e.content for e in recent_entries[-10:] if e.role == "user"]
        summary_text = "; ".join(user_lines[-5:]) if user_lines else all_text[:200]

        summary = ConversationSummary(
            id=datetime.now().strftime("%H%M%S"),
            period=f"{recent_entries[0].timestamp[:19]} ~ {recent_entries[-1].timestamp[:19]}",
            summary=summary_text[:300],
            topics=topics,
            entry_count=len(recent_entries),
        )
        self._archive.append(summary)
        self._last_summary_index = self._total_entries

        # 保留最近 20 个摘要
        if len(self._archive) > 20:
            self._archive = self._archive[-20:]

        logger.info("Memory auto-summarized: %d topics, %d entries", len(topics), summary.entry_count)

    def _extract_topics(self, text: str) -> list[str]:
        """提取话题"""
        # 简单的关键词提取
        import re
        words = re.findall(r'[\w\u4e00-\u9fff]{2,}', text)
        stop_words = {"可以", "这个", "那个", "什么", "怎么", "没有", "不是",
                      "就是", "还是", "因为", "所以", "但是", "如果", "已经"}
        word_counts = defaultdict(int)
        for w in words:
            if w not in stop_words:
                word_counts[w] += 1
        return [w for w, _ in sorted(word_counts.items(), key=lambda x: -x[1])[:10]]

    # ───────── 统计 ─────────

    def get_stats(self) -> dict:
        """获取记忆统计"""
        with self._lock:
            return {
                "session_id": self._session_id,
                "total_entries": self._total_entries,
                "buffer": len(self._buffer),
                "recent": len(self._recent),
                "archives": len(self._archive),
                "facts": {
                    "total": len(self._facts),
                    "preferences": sum(1 for f in self._facts.values() if f.category == "preference"),
                    "facts": sum(1 for f in self._facts.values() if f.category == "fact"),
                    "todos": sum(1 for f in self._facts.values() if f.category == "todo"),
                },
            }

    # ───────── 持久化 ─────────

    def _save(self):
        try:
            data = {
                "session_id": self._session_id,
                "total_entries": self._total_entries,
                "last_summary_index": self._last_summary_index,
                "recent": [asdict(e) for e in list(self._recent)[-100:]],  # 保存最近100条
                "archive": [asdict(s) for s in self._archive],
            }
            with open(self._mem_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            facts_data = [asdict(f) for f in self._facts.values()]
            with open(self._facts_file, "w", encoding="utf-8") as f:
                json.dump(facts_data, f, ensure_ascii=False, indent=2)

        except Exception as e:
            logger.error("Failed to save memory: %s", e)

    def _load(self):
        # 加载记忆
        if os.path.exists(self._mem_file):
            try:
                with open(self._mem_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._total_entries = data.get("total_entries", 0)
                self._last_summary_index = data.get("last_summary_index", 0)
                for item in data.get("recent", []):
                    self._recent.append(MemoryEntry(**item))
                for item in data.get("archive", []):
                    self._archive.append(ConversationSummary(**item))
            except Exception as e:
                logger.error("Failed to load memory: %s", e)

        # 加载事实
        if os.path.exists(self._facts_file):
            try:
                with open(self._facts_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for item in data:
                    fact = Factoid(**item)
                    self._facts[fact.key] = fact
            except Exception as e:
                logger.error("Failed to load facts: %s", e)


# ───────── 全局单例 ─────────

_default_memory = None


def get_memory():
    global _default_memory
    if _default_memory is None:
        _default_memory = ConversationMemory()
    return _default_memory
