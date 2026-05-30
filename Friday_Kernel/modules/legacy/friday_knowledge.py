#!/usr/bin/env python3
"""
Friday Knowledge — 知识库查询引擎（升级版 v2.0）
=================================================
P2.3：用自然语言查询 Obsidian 知识库。
v2.0 升级：新增语义向量搜索，不再依赖关键词机械匹配。

用法：
  「关于系统思维我知道什么」
  → Friday 语义搜索知识库 → 返回最相关段落

架构：
  SemanticKnowledgeQuery (主入口)
    ├── 语义搜索（Embedding + 余弦相似度） ← 优先使用
    └── 关键词搜索（关键字匹配） ← 降级方案

作者：Friday Kernel
版本：2.0.0
"""

import os
import re
from pathlib import Path

# ============ SSL 自动修复（Windows） ============
_local_cert = os.path.join(
    os.environ.get("LOCALAPPDATA", ""), ".certifi", "cacert.pem"
)
if os.path.exists(_local_cert):
    os.environ.setdefault("SSL_CERT_FILE", _local_cert)
    os.environ.setdefault("REQUESTS_CA_BUNDLE", _local_cert)

# ============ 配置 ============
VAULT_PATH = "F:/knowledge/知识库"
USE_SEMANTIC = True  # 是否启用语义搜索

# ============ 延迟导入语义索引 ============
_semantic_index = None

def _get_semantic_index():
    """获取 SemanticIndex 实例（单例，延迟加载）"""
    global _semantic_index
    if _semantic_index is None:
        try:
            from semantic_index import SemanticIndex
            _semantic_index = SemanticIndex(vault_path=VAULT_PATH)
            # 尝试加载已有索引，没有则构建
            if not _semantic_index._load():
                print("[Friday Knowledge] ⚠️ 语义索引未找到，尝试构建...")
                _semantic_index.build(verbose=False)
        except Exception as e:
            print(f"[Friday Knowledge] ⚠️ 语义索引加载失败: {e}")
            _semantic_index = False
    if _semantic_index is False:
        return None
    return _semantic_index


class SemanticKnowledgeQuery:
    """
    语义知识查询引擎（v2.0 主入口）
    
    用语义向量搜索替代关键词匹配，找得更准、更全。
    支持降级：语义搜索无结果时自动回退到关键词搜索。
    """
    
    def __init__(self, vault_path=None):
        self.vault = vault_path or VAULT_PATH
        # 保留旧引擎作为降级
        self._fallback = KnowledgeQuery(vault_path)
    
    def search(self, query, top_k=5):
        """
        语义搜索知识库。
        
        参数:
          query: 自然语言查询，如"系统思维的关键概念"
          top_k: 最多返回几条结果
        
        返回:
          [{"title": "...", "content": "...", "path": "...", "score": 0.0}, ...]
        """
        if not USE_SEMANTIC:
            return self._fallback.search(query)
        
        idx = _get_semantic_index()
        if idx is None:
            # 语义索引不可用，降级
            return self._fallback.search(query)
        
        # 确保索引已加载
        if idx.vectors is None:
            if not idx._load():
                # 尝试构建
                try:
                    idx.build(verbose=False)
                except Exception:
                    return self._fallback.search(query)
        
        # 执行语义搜索
        sem_results = idx.search(query, top_k=top_k, min_score=0.25)
        
        if not sem_results:
            # 语义搜索无结果，降级到关键词
            return self._fallback.search(query)
        
        # 转为标准格式
        results = []
        for r in sem_results:
            title = Path(r["path"]).stem
            results.append({
                "title": title,
                "content": r["text_preview"],
                "path": r["path"],
                "score": r["score"],
                "section": r.get("h2", ""),
                "source": "semantic",
            })
        
        return results
    
    def stats(self):
        """返回查询引擎统计信息"""
        idx = _get_semantic_index()
        if idx is not None and idx.vectors is not None:
            s = idx.stats()
            return {
                "engine": "semantic",
                "chunks": s["chunks"],
                "dimension": s["dimension"],
                "source_files": s["source_files"],
            }
        return {
            "engine": "keyword (fallback)",
            "chunks": 0,
            "source_files": 0,
        }
    
    def ask(self, query):
        """
        问一个问题，返回可直接回复的文字。
        
        参数:
          query: "关于系统思维我知道什么"
        
        返回:
          "根据知识库记录，关于系统思维有以下信息：..."
        """
        results = self.search(query)
        
        if not results:
            return f"知识库里没有找到关于「{query}」的信息"
        
        # 按来源分类
        semantic_results = [r for r in results if r.get("source") == "semantic"]
        keyword_results = [r for r in results if r.get("source") != "semantic"]
        
        lines = [f"关于「{query}」，知识库中有以下记录：", ""]
        
        # 语义结果优先展示
        display = semantic_results or keyword_results
        for i, r in enumerate(display[:5], 1):
            tag = "🧠" if r.get("source") == "semantic" else "📄"
            section_str = f" → {r['section']}" if r.get("section") else ""
            lines.append(f"{tag} {i}. [[{r['title']}]]{section_str}")
            # 取摘要第一句
            first_line = r["content"].split("\n")[0][:100]
            if first_line:
                lines.append(f"   {first_line}")
            lines.append(f"   相关度: {r['score']:.2f}")
            lines.append("")
        
        mode = "语义搜索" if semantic_results else "关键词搜索"
        lines.append(f"共找到 {len(results)} 条相关记录（{mode}）")
        return "\n".join(lines)


