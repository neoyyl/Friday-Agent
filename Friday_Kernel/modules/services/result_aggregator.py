"""
Result Aggregator — 结果整合 + 冲突检测 + 拟人化输出
====================================================
多 Agent 输出 → 结构化合并 → 冲突检测 → 一致性检查 → 优雅呈现

用法:
    aggregator = ResultAggregator()
    
    # 合并并行结果
    final = aggregator.merge(results_list)
    
    # 冲突检测
    conflicts = aggregator.detect_conflicts(results_list)
    
    # 统一输出
    output = aggregator.present("用户问题", merged_result)
"""

import json
import logging
from collections import Counter
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ConflictLevel:
    """冲突等级"""
    NONE = "none"
    MINOR = "minor"       # 表述不同，本质一致
    MAJOR = "major"       # 事实性冲突
    CRITICAL = "critical"  # 完全相反


class ResultAggregator:
    """
    多 Agent 结果聚合器

    核心能力：
      - 合并多个输出
      - 冲突检测（事实对立）
      - 一致性评分
      - 格式化输出
    """

    def __init__(self):
        self._outputs = []

    # ───────── 合并 ─────────

    def merge(self, outputs: list[dict], strategy: str = "auto") -> dict:
        """
        合并多个 Agent 的输出。

        策略:
          - auto: 自动选择最佳策略
          - concat: 简单拼接
          - summary: 提取共同点
          - best: 选最高置信度
        """
        if not outputs:
            return {"status": "empty", "content": "", "agents": []}

        self._outputs = outputs

        if strategy == "auto":
            # 自动选择：冲突则 summary，否则 concat
            conflicts = self.detect_conflicts(outputs)
            if conflicts:
                strategy = "summary"
            elif len(outputs) > 1:
                strategy = "concat"
            else:
                strategy = "best"

        if strategy == "concat":
            content = self._concat(outputs)
        elif strategy == "summary":
            content = self._summarize(outputs)
        elif strategy == "best":
            content = self._pick_best(outputs)
        else:
            content = self._concat(outputs)

        return {
            "status": "success",
            "content": content,
            "strategy": strategy,
            "agents_used": [o.get("agent_name", "") for o in outputs],
            "confidence": self._calc_confidence(outputs),
            "conflicts": self.detect_conflicts(outputs),
            "timestamp": datetime.now().isoformat(),
        }

    def _concat(self, outputs: list) -> str:
        """简单拼接"""
        parts = []
        for i, o in enumerate(outputs):
            name = o.get("agent_name", f"Agent {i+1}")
            content = o.get("output", o.get("content", ""))
            if content:
                parts.append(f"【{name}】\n{content}")
        return "\n\n".join(parts)

    def _summarize(self, outputs: list) -> str:
        """提取共同点 + 列出分歧"""
        contents = [str(o.get("output", o.get("content", ""))) for o in outputs]

        # 找共同关键词
        common = self._find_common(contents)
        differences = self._find_differences(contents, outputs)

        summary_parts = []

        if common:
            summary_parts.append("## 共识\n" + "\n".join(f"- {item}" for item in common[:10]))

        if differences:
            summary_parts.append("## 不同视角\n")
            for diff in differences[:5]:
                summary_parts.append(f"**{diff['agent']}**: {diff['content'][:200]}")

        return "\n\n".join(summary_parts) if summary_parts else contents[0]

    def _pick_best(self, outputs: list) -> str:
        """选最好的（有内容的第一个或置信度最高的）"""
        # 按内容长度降序
        scored = [(len(str(o.get("output", o.get("content", "")))), o) for o in outputs]
        scored.sort(key=lambda x: -x[0])
        best = scored[0][1]
        return str(best.get("output", best.get("content", "")))

    # ───────── 冲突检测 ─────────

    def detect_conflicts(self, outputs: list) -> list:
        """
        检测多个 Agent 输出间的冲突。

        返回: [{level, agents, topic, detail}]
        """
        if len(outputs) < 2:
            return []

        conflicts = []
        contents = {}

        for o in outputs:
            aid = o.get("agent_id", o.get("agent_name", "?"))
            contents[aid] = str(o.get("output", o.get("content", "")))

        agent_ids = list(contents.keys())

        # 两两比较
        for i in range(len(agent_ids)):
            for j in range(i + 1, len(agent_ids)):
                a1, a2 = agent_ids[i], agent_ids[j]
                c1, c2 = contents[a1], contents[a2].lower()

                # 数值冲突检测
                nums_1 = self._extract_numbers(contents[a1])
                nums_2 = self._extract_numbers(contents[a2])

                for n1, ctx1 in nums_1:
                    for n2, ctx2 in nums_2:
                        if abs(n1 - n2) > 0.01 and self._same_context(ctx1, ctx2):
                            conflicts.append({
                                "level": ConflictLevel.MAJOR,
                                "agents": [a1, a2],
                                "topic": ctx1[:40],
                                "detail": f"{a1}: {n1} vs {a2}: {n2}",
                            })

                # 正反判断冲突
                positive = ["是", "可以", "正确", "yes", "true", "支持", "可行"]
                negative = ["否", "不行", "错误", "no", "false", "反对", "不可行"]
                for pos in positive:
                    for neg in negative:
                        if pos in c1 and neg in c2:
                            conflicts.append({
                                "level": ConflictLevel.CRITICAL,
                                "agents": [a1, a2],
                                "topic": f"{pos}/{neg} 矛盾",
                                "detail": f"Agent {a1} 持肯定意见，Agent {a2} 持否定意见",
                            })
                            break
                    else:
                        continue
                    break

        return conflicts

    def _extract_numbers(self, text: str) -> list:
        """提取数字及上下文"""
        import re
        results = []
        # 找 "xx%", "xxGB", "xx元" 等模式
        patterns = re.finditer(r'(\d+[\.\d]*)\s*(%|GB|MB|元|美元|万|亿|℃|F|%)', text)
        for p in patterns:
            num = float(p.group(1))
            unit = p.group(2)
            # 提取上下文（前后20字）
            start = max(0, p.start() - 20)
            end = min(len(text), p.end() + 20)
            ctx = text[start:end]
            results.append((num, ctx.strip()))
        return results

    def _same_context(self, ctx1: str, ctx2: str) -> bool:
        """判断两个上下文是否讨论同一事物"""
        # 找重叠关键词
        import re
        words1 = set(re.findall(r'[\w\u4e00-\u9fff]+', ctx1.lower()))
        words2 = set(re.findall(r'[\w\u4e00-\u9fff]+', ctx2.lower()))
        overlap = words1 & words2
        # 去掉通用词
        common = {"的", "了", "是", "在", "有", "和", "与", "不", "也", "就",
                  "都", "而", "及", "等", "或", "被", "把", "对"}
        overlap = overlap - common
        return len(overlap) >= 2

    def _find_common(self, contents: list) -> list:
        """找共同点"""
        if not contents:
            return []
        # 取最短内容的句子作为基准
        import re
        shortest = min(contents, key=len)
        sentences = re.split(r'[。！？\n.!?]', shortest)
        common = []
        for sent in sentences:
            sent = sent.strip()
            if len(sent) < 5:
                continue
            # 检查是否出现在所有输出中
            if all(sent[:10] in c or sent[-10:] in c for c in contents):
                common.append(sent)
        return common[:10]

    def _find_differences(self, contents: list, outputs: list) -> list:
        """找差异点"""
        diffs = []
        for i, o in enumerate(outputs):
            name = o.get("agent_name", f"Agent {i+1}")
            content = str(o.get("output", o.get("content", "")))
            # 简单策略：每个 Agent 输出中的独特内容
            unique = content
            for j, c in enumerate(contents):
                if i != j and len(c) > 50:
                    # 移除与其他输出相同的部分
                    overlap = self._find_overlap(content, c)
                    for ol in overlap:
                        unique = unique.replace(ol, "")
            if unique.strip():
                diffs.append({
                    "agent": name,
                    "content": unique.strip()[:300],
                })
        return diffs

    def _find_overlap(self, text1: str, text2: str, min_len: int = 20) -> list:
        """找两段文本的重叠部分"""
        overlaps = []
        for i in range(len(text1) - min_len):
            chunk = text1[i:i + min_len]
            if chunk in text2:
                # 扩展
                j = i + min_len
                while j < len(text1) and text1[i:j+1] in text2:
                    j += 1
                overlaps.append(text1[i:j])
        # 去重
        return list(set(overlaps))

    def _calc_confidence(self, outputs: list) -> float:
        """计算总体置信度"""
        if not outputs:
            return 0.0
        # 基于冲突数量
        conflicts = self.detect_conflicts(outputs)
        num_outputs = len(outputs)
        num_conflicts = len(conflicts)
        base = 1.0
        base -= num_conflicts * 0.2 / max(num_outputs, 1)
        return max(0.1, min(1.0, base))

    # ───────── 输出格式化 ─────────

    def present(self, query: str, merged: dict) -> str:
        """
        将合并结果拟人化呈现给用户。

        格式:
          - 无冲突 → 直接展示
          - 有冲突 → 先展示共识，再列出分歧
        """
        content = merged.get("content", "")
        conflicts = merged.get("conflicts", [])
        agents = merged.get("agents_used", [])
        confidence = merged.get("confidence", 1.0)

        if not content:
            return "抱歉，未能获取到有效结果。"

        # 构建最终输出
        parts = []

        # 头部
        parts.append(content)

        # 冲突提示
        if conflicts:
            major = [c for c in conflicts if c["level"] in ("major", "critical")]
            if major:
                parts.append("\n---\n⚠️ **需注意的信息差异**")
                for c in major[:3]:
                    parts.append(f"- {c['detail']}")

        # Agent 来源
        if len(agents) > 1:
            parts.append(f"\n---\n*信息来源: {', '.join(agents)}*")

        return "\n".join(parts)

    def flatten(self, nested: Any, prefix: str = "") -> str:
        """将嵌套结构展平为可读文本"""
        if isinstance(nested, str):
            return nested
        if isinstance(nested, dict):
            parts = []
            for k, v in nested.items():
                if k in ("status", "timestamp", "agents_used"):
                    continue
                parts.append(self.flatten(v, prefix=f"{k}: "))
            return "\n".join(parts)
        if isinstance(nested, list):
            return "\n".join(f"- {self.flatten(item)}" for item in nested)
        return str(nested)


# ───────── 全局单例 ─────────

_default_aggregator = None


def get_aggregator():
    global _default_aggregator
    if _default_aggregator is None:
        _default_aggregator = ResultAggregator()
    return _default_aggregator
