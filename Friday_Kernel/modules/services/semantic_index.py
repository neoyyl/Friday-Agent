#!/usr/bin/env python3
"""
Friday Semantic Index — 知识库语义向量索引引擎
================================================
零号升级：把知识库建成一个可语义检索的向量索引。

核心功能：
  1. 遍历知识库 → 按章节切分 → 生成嵌入向量
  2. 查询时用余弦相似度找最相关的段落
  3. 增量更新：只重新索引发生变化的文件

用法：
  from semantic_index import SemanticIndex
  
  idx = SemanticIndex()
  idx.build()              # 完整构建索引
  results = idx.search("系统思维")  # 语义搜索
  idx.update()             # 增量更新（只处理新/改过的文件）

作者：Friday Kernel
版本：1.0.0
"""

import os
import re
import json
import time
import hashlib
from pathlib import Path

# ============ SSL 自动修复（Windows） ============
_local_cert = os.path.join(
    os.environ.get("LOCALAPPDATA", ""), ".certifi", "cacert.pem"
)
if os.path.exists(_local_cert):
    os.environ.setdefault("SSL_CERT_FILE", _local_cert)
    os.environ.setdefault("REQUESTS_CA_BUNDLE", _local_cert)

import numpy as np

# ============ 配置区 ============
VAULT_PATH = "F:/knowledge/知识库"
INDEX_DIR = os.path.join(os.path.dirname(__file__), "..", "memory", "semantic_index")

# ============ 第一性原理层级 ============
FP_LEVEL_UNKNOWN = -1      # 未分类（默认）
FP_LEVEL_AXIOM = 0         # L0: 基本公理 — 不可否认的真理
FP_LEVEL_DERIVED = 1       # L1: 推导知识 — 从公理推导而来
FP_LEVEL_EMPIRICAL = 2     # L2: 经验观察 — 可修正，带置信度
FP_LEVEL_HYPOTHESIS = 3    # L3: 假设/猜想 — 待验证

FP_LEVEL_NAMES = {
    FP_LEVEL_AXIOM: "L0:基本公理",
    FP_LEVEL_DERIVED: "L1:推导知识",
    FP_LEVEL_EMPIRICAL: "L2:经验观察",
    FP_LEVEL_HYPOTHESIS: "L3:假设/猜想",
    FP_LEVEL_UNKNOWN: "未分类",
}

# 关键词 → 第一性原理层级 映射规则
FP_LEVEL_KEYWORDS = {
    FP_LEVEL_AXIOM: [
        "定律", "定理", "公理", "原理", "本质", "不可否认",
        "law", "theorem", "axiom", "fundamental", "守恒",
    ],
    FP_LEVEL_DERIVED: [
        "推导", "因此", "所以", "根据", "结论是",
        "therefore", "thus", "conclude", "推导",
    ],
    FP_LEVEL_EMPIRICAL: [
        "观察", "实验", "数据显示", "统计", "研究表明",
        "observation", "experiment", "data shows", "据统计",
        "研究发现", "调查", "平均", "趋势",
    ],
    FP_LEVEL_HYPOTHESIS: [
        "假设", "猜想", "推测", "可能", "预计",
        "hypothesis", "speculate", "possibly", "perhaps", "maybe",
        "有待验证", "理论上", "初步判断",
    ],
}

# ============ 兼容层：Embed4All 延迟导入 ============
_embedder = None

def _get_embedder():
    """获取 Embed4All 实例（单例，延迟加载）
    
    优先使用本地缓存模型，避免联网下载。
    模型缓存路径：~/.cache/gpt4all/all-MiniLM-L6-v2.gguf2.f16.gguf
    """
    global _embedder
    if _embedder is None:
        try:
            from gpt4all import Embed4All
            # 使用本地缓存模型 + 禁止联网下载
            # 避免 HuggingFace 502 等瞬断问题
            cache_dir = os.path.expanduser("~/.cache/gpt4all")
            model_name = "all-MiniLM-L6-v2.gguf2.f16.gguf"
            model_path = os.path.join(cache_dir, model_name)
            if os.path.exists(model_path):
                _embedder = Embed4All(
                    model_name=model_name,
                    model_path=cache_dir,
                    allow_download=False,
                )
            else:
                # 首次使用，需要联网下载
                _embedder = Embed4All()
            if _embedder is not None:
                print(f"[SemanticIndex] ✅ Embed4All 就绪（{'本地缓存' if os.path.exists(model_path) else '新下载'}）")
        except Exception as e:
            print(f"[SemanticIndex] ⚠️ Embed4All 加载失败: {e}")
            _embedder = False  # 标记加载失败
    if _embedder is False:
        return None
    return _embedder