# ==================== 原引擎保留 ====================
# 以下为 v1.x 原始引擎，作为语义搜索的降级方案

class KnowledgeQuery:
    """知识库查询引擎（v1.x 关键词版，保留作为降级）"""
    
    def __init__(self, vault_path=None):
        self.vault = vault_path or VAULT_PATH
    
    def search(self, query):
        """
        关键词搜索知识库（降级方案）。
        """
        keywords = self._extract_keywords(query)
        if not keywords:
            return []
        
        results = []
        for root, dirs, files in os.walk(self.vault):
            if ".obsidian" in root:
                continue
            for f in files:
                if not f.endswith(".md"):
                    continue
                filepath = os.path.join(root, f)
                try:
                    with open(filepath, "r", encoding="utf-8") as fh:
                        content = fh.read()
                except Exception:
                    continue
                
                score = self._score(content, keywords)
                if score > 0:
                    title = f.replace(".md", "")
                    excerpt = self._extract_excerpt(content, keywords)
                    results.append({
                        "title": title,
                        "content": excerpt,
                        "path": filepath,
                        "score": score,
                        "source": "keyword",
                    })
        
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:5]
    
    def _extract_keywords(self, query):
        stopwords = {"关于", "什么", "怎么", "如何", "哪些", "这个", "那个",
                     "的", "了", "在", "是", "我", "有", "知道", "吗", "呢",
                     "啊", "吧", "嗯", "查询", "搜索", "找一下", "看看"}
        words = re.findall(r"[\w\u4e00-\u9fff]+", query)
        return [w for w in words if w not in stopwords and len(w) > 1]
    
    def _score(self, content, keywords):
        score = 0
        content_lower = content.lower()
        for kw in keywords:
            if re.search(rf"^#\s+.*{re.escape(kw)}", content, re.MULTILINE):
                score += 3
            count = content_lower.count(kw.lower())
            score += count * 0.5
            if re.search(rf"tags:.*{re.escape(kw)}", content):
                score += 2
        return score
    
    def _extract_excerpt(self, content, keywords):
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                content = parts[2]
        
        lines = content.split("\n")
        excerpt_lines = []
        for i, line in enumerate(lines):
            for kw in keywords:
                if kw.lower() in line.lower():
                    start = max(0, i - 1)
                    end = min(len(lines), i + 3)
                    for j in range(start, end):
                        if lines[j].strip() and lines[j] not in excerpt_lines:
                            excerpt_lines.append(lines[j].strip())
                    break
        if not excerpt_lines:
            for line in lines:
                if line.strip() and not line.startswith("---"):
                    excerpt_lines.append(line.strip())
                    if len(excerpt_lines) >= 5:
                        break
        return "\n".join(excerpt_lines[:8])
    
    def ask(self, query):
        results = self.search(query)
        if not results:
            return f"知识库里没有找到关于「{query}」的信息"
        lines = [f"关于「{query}」，知识库中有以下记录：", ""]
        for i, r in enumerate(results, 1):
            lines.append(f"{i}. [[{r['title']}]]")
            first_line = r["content"].split("\n")[0][:80]
            if first_line:
                lines.append(f"   {first_line}")
            lines.append("")
        lines.append(f"共找到 {len(results)} 条相关记录（关键词搜索）")
        return "\n".join(lines)


# ==================== 统一入口 ====================

def create(query_engine="auto"):
    """
    工厂方法：创建合适的知识查询引擎。
    
    参数:
      query_engine: "auto"（自动选择）/ "semantic" / "keyword"
    
    返回:
      KnowledgeQuery 兼容接口的实例
    """
    if query_engine == "keyword":
        return KnowledgeQuery()
    if query_engine == "semantic":
        return SemanticKnowledgeQuery()
    # auto：优先尝试语义，失败则降级
    return SemanticKnowledgeQuery()


# ==================== 快捷测试 ====================

if __name__ == "__main__":
    import sys
    
    engine = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in ("semantic", "keyword") else "auto"
    query = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else "Friday"
    
    kq = create(engine)
    print(f"\n引擎: {engine} 查询: {query}")
    print("=" * 50)
    result = kq.ask(query)
    print(result)
