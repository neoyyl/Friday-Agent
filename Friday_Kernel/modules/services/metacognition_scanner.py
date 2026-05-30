"""
元认知层 MVP — 知识库健康扫描器 + 推理审计追踪
===============================================
核心能力：
  1. 知识库健康扫描
     - 笔记分布密度（各分类统计）
     - 链接拓扑分析（连通率、孤立节点、枢纽节点）
     - 时效感知（陈化笔记检测）
     - 综合健康评分
  2. 推理审计追踪（第一性原理增强）
     - 记录每次推理的思维链、推理模式、知识引用
     - 生成审计日志供复盘和改进

输出: 
  - AI/meta/stats/健康报告_YYYY-MM-DD.md
  - AI/meta/audit/reasoning_audit_YYYY-MM-DD.md
"""

import os
import re
import time
import json
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict, Counter

# ─── 配置 ───────────────────────────────────────────────
VAULT = r"F:\knowledge\知识库"
OUTPUT_DIR = os.path.join(VAULT, "AI", "meta", "stats")
AUDIT_DIR = os.path.join(VAULT, "AI", "meta", "audit")

STALE_DAYS = 180          # 超过此天数未更新视为"陈化"
WARN_ISOLATED_DAYS = 90   # 超过此天数无链接指向视为"孤立警告"

# 分类映射（根据目录前缀判断笔记归属哪个大类）
CATEGORY_MAP = {
    "AI": "AI 知识体系",
    "提升/研究概论": "🔬 研究概论",
    "提升/活力研究": "⚡ 活力研究",
    "提升/时间管理": "⏰ 时间管理",
    "提升/职场智慧": "💼 职场智慧",
    "提升/投资策略": "💰 投资策略",
    "提升/人脉网络": "🌐 人脉网络",
    "提升/精力管理": "🔋 精力管理",
    "提升": "🌱 提升综合",
}

# ─── 工具函数 ───────────────────────────────────────────

def list_md_files(root):
    """递归扫描所有 .md 文件，返回 (相对路径, 绝对路径, mtime)"""
    files = []
    root = os.path.abspath(root)
    for dirpath, dirnames, filenames in os.walk(root):
        # 跳过 .obsidian、隐藏目录、以及 stats/（避免报告自指）
        if any(x in dirpath for x in (".obsidian", ".claude", ".claudian", "stats")):
            continue
        rel_dir = os.path.relpath(dirpath, root).replace("\\", "/")
        for fn in filenames:
            if fn.endswith(".md"):
                abs_path = os.path.join(dirpath, fn)
                rel_path = f"{rel_dir}/{fn}" if rel_dir != "." else fn
                mtime = os.path.getmtime(abs_path)
                files.append((rel_path, abs_path, mtime))
    return files


def categorize(rel_path):
    """根据相对路径判断属于哪个大类"""
    for prefix, cat in CATEGORY_MAP.items():
        if rel_path.startswith(prefix):
            return cat
    return "📁 其他"


def extract_links(content):
    """提取所有 [[wikilink]]，返回 set（仅取文件名部分，去掉路径）"""
    raw = re.findall(r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]', content)
    result = set()
    for link in raw:
        stem = link.split("/")[-1].split("\\")[-1]
        result.add(stem)
    return result


def file_stem(rel_path):
    """从相对路径提取文件名（不含路径和扩展名）"""
    return os.path.splitext(os.path.basename(rel_path))[0]


def days_since(mtime):
    return (time.time() - mtime) / 86400


# ═══════════════ 扫描阶段 ═══════════════

