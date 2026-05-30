#!/usr/bin/env python3
"""
KnowledgeEngine — 语义知识搜索 + 本地 LLM 推理
=================================================
从 friday_all 剥离，纯业务逻辑，无总线依赖。

用法：
  engine = KnowledgeEngine()
  engine.ensure_ready()
  result = engine.query("你的问题")

作者：Friday Kernel
版本：2.0.0
"""

import sys
import os
import threading
import time
import re
from pathlib import Path

# 路径引导（被 friday_all 导入时，modules/ 已在 sys.path 中）
_MODULE_ROOT = str(Path(__file__).parent.parent)
if _MODULE_ROOT not in sys.path:
    sys.path.insert(0, _MODULE_ROOT)
    sys.path.insert(0, str(Path(_MODULE_ROOT) / "services"))
    sys.path.insert(1, str(Path(_MODULE_ROOT) / "legacy"))

from friday_knowledge import SemanticKnowledgeQuery
from local_llm import LocalLLM


class KnowledgeEngine:
    """
    知识引擎：语义搜索 + 本地推理
    封装了 SemanticKnowledgeQuery 和 LocalLLM 的完整查询管线。
    """

    def __init__(self):
        self._semantic = None
        self._llm = None
        self._ready = False
        self._llm_loading_thread = None
        self._llm_load_start = 0.0

    def ensure_ready(self):
        """初始化（语义索引 + 后台预加载 LLM）"""
        if self._ready:
            return True

        # 1. 加载语义索引
        try:
            self._semantic = SemanticKnowledgeQuery()
            stats = self._semantic.stats()
            if stats.get("chunks", 0) > 0:
                print(f"  🧠 语义索引就绪: {stats['chunks']} 段落")
            else:
                print("  ⚠️ 语义索引为空")
        except Exception as e:
            print(f"  ⚠️ 语义索引加载失败: {e}")
            self._semantic = None

        # 2. 后台预加载 LLM（4.4GB）
        self._llm = LocalLLM()
        self._llm_load_start = time.time()
        self._llm_loading_thread = threading.Thread(
            target=self._load_llm_task, daemon=True
        )
        self._llm_loading_thread.start()

        self._ready = True
        return True

    def _load_llm_task(self):
        """后台加载 LLM 的任务"""
        try:
            self._llm.load()
        except Exception as e:
            print(f"  ⚠️ 后台 LLM 加载失败: {e}")

    @property
    def llm_ready(self):
        """LLM 是否已就绪"""
        return self._llm is not None and self._llm.is_ready

    def wait_for_llm(self, timeout=60):
        """等待 LLM 加载完成"""
        if self._llm is not None and self._llm.is_ready:
            return True
        if self._llm_loading_thread and self._llm_loading_thread.is_alive():
            self._llm_loading_thread.join(timeout=timeout)
        return self._llm is not None and self._llm.is_ready

    def query(self, text: str, use_llm=True) -> dict:
        """
        处理一条查询文本，返回结构化结果。

        返回格式:
          {"type": "answer"|"knowledge"|"command"|"error",
           "text": str, "sources": [str], "source_count": int}
        """
        text = text.strip()
        if not text:
            return {"type": "error", "text": "没有听到内容", "sources": [], "source_count": 0}

        if text in ("拜拜", "再见", "bye", "结束", "退出"):
            return {"type": "command", "text": "拜拜", "sources": [], "source_count": 0}

        if re.match(r"^(搜索|查询|找|查|search)\s*", text):
            query_text = re.sub(r"^(搜索|查询|找|查|search)\s*", "", text, flags=re.IGNORECASE)
            return self._do_knowledge_search(query_text)

        return self._do_knowledge_search(text, use_llm=use_llm)

    def _do_knowledge_search(self, query_text: str, use_llm=True) -> dict:
        """执行知识库搜索 + 可选 LLM 推理"""
        if self._semantic:
            try:
                results = self._semantic.search(query_text, top_k=5)
            except Exception:
                results = []
        else:
            results = []

        sources = []
        for r in results[:3]:
            title = r.get("title", "")
            section = r.get("section", "")
            score = r.get("score", 0)
            if section:
                sources.append(f"[[{title}]] → {section} ({score:.2f})")
            else:
                sources.append(f"[[{title}]] ({score:.2f})")

        source_count = len(results)

        if source_count > 0 and use_llm:
            llm_answer = self._try_llm(query_text)
            if llm_answer:
                return {
                    "type": "answer",
                    "text": llm_answer,
                    "sources": sources,
                    "source_count": source_count,
                }

        if source_count > 0:
            summary_parts = [f"关于「{query_text}」，我在知识库中找到以下信息："]
            for i, r in enumerate(results[:3], 1):
                title = r.get("title", "")
                content = r.get("content", "")
                short = content[:150].split("\n")[0] if content else ""
                if short:
                    summary_parts.append(f"\n{i}. [[{title}]]\n   {short}")
            summary_parts.append(f"\n共找到 {source_count} 条相关记录")
            return {
                "type": "knowledge",
                "text": "\n".join(summary_parts),
                "sources": sources,
                "source_count": source_count,
            }

        if use_llm:
            llm_answer = self._try_llm(query_text)
            if llm_answer:
                return {
                    "type": "answer",
                    "text": llm_answer,
                    "sources": ["💡 LLM 回答（未使用知识库）"],
                    "source_count": 0,
                }

        return {
            "type": "knowledge",
            "text": f"知识库里没有找到关于「{query_text}」的信息",
            "sources": [],
            "source_count": 0,
        }

    def _try_llm(self, query_text: str) -> str:
        """尝试用本地 LLM 回答问题"""
        try:
            if self._llm is None:
                self._llm = LocalLLM()
            if not self._llm.is_ready:
                elapsed = time.time() - self._llm_load_start
                if self._llm_loading_thread and self._llm_loading_thread.is_alive():
                    print(f"  🤖 LLM 后台加载中（{elapsed:.0f}s），再等一下...")
                    self._llm_loading_thread.join(timeout=15)
                elif not self._llm.is_ready:
                    print("  🤖 加载本地 LLM（首次约 10-30s）...")
                    self._llm.load()
            if self._llm.is_ready:
                answer = self._llm.chat(query_text, use_knowledge=True)
                if answer and not answer.startswith("[LocalLLM] ❌") and not answer.startswith("[LocalLLM] ⚠️"):
                    return answer
        except Exception as e:
            print(f"  ⚠️ LLM 推理失败: {e}")
        return ""

    def unload_llm(self):
        """卸载 LLM 释放内存"""
        if self._llm is not None:
            try:
                self._llm.unload()
            except Exception:
                pass
            self._llm = None
            print("  🔌 本地 LLM 已卸载，内存已释放")