def _ensure_dir(path):
    """确保目录存在"""
    os.makedirs(path, exist_ok=True)


class SemanticIndex:
    """
    语义向量索引
    
    管理知识库的向量化索引，支持构建、搜索、增量更新。
    新增第一性原理层级标注，让知识检索具备元认知深度。
    
    索引文件存储在 memory/semantic_index/ 目录下：
      - index.npy        ：所有段落向量的 numpy 数组
      - index_meta.json  ：每个段落的元数据（路径、标题、摘要、文件哈希、fp_level）
      - file_hashes.json ：文件内容哈希表（用于增量更新检测）
    """
    
    def __init__(self, vault_path=None, index_dir=None):
        self.vault = Path(vault_path or VAULT_PATH)
        self.index_dir = Path(index_dir or INDEX_DIR)
        _ensure_dir(self.index_dir)
        
        self.vectors = None       # np.ndarray: [n_chunks, embedding_dim]
        self.metadata = []        # list[dict]: 每个 chunk 的元数据
        self.file_hashes = {}     # dict[str, str]: 文件路径 → md5
        
        # 缓存嵌入维数
        self._dim = None
    
    # ==================== 第一性原理层级检测 ====================
    
    @staticmethod
    def _detect_fp_level(text, h1="", h2=""):
        """
        检测一段文本对应的第一性原理层级。
        
        策略:
        1. 先看标题（h1/h2）中是否包含层级关键词
        2. 再看正文内容中的关键词频率
        3. 综合判断
        """
        combined = f"{h1} {h2} {text}".lower()
        
        # 计分：每个关键词命中 +1
        scores = {FP_LEVEL_AXIOM: 0, FP_LEVEL_DERIVED: 0, 
                  FP_LEVEL_EMPIRICAL: 0, FP_LEVEL_HYPOTHESIS: 0}
        
        for level, keywords in FP_LEVEL_KEYWORDS.items():
            for kw in keywords:
                if kw.lower() in combined:
                    scores[level] += 1
        
        # 取最高分，如果都没有则返回 UNKNOWN
        max_score = max(scores.values())
        if max_score == 0:
            return FP_LEVEL_UNKNOWN
        
        # 如果有并列，优先级：AXIOM > EMPIRICAL > DERIVED > HYPOTHESIS
        priority = [FP_LEVEL_AXIOM, FP_LEVEL_EMPIRICAL, FP_LEVEL_DERIVED, FP_LEVEL_HYPOTHESIS]
        for level in priority:
            if scores[level] == max_score:
                return level
        
        return FP_LEVEL_UNKNOWN
    
    # ==================== 索引构建 ====================
    
    def build(self, verbose=True):
        """
        完整构建语义索引。
        遍历整个知识库，读取所有 .md 文件，切片后生成嵌入向量。
        """
        if verbose:
            print(f"[SemanticIndex] 🔨 开始构建索引: {self.vault}")
            t0 = time.time()
        
        # 1. 遍历所有 .md 文件
        md_files = list(self.vault.rglob("*.md"))
        # 排除 .obsidian 等隐藏目录
        md_files = [f for f in md_files if ".obsidian" not in str(f) 
                    and ".claude" not in str(f)
                    and ".claudian" not in str(f)]
        
        if verbose:
            print(f"[SemanticIndex]   找到 {len(md_files)} 个 .md 文件")
        
        # 2. 读取并切片
        all_chunks = []
        for fpath in md_files:
            try:
                chunks = self._chunk_file(fpath)
                all_chunks.extend(chunks)
            except Exception as e:
                if verbose:
                    print(f"[SemanticIndex]   ⚠️ 跳过 {fpath.name}: {e}")
        
        if verbose:
            print(f"[SemanticIndex]   切分为 {len(all_chunks)} 个段落")
        
        # 3. 生成嵌入向量
        if not all_chunks:
            if verbose:
                print("[SemanticIndex]   ⚠️ 无内容可索引")
            return
        
        embedder = _get_embedder()
        if embedder is None:
            if verbose:
                print("[SemanticIndex]   ❌ Embed4All 不可用，无法生成向量")
            return
        
        texts = [c["text"] for c in all_chunks]
        if verbose:
            print(f"[SemanticIndex]   正在生成嵌入向量（共 {len(texts)} 段，首次运行需下载模型 ≈45MB）...")
        
        vectors_list = []
        for i, text in enumerate(texts):
            vec = embedder.embed(text)
            vectors_list.append(vec)
            if verbose and (i + 1) % 50 == 0:
                print(f"[SemanticIndex]   进度: {i+1}/{len(texts)}")
        
        # 4. 存储（含第一性原理层级）
        self.vectors = np.array(vectors_list, dtype=np.float32)
        self.metadata = []
        for c in all_chunks:
            fp_level = self._detect_fp_level(c["text"], c["h1"], c["h2"])
            self.metadata.append({
                "path": str(c["path"]),
                "h1": c["h1"],
                "h2": c["h2"],
                "chunk_index": c["chunk_index"],
                "text_preview": c["text"][:200],
                "char_count": len(c["text"]),
                "fp_level": fp_level,           # 第一性原理层级
                "fp_level_name": FP_LEVEL_NAMES.get(fp_level, "未分类"),
            })
        
        # 文件哈希
        for fpath in md_files:
            try:
                self.file_hashes[str(fpath)] = self._file_hash(fpath)
            except Exception:
                pass
        
        # 5. 写入磁盘
        self._save()
        
        if verbose:
            elapsed = time.time() - t0
            print(f"[SemanticIndex] ✅ 索引构建完成: {len(all_chunks)} 段, "
                  f"向量维度 {self.vectors.shape[1]}, 耗时 {elapsed:.1f}s")
            print(f"[SemanticIndex]   索引文件: {self.index_dir}")
    
    # ==================== 语义搜索 ====================
    
    def search(self, query, top_k=5, min_score=0.3, fp_level=None, boost_fp=False):
        """
        语义搜索知识库。
        
        参数:
          query: 自然语言查询
          top_k: 返回最多几条结果
          min_score: 最低相似度阈值（过滤低相关结果）
          fp_level: 第一性原理层级过滤（None=不限, 或 FP_LEVEL_* 常量）
          boost_fp: 是否对高优先级层级（L0/L1）结果进行分数加权
        
        返回:
          [{"path": str, "h1": str, "h2": str, "text_preview": str,
            "score": float, "char_count": int,
            "fp_level": int, "fp_level_name": str}, ...]
        """
        if self.vectors is None:
            self._load()
        
        if self.vectors is None or len(self.vectors) == 0:
            return []
        
        embedder = _get_embedder()
        if embedder is None:
            return []
        
        # 1. 生成查询向量
        query_vec = np.array(embedder.embed(query), dtype=np.float32).reshape(1, -1)
        
        # 2. 计算余弦相似度
        # cos(a, b) = (a · b) / (||a|| * ||b||)
        norms = np.linalg.norm(self.vectors, axis=1, keepdims=True)
        query_norm = np.linalg.norm(query_vec)
        if query_norm == 0:
            return []
        scores = (self.vectors @ query_vec.T).flatten() / (norms.flatten() * query_norm + 1e-10)
        
        # 3. 加分：如果启用 fp_level 加权
        if boost_fp and len(self.metadata) == len(scores):
            for i in range(len(scores)):
                meta = self.metadata[i]
                level = meta.get("fp_level", FP_LEVEL_UNKNOWN)
                # L0 基本公理 +0.15, L1 推导知识 +0.10
                if level == FP_LEVEL_AXIOM:
                    scores[i] += 0.15
                elif level == FP_LEVEL_DERIVED:
                    scores[i] += 0.10
                elif level == FP_LEVEL_EMPIRICAL:
                    scores[i] += 0.05
                # L3 假设/猜想 不加分
        
        # 4. 排序 + 过滤
        indices = np.argsort(scores)[::-1]  # 降序
        
        results = []
        for idx in indices:
            score = float(scores[idx])
            if score < min_score:
                break  # 后面的分数只会更低
            if len(results) >= top_k:
                break
            
            meta = self.metadata[idx]
            
            # fp_level 过滤
            if fp_level is not None:
                meta_level = meta.get("fp_level", FP_LEVEL_UNKNOWN)
                if meta_level != fp_level:
                    continue
            
            results.append({
                "path": meta["path"],
                "h1": meta["h1"],
                "h2": meta["h2"],
                "text_preview": meta["text_preview"],
                "score": round(score, 4),
                "char_count": meta["char_count"],
                "fp_level": meta.get("fp_level", FP_LEVEL_UNKNOWN),
                "fp_level_name": meta.get("fp_level_name", "未分类"),
            })
        
        return results
    
    # ==================== 增量更新 ====================
    
    def update(self, verbose=True):
        """
        增量更新索引。
        只处理新增或内容有变化的文件。
        """
        if self.vectors is None:
            self._load()
        
        # 1. 扫描所有 .md 文件
        md_files = list(self.vault.rglob("*.md"))
        md_files = [f for f in md_files if ".obsidian" not in str(f)
                    and ".claude" not in str(f)
                    and ".claudian" not in str(f)]
        
        # 2. 找出变化的文件
        changed = []
        for fpath in md_files:
            try:
                current_hash = self._file_hash(fpath)
                stored_hash = self.file_hashes.get(str(fpath))
                if current_hash != stored_hash:
                    changed.append(fpath)
            except Exception:
                changed.append(fpath)
        
        if not changed:
            if verbose:
                print("[SemanticIndex] ✅ 无变化，无需更新")
            return
        
        if verbose:
            print(f"[SemanticIndex] 🔄 检测到 {len(changed)} 个文件有变化，正在更新...")
        
        # 3. 重新构建整个索引（简单但可靠）
        # 对于小规模知识库，完全重建比精细的增量更新更可靠
        self.build(verbose=verbose)
    
    # ==================== 内部方法 ====================
    
    def _chunk_file(self, fpath):
        """
        将单个 .md 文件按 ## 标题切分为段落。
        
        返回:
          [{"path": path, "h1": str, "h2": str, 
            "chunk_index": int, "text": str}, ...]
        """
        content = fpath.read_text(encoding="utf-8", errors="replace")
        
        # 跳过 YAML frontmatter
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                content = parts[2]
        
        # 提取 H1（# 标题）
        h1_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
        h1 = h1_match.group(1).strip() if h1_match else fpath.stem
        
        # 按 H2（## 标题）切分
        sections = re.split(r"^(##\s+.+)$", content, flags=re.MULTILINE)
        
        chunks = []
        current_heading = "概述"
        current_text = ""
        
        for part in sections:
            part = part.strip()
            if not part:
                continue
            if part.startswith("## "):
                # 保存前一段
                if current_text.strip():
                    chunks.append({
                        "path": fpath,
                        "h1": h1,
                        "h2": current_heading,
                        "chunk_index": len(chunks),
                        "text": current_text.strip(),
                    })
                current_heading = part.replace("## ", "").strip()
                current_text = ""
            else:
                current_text += part + "\n"
        
        # 最后一段
        if current_text.strip():
            chunks.append({
                "path": fpath,
                "h1": h1,
                "h2": current_heading,
                "chunk_index": len(chunks),
                "text": current_text.strip(),
            })
        
        # 如果文件没有 H2，整体作为一段
        if not chunks:
            chunks.append({
                "path": fpath,
                "h1": h1,
                "h2": "",
                "chunk_index": 0,
                "text": content.strip(),
            })
        
        return chunks
    
    def _file_hash(self, fpath):
        """计算文件的 MD5 哈希（用于变化检测）"""
        return hashlib.md5(fpath.read_bytes()).hexdigest()
    
    def _save(self):
        """保存索引到磁盘"""
        if self.vectors is not None:
            np.save(self.index_dir / "index.npy", self.vectors)
        with open(self.index_dir / "index_meta.json", "w", encoding="utf-8") as f:
            json.dump(self.metadata, f, ensure_ascii=False, indent=2)
        with open(self.index_dir / "file_hashes.json", "w", encoding="utf-8") as f:
            json.dump(self.file_hashes, f, ensure_ascii=False, indent=2)
    
    def _load(self):
        """从磁盘加载索引"""
        vec_file = self.index_dir / "index.npy"
        meta_file = self.index_dir / "index_meta.json"
        hash_file = self.index_dir / "file_hashes.json"
        
        if vec_file.exists() and meta_file.exists():
            try:
                self.vectors = np.load(vec_file)
                with open(meta_file, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                if hash_file.exists():
                    with open(hash_file, "r", encoding="utf-8") as f:
                        self.file_hashes = json.load(f)
                return True
            except Exception as e:
                print(f"[SemanticIndex] ⚠️ 加载索引失败: {e}")
                return False
        return False
    
    def stats(self):
        """返回索引统计信息"""
        if self.vectors is None:
            self._load()
        if self.vectors is None:
            return {"status": "未构建", "chunks": 0}
        
        # 按源文件统计
        source_files = {}
        for m in self.metadata:
            p = m["path"]
            source_files[p] = source_files.get(p, 0) + 1
        
        # 第一性原理层级分布
        fp_distribution = {name: 0 for name in FP_LEVEL_NAMES.values()}
        for m in self.metadata:
            level_name = FP_LEVEL_NAMES.get(m.get("fp_level", FP_LEVEL_UNKNOWN), "未分类")
            fp_distribution[level_name] = fp_distribution.get(level_name, 0) + 1
        
        return {
            "status": "就绪",
            "chunks": len(self.vectors),
            "dimension": self.vectors.shape[1],
            "source_files": len(source_files),
            "index_dir": str(self.index_dir),
            "fp_distribution": fp_distribution,
        }


# ==================== 命令行入口 ====================

if __name__ == "__main__":
    import sys
    
    idx = SemanticIndex()
    
    if len(sys.argv) > 1 and sys.argv[1] == "build":
        idx.build(verbose=True)
    elif len(sys.argv) > 1 and sys.argv[1] == "update":
        idx.update(verbose=True)
    elif len(sys.argv) > 1 and sys.argv[1] == "search":
        query = " ".join(sys.argv[2:]) or "系统思维"
        if not idx._load():
            print("[SemanticIndex] ⚠️ 索引未找到，请先运行 build")
            sys.exit(1)
        results = idx.search(query, top_k=5)
        print(f"\n🔍 搜索: \"{query}\"\n")
        for r in results:
            print(f"  [{r['score']:.3f}] {r['h1']} → {r['h2']}")
            print(f"       {r['path']}")
            print(f"       {r['text_preview'][:80]}...")
            print()
    elif len(sys.argv) > 1 and sys.argv[1] == "stats":
        idx._load()
        s = idx.stats()
        print(f"状态: {s['status']}")
        print(f"段落数: {s['chunks']}")
        print(f"向量维度: {s['dimension']}")
        print(f"源文件数: {s['source_files']}")
        print(f"索引目录: {s['index_dir']}")
        if "fp_distribution" in s:
            print(f"\n第一性原理层级分布:")
            for level_name, count in sorted(s["fp_distribution"].items()):
                bar = "█" * max(1, count // 2) if count > 0 else ""
                print(f"  {level_name:12s}: {count:4d}  {bar}")
    elif len(sys.argv) > 1 and sys.argv[1] == "search-fp":
        # 带第一性原理过滤的搜索
        query = " ".join(sys.argv[2:]) or "系统思维"
        fp_filter = FP_LEVEL_AXIOM  # 默认只搜基本公理
        if "--level" in sys.argv:
            idx_lvl = sys.argv.index("--level")
            if idx_lvl + 1 < len(sys.argv):
                fp_filter = int(sys.argv[idx_lvl + 1])
        
        if not idx._load():
            print("[SemanticIndex] ⚠️ 索引未找到，请先运行 build")
            sys.exit(1)
        
        results = idx.search(query, top_k=5, fp_level=fp_filter)
        level_name = FP_LEVEL_NAMES.get(fp_filter, "未知")
        print(f"\n🔍 搜索: \"{query}\"  [层级: {level_name}]\n")
        for r in results:
            tag = r.get('fp_level_name', '')
            print(f"  [{r['score']:.3f}] [{tag}] {r['h1']} → {r['h2']}")
            print(f"       {r['path']}")
            print(f"       {r['text_preview'][:80]}...")
            print()
    else:
        print("用法:")
        print("  python semantic_index.py build              — 完整构建索引")
        print("  python semantic_index.py update             — 增量更新")
        print("  python semantic_index.py search <查询>      — 语义搜索")
        print("  python semantic_index.py search-fp <查询>   — 按第一性原理层级搜索")
        print("  python semantic_index.py stats              — 查看统计（含FP层级分布）")