def _scan_files(files):
    """
    第一遍扫描：收集基础统计、出链、入链、陈化笔记。
    
    返回:
      cat_count, cat_files, all_links_out, all_incoming,
      stale_notes, file_sizes, file_mtimes
    """
    cat_count = Counter()
    cat_files = defaultdict(list)
    all_links_out = {}
    all_incoming = defaultdict(set)
    stale_notes = []
    file_sizes = {}
    file_mtimes = {}

    for rel_path, abs_path, mtime in files:
        cat = categorize(rel_path)
        cat_count[cat] += 1
        cat_files[cat].append(rel_path)

        file_mtimes[rel_path] = mtime
        file_sizes[rel_path] = os.path.getsize(abs_path)

        try:
            with open(abs_path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception:
            content = ""

        out_links = extract_links(content)
        all_links_out[rel_path] = out_links
        for target in out_links:
            all_incoming[target].add(rel_path)

        d = days_since(mtime)
        if d > STALE_DAYS and content.strip():
            stale_notes.append((rel_path, int(d)))

    return cat_count, cat_files, all_links_out, all_incoming, stale_notes, file_sizes, file_mtimes


def _analyze_topology(files, all_links_out, all_incoming, file_mtimes):
    """
    第二遍：链接拓扑分析 — 连通率、孤立节点、枢纽节点。
    
    返回:
      connectivity, orphan_notes, top_hubs, isolated_warn
    """
    total = len(files)
    linked_notes = set()
    orphan_notes = []
    hub_candidates = []

    for rel_path, _, _ in files:
        stem = file_stem(rel_path)
        in_degree = len(all_incoming.get(stem, set()))
        if in_degree > 0:
            linked_notes.add(rel_path)
        else:
            basename = os.path.basename(rel_path).lower()
            if basename not in ("readme.md", "index.md", "schema.md", "log.md"):
                orphan_notes.append(rel_path)
        hub_candidates.append((in_degree, rel_path))

    hub_candidates.sort(reverse=True)
    top_hubs = [(n, d) for d, n in hub_candidates[:10] if d > 0]
    connectivity = round(len(linked_notes) / total * 100, 1) if total else 0

    isolated_warn = []
    for o in orphan_notes:
        d = days_since(file_mtimes.get(o, 0))
        if d > WARN_ISOLATED_DAYS:
            isolated_warn.append((o, int(d)))

    return connectivity, orphan_notes, top_hubs, isolated_warn


def _compute_health_score(connectivity, orphan_notes, stale_notes, cat_count):
    """
    综合健康评分（满分100）。
    
    返回:
      (score, grade, reasons)
    """
    score = 100
    reasons = []

    if connectivity < 50:
        score -= 20
        reasons.append(f"连通率 {connectivity}% < 50%（-20）")
    elif connectivity < 70:
        score -= 10
        reasons.append(f"连通率 {connectivity}% < 70%（-10）")

    orphan_penalty = min(len(orphan_notes) * 3, 20)
    if orphan_penalty > 0:
        score -= orphan_penalty
        reasons.append(f"孤立节点 {len(orphan_notes)} 个（-{orphan_penalty})")

    stale_penalty = min(len(stale_notes) * 2, 15)
    if stale_penalty > 0:
        score -= stale_penalty
        reasons.append(f"陈化笔记 {len(stale_notes)} 篇（-{stale_penalty})")

    if cat_count:
        max_cat = max(cat_count.values())
        min_cat = min(cat_count.values()) if len(cat_count) > 1 else max_cat
        if max_cat > 0 and min_cat > 0 and max_cat / min_cat > 5:
            score -= 5
            reasons.append("分类分布严重不均（-5）")

    score = max(0, min(100, score))

    if score >= 80:
        grade = "🟢 A"
    elif score >= 60:
        grade = "🟡 B"
    elif score >= 40:
        grade = "🟠 C"
    else:
        grade = "🔴 D"

    return score, grade, reasons


def _write_health_report(report_path, total, score, grade, connectivity,
                         orphan_notes, stale_notes, cat_count, top_hubs,
                         isolated_warn, all_links_out, fresh_count,
                         warm_count, cold_count, reasons, files):
    """写入健康报告 Markdown 文件"""
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")

    with open(report_path, "w", encoding="utf-8") as r:
        def w(s=""):
            r.write(s + "\n")

        w(f"# 📊 知识库健康报告")
        w(f"")
        w(f"> **扫描日期**: {today}  |  **总笔记**: {total}  |  **健康评分**: {grade} {score}/100")
        w(f"")
        w(f"---")
        w(f"")

        # 评分摘要
        w(f"## 🏥 健康评分")
        w(f"")
        w(f"| 指标 | 状态 |")
        w(f"|:----|:----:|")
        health_icons = {
            "连通率": "🟢" if connectivity >= 70 else ("🟡" if connectivity >= 50 else "🔴"),
            "孤立节点": "🟢" if len(orphan_notes) == 0 else ("🟡" if len(orphan_notes) <= 5 else "🔴"),
            "陈化笔记": "🟢" if len(stale_notes) <= 3 else ("🟡" if len(stale_notes) <= 10 else "🔴"),
            "分类均衡": (
                "🟢"
                if (len(cat_count) <= 1 or max(cat_count.values()) / min(cat_count.values()) <= 3)
                else ("🟡" if max(cat_count.values()) / min(cat_count.values()) <= 5 else "🔴")
            ),
        }
        for k, v in health_icons.items():
            w(f"| **{k}** | {v} |")
        w(f"")
        if reasons:
            w(f"**扣分原因**:")
            for reason in reasons:
                w(f"- {reason}")
        w(f"")

        # 知识密度
        w(f"## 📈 知识密度热力图")
        w(f"")
        w(f"| 分类 | 笔记数 | 占比 | 分布 |")
        w(f"|:-----|:-----:|:----:|:----|")
        density_report = []
        for cat, count in sorted(cat_count.items(), key=lambda x: -x[1]):
            pct = round(count / total * 100, 1)
            bar = "█" * max(1, int(pct / 3))
            density_report.append((cat, count, pct, bar))
            w(f"| **{cat}** | {count} | {pct}% | {bar} |")
        w(f"")

        # 拓扑分析
        w(f"## 🔗 链接拓扑分析")
        w(f"")
        total_links = sum(len(v) for v in all_links_out.values())
        w(f"- **总链接数**: {total_links}")
        w(f"- **连通率**: {connectivity}%（有入链的笔记占比）")
        w(f"- **孤立节点**: {len(orphan_notes)} 个（零入链的非系统笔记）")

        if top_hubs:
            w(f"")
            w(f"### 枢纽节点（入链最多的笔记）")
            w(f"")
            w(f"| 笔记 | 被引用次数 |")
            w(f"|:----|:--------:|")
            for name, degree in top_hubs:
                w(f"| [[{name.replace('.md','')}]] | {degree} |")

        if isolated_warn:
            w(f"")
            w(f"### ⚠️ 长期孤立笔记（>90天无更新且无人引用）")
            w(f"")
            w(f"| 笔记 | 未更新天数 |")
            w(f"|:----|:--------:|")
            for name, days_ in isolated_warn[:15]:
                w(f"| [[{name.replace('.md','')}]] | {days_} 天 |")

        w(f"")
        w(f"## ⏳ 时效分析")
        w(f"")
        w(f"| 状态 | 数量 | 说明 |")
        w(f"|:---|:----:|:-----|")
        w(f"| 🟢 新鲜（<30天） | {fresh_count} | 近期有更新 |")
        w(f"| 🟡 常温（30-180天） | {warm_count} | 需要关注 |")
        w(f"| 🔴 陈化（>180天） | {cold_count} | 建议复核 |")
        w(f"")

        stale_notes.sort(key=lambda x: -x[1])
        if stale_notes:
            w(f"### 陈化笔记清单")
            w(f"")
            w(f"| 笔记 | 未更新天数 |")
            w(f"|:----|:--------:|")
            for name, days_ in stale_notes[:20]:
                w(f"| [[{name.replace('.md','')}]] | {days_} 天 |")
            if len(stale_notes) > 20:
                w(f"| ... 还有 {len(stale_notes)-20} 篇 ... | |")

        # 空缺检测
        w(f"")
        w(f"## 🕳️ 空缺检测")
        w(f"")
        empty_files = []
        for rel_path, abs_path, _ in files:
            if os.path.getsize(abs_path) == 0:
                empty_files.append(rel_path)
        if empty_files:
            w(f"以下文件为空，尚未填充内容：")
            for ef in empty_files:
                w(f"- [[{ef.replace('.md','')}]]")
        else:
            w(f"✅ 无空文件")
        w(f"")

        # 建议
        w(f"## 💡 改进建议")
        w(f"")
        suggestions = _build_suggestions(orphan_notes, stale_notes, connectivity, cat_count)
        for s in suggestions:
            w(s)
        w(f"")
        w(f"---")
        w(f"")
        w(f"*由 Friday 元认知扫描器自动生成 · {today}*")


def _build_suggestions(orphan_notes, stale_notes, connectivity, cat_count):
    """生成改进建议列表"""
    suggestions = []
    if orphan_notes:
        suggestions.append(
            f"- **连接孤立节点**: {len(orphan_notes)} 篇笔记无人引用，"
            f"考虑在相关笔记中添加链接指向它们"
        )
    if stale_notes:
        suggestions.append(
            f"- **复核陈化笔记**: {len(stale_notes)} 篇笔记超过半年未更新，"
            f"可检查内容是否仍有效"
        )
    if connectivity < 70:
        suggestions.append(
            f"- **提升连通率**: 当前 {connectivity}%，目标 70%+，"
            f"建议在笔记间建立更多双向链接"
        )
    cat_names = list(cat_count.keys())
    if len(cat_names) >= 2:
        min_cat_name = min(cat_count, key=cat_count.get)
        max_cat_name = max(cat_count, key=cat_count.get)
        if cat_count[min_cat_name] < cat_count[max_cat_name] * 0.3:
            suggestions.append(
                f"- **均衡分类**: 「{min_cat_name}」只有 {cat_count[min_cat_name]} 篇，"
                f"远少于「{max_cat_name}」的 {cat_count[max_cat_name]} 篇，可考虑增加"
            )
    if not suggestions:
        suggestions.append("- 🎉 知识库状态良好，继续保持！")
    return suggestions


def _print_scan_summary(total, cat_count, score, grade, connectivity,
                        orphan_notes, stale_notes, report_path):
    """打印扫描摘要到控制台"""
    print(f"✅ 报告已生成: {report_path}")
    print()
    print(f"   📊 健康评分: {grade} {score}/100")
    print(f"   🔗 连通率: {connectivity}%  ·  孤立节点: {len(orphan_notes)}  ·  陈化笔记: {len(stale_notes)}")
    print(f"   📁 共 {total} 篇笔记，{len(cat_count)} 个分类")
    print()


# ─── 核心扫描 ───────────────────────────────────────────

def scan():
    """知识库健康扫描入口"""
    print("🔍 元认知扫描启动...\n")
    files = list_md_files(VAULT)
    print(f"   扫描到 {len(files)} 个 .md 文件\n")

    # 第一阶段：扫描基础数据
    cat_count, cat_files, all_links_out, all_incoming, stale_notes, file_sizes, file_mtimes = \
        _scan_files(files)

    # 第二阶段：拓扑分析
    connectivity, orphan_notes, top_hubs, isolated_warn = \
        _analyze_topology(files, all_links_out, all_incoming, file_mtimes)

    # 第三阶段：时效分析
    fresh_count = sum(1 for _, _, m in files if days_since(m) <= 30)
    warm_count = sum(1 for _, _, m in files if 30 < days_since(m) <= 180)
    cold_count = len(stale_notes)

    # 第四阶段：健康评分
    score, grade, reasons = _compute_health_score(
        connectivity, orphan_notes, stale_notes, cat_count
    )

    # 第五阶段：生成报告
    today = datetime.now().strftime("%Y-%m-%d")
    report_path = os.path.join(OUTPUT_DIR, f"健康报告_{today}.md")
    _write_health_report(
        report_path, len(files), score, grade, connectivity,
        orphan_notes, stale_notes, cat_count, top_hubs,
        isolated_warn, all_links_out, fresh_count,
        warm_count, cold_count, reasons, files
    )

    _print_scan_summary(len(files), cat_count, score, grade, connectivity,
                        orphan_notes, stale_notes, report_path)
    return report_path


# ════════════════════════════════════════════════════════════
# 推理审计追踪 — 记录每次推理的思维链和模式
# ════════════════════════════════════════════════════════════

REASONING_MODES = {
    "analogy": "💬 类比思维（默认）",
    "first_principles": "🧠 第一性原理",
}


def _extract_reasoning_chain(answer):
    """从第一性原理回答中提取推理链"""
    chain_match = re.search(
        r'(?:🔗\s*)?推理链[：:]\s*(.+?)(?:\n\n|\Z)',
        answer, re.DOTALL
    )
    return chain_match.group(1).strip() if chain_match else ""


def _extract_facts_and_assumptions(answer):
    """从第一性原理回答中提取基本事实和假设"""
    facts = re.findall(r'✅\s*基本事实[：:]\s*(.+?)(?:\n|$)', answer)
    assumptions = re.findall(r'❓\s*假设[：:]\s*(.+?)(?:\n|$)', answer)
    return facts, assumptions


def record_reasoning_audit(query, answer_dict, extra_notes=""):
    """
    记录一次推理审计到知识库。
    
    参数:
      query: 用户输入的问题
      answer_dict: local_llm.chat() 返回的结果字典
        {"answer": str, "reasoning_mode": str, "context_used": bool}
      extra_notes: 额外的备注（如用户反馈、纠错等）
    
    返回:
      str: 审计记录的路径
    """
    os.makedirs(AUDIT_DIR, exist_ok=True)

    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S")

    reasoning_mode = answer_dict.get("reasoning_mode", "unknown")
    mode_label = REASONING_MODES.get(reasoning_mode, "未知模式")
    context_used = answer_dict.get("context_used", False)
    answer = answer_dict.get("answer", "")

    # 推理链分析
    reasoning_chain = ""
    facts = []
    assumptions = []
    if reasoning_mode == "first_principles":
        reasoning_chain = _extract_reasoning_chain(answer)
        facts, assumptions = _extract_facts_and_assumptions(answer)

    # 构建审计记录
    audit_entry = _build_audit_entry(
        date_str, time_str, reasoning_mode, mode_label,
        context_used, answer, query, reasoning_chain,
        facts, assumptions, extra_notes
    )

    # 写入文件
    filename = f"reasoning_audit_{date_str}.md"
    filepath = os.path.join(AUDIT_DIR, filename)
    mode = "a" if os.path.exists(filepath) else "w"

    with open(filepath, "a", encoding="utf-8") as f:
        if mode == "a":
            f.write("\n\n---\n\n")
        f.write(audit_entry)

    print(f"[MetaAudit] ✅ 推理审计已记录: {filepath}")
    return filepath


def _build_audit_entry(date_str, time_str, reasoning_mode, mode_label,
                       context_used, answer, query, reasoning_chain,
                       facts, assumptions, extra_notes):
    """构建审计记录文本"""
    entry = f"""---
date: {date_str}
time: {time_str}
type: reasoning_audit
reasoning_mode: {reasoning_mode}
context_used: {context_used}
---

## 🧠 推理审计记录

| 字段 | 值 |
|:----|:----|
| **时间** | {date_str} {time_str} |
| **推理模式** | {mode_label} |
| **知识库引用** | {'✅ 是' if context_used else '❌ 否'} |
| **回答长度** | {len(answer)} 字符 |

### ❓ 问题
```
{query}
```

### 📝 回答摘要
{answer[:500]}{'...' if len(answer) > 500 else ''}
"""

    if reasoning_chain:
        entry += f"""
### 🔗 推理链
{reasoning_chain}
"""

    if facts:
        entry += """
### ✅ 识别的基本事实
"""
        for f in facts:
            entry += f"- {f}\n"

    if assumptions:
        entry += """
### ❓ 识别的假设
"""
        for a in assumptions:
            entry += f"- {a}\n"

    if extra_notes:
        entry += f"""
### 📌 备注
{extra_notes}
"""

    entry += """
---
*由 Friday 元认知扫描器 · 推理审计模块自动生成*
"""
    return entry


def get_recent_audits(days=7):
    """
    获取最近的推理审计记录列表。
    
    参数:
      days: 回溯天数
    
    返回:
      [{"date": str, "path": str, "mode": str, "preview": str}, ...]
    """
    if not os.path.exists(AUDIT_DIR):
        return []

    cutoff = time.time() - days * 86400
    records = []

    for fname in os.listdir(AUDIT_DIR):
        if not fname.endswith(".md"):
            continue
        fpath = os.path.join(AUDIT_DIR, fname)
        mtime = os.path.getmtime(fpath)
        if mtime < cutoff:
            continue

        try:
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read(500)

            mode_match = re.search(r'reasoning_mode:\s*(\w+)', content)
            mode = mode_match.group(1) if mode_match else "unknown"

            query_match = re.search(
                r'### ❓ 问题\n```\n(.+?)\n```', content, re.DOTALL
            )
            preview = query_match.group(1).strip()[:60] if query_match else ""

        except Exception:
            mode = "unknown"
            preview = ""

        records.append({
            "date": datetime.fromtimestamp(mtime).strftime("%Y-%m-%d"),
            "path": fpath,
            "mode": mode,
            "preview": preview or fname,
        })

    records.sort(key=lambda x: x["date"], reverse=True)
    return records


# ── CLI ──────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "scan":
        scan()
    elif len(sys.argv) > 1 and sys.argv[1] == "audit":
        records = get_recent_audits(days=30)
        if not records:
            print("📭 暂无推理审计记录")
        else:
            print(f"📋 最近的推理审计记录（共 {len(records)} 条）:\n")
            for r in records:
                mode_icon = "🧠" if r["mode"] == "first_principles" else "💬"
                print(f"  {r['date']}  {mode_icon} [{r['mode']}] {r['preview']}")
                print(f"       {r['path']}")
                print()
    else:
        print("用法:")
        print("  python metacognition_scanner.py scan    — 执行健康扫描")
        print("  python metacognition_scanner.py audit   — 查看推理审计记录")
