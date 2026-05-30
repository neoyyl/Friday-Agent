#!/usr/bin/env python3
"""
Friday Obsidian — 与 Obsidian 知识库联动模块
==============================================
让 Friday 可以直接读写你的 Obsidian 仓库。

能力：
  - 写笔记（自动添加 [[双向链接]] 和标签）
  - 将每日任务产出写入 Obsidian（按日期文件夹归档）
  - 语音快捷记笔记
  - Ingest 工作流：摄入源文件 → 更新知识库（Karpathy LLM Wiki 方法论）

用法：
  python friday_obsidian.py --ingest-daily   → 摄入今日任务产出到 Daily/YYYY-MM-DD/
  python friday_obsidian.py --note '标题' '内容'
  python friday_obsidian.py --quick '快捷笔记内容'
  python friday_obsidian.py --test

作者：Friday Kernel
版本：0.1.0
"""

import os
import sys
import datetime
from pathlib import Path

# ===== 配置：你的 Obsidian 仓库路径 =====
VAULT_PATH = "F:/knowledge/知识库"
TEMPLATES_DIR = "_templates"     # 模板目录

# ===== 确保仓库存在 =====
if not os.path.exists(VAULT_PATH):
    print(f"⚠️ 仓库路径不存在: {VAULT_PATH}")
    print("请修改 VAULT_PATH 为你的实际路径")


def sanitize_filename(title):
    """清理文件名中的非法字符"""
    invalid = r'<>:"/\|?*'
    for c in invalid:
        title = title.replace(c, "_")
    return title.strip()[:100]


def ensure_dir(path):
    """确保目录存在"""
    Path(path).mkdir(parents=True, exist_ok=True)


class ObsidianWriter:
    """Obsidian 笔记写入器"""

    def __init__(self, vault_path=None):
        self.vault = vault_path or VAULT_PATH
        self.today = datetime.date.today()

    # ==================== 基础写笔记 ====================

    def write_note(self, title, content, tags=None, folder=""):
        """
        写一篇笔记到 Obsidian 仓库

        参数:
          title: 笔记标题（也会用作文件名）
          content: 笔记正文（Markdown）
          tags: 标签列表，如 ["AI", "日报"]
          folder: 子目录（相对于仓库），如 "Projects"

        返回:
          笔记文件路径
        """
        filename = sanitize_filename(title) + ".md"
        filepath = os.path.join(self.vault, folder, filename)
        ensure_dir(os.path.dirname(filepath))

        # 构建笔记内容
        md = []

        # YAML frontmatter
        md.append("---")
        md.append(f'created: {self.today.isoformat()}')
        md.append(f'aliases: ["{title}"]')
        if tags:
            md.append(f'tags: [{", ".join(tags)}]')
        md.append("---")
        md.append("")

        # 标题
        md.append(f"# {title}")
        md.append("")

        # 正文
        md.append(content)
        md.append("")

        # 底部元信息
        md.append("---")
        md.append(f"*由 Friday 自动创建于 {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}*")

        result = "\n".join(md)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(result)

        print(f"  ✅ 笔记已写入: {filepath}")
        return filepath

    # ==================== 每日任务产出 ====================

    def write_task_outputs(self, tasks_data):
        """
        将每日任务执行结果写入 Obsidian

        参数:
          tasks_data: dict，包含各任务的执行结果
            {
                "ai_papers": "论文笔记...",
                "news": "新闻简报...",
                "policies": "政策分析...",
                "health": "系统健康报告...",
            }
        """
        date_str = self.today.isoformat()

        # 写入各模块详细内容到 Daily/YYYY-MM-DD/ 日期文件夹
        for key, title_prefix in [
            ("ai_papers", "AI论文笔记"),
            ("news", "每日新闻"),
            ("policies", "政策商机分析"),
            ("health", "系统健康"),
        ]:
            content = tasks_data.get(key)
            if content:
                note_title = f"{date_str} {title_prefix}"
                tags = ["Friday", key.replace("_", "-")]
                folder = f"Daily/{date_str}"
                self.write_note(note_title, content, tags=tags, folder=folder)

    # ==================== 快捷记笔记 ====================

    def quick_note(self, text, tags=None):
        """
        快速记笔记——适合语音输入

        参数:
          text: 笔记内容
          tags: 标签
        """
        # 用第一行作为标题
        lines = text.strip().split("\n")
        title = lines[0][:60] if lines else "快捷笔记"
        content = text
        folder = "Inbox"  # 放入收集箱
        tags = tags or ["inbox", "quick-note"]

        return self.write_note(
            title=f"{self.today.isoformat()} {title}",
            content=content,
            tags=tags,
            folder=folder,
        )

    # ==================== 创建模板 ====================

    def create_template(self, name, content):
        """创建 Obsidian 模板"""
        filepath = os.path.join(self.vault, TEMPLATES_DIR, f"{name}.md")
        ensure_dir(os.path.dirname(filepath))
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  ✅ 模板已创建: {filepath}")
        return filepath


# ==================== 每日任务全量摄入 ====================

    def ingest_daily(self):
        """
        将今日所有任务产出摄入 Obsidian

        自动扫描：
          - Learning evolution/ 下的今日文件
          - Friday_Kernel/reports/ 下的今日健康报告

        产出：
          - AI/Daily/YYYY-MM-DD/ 每日产出归档（AI 文件夹下）
          - AI/meta/index.md + AI/meta/log.md 更新
        """
        date_str = self.today.isoformat()
        # 优先使用环境变量，否则基于内核根目录推导
        default_learn = str(Path(__file__).resolve().parent.parent.parent / ".opencode" / "Learning evolution")
        learning_dirs = [
            os.environ.get("FRIDAY_LEARNING_DIR", default_learn),
        ]
        target_folder = f"08-知识源/每日摄入/{date_str}"

        print(f"\n  📥 每日任务 → Obsidian 摄入 ({date_str})")
        print("-" * 50)

        ingested = self._ingest_source_files(date_str, learning_dirs, target_folder)
        self._update_meta_log(date_str, ingested)
        source_created = self._sync_to_wiki_sources(date_str, ingested)
        self._refresh_index()

        print(f"  ✅ 摄入完成: {len(ingested)} 篇 → Obsidian")
        if source_created:
            print(f"  📝 同步到源摘要: {source_created} 篇")
        for t in ingested:
            print(f"     [[{t}]]")
        print("-" * 50)
        return ingested

    def _ingest_source_files(self, date_str, learning_dirs, target_folder):
        """扫描并摄入今日产出文件（论文笔记/新闻/政策商机）"""
        ingested = []
        sources = [
            ("AI论文笔记", f"{date_str}_每日AI学习笔记.md", ["Friday", "AI", "daily"]),
            ("每日新闻", f"{date_str}_每日新闻.md", ["Friday", "news", "daily"]),
            ("政策商机分析", f"{date_str}_政策商机分析.md", ["Friday", "policy", "daily"]),
            ("综合日报", f"{date_str}_综合日报.md", ["Friday", "daily", "digest"]),
        ]
        for title_suffix, filename, tags in sources:
            content = None
            for ld in learning_dirs:
                fp = os.path.join(ld, filename)
                if os.path.exists(fp):
                    with open(fp, "r", encoding="utf-8") as f:
                        content = f.read()
                    break
            if content:
                title = f"{date_str} {title_suffix}"
                self.write_note(title, content, tags=tags, folder=target_folder)
                ingested.append(title)
        return ingested

    def _update_meta_log(self, date_str, ingested):
        """更新 07-AI系统/线索/log.md 操作日志"""
        if not ingested:
            return
        log_entry = f"\n## [{date_str}] ingest-daily | 自动摄入 {len(ingested)} 篇"
        for t in ingested:
            log_entry += f"\n  - [[{t}]]"
        log_path = os.path.join(self.vault, "07-AI系统", "线索", "log.md")
        ensure_dir(os.path.dirname(log_path))
        if os.path.exists(log_path):
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(f"\n{log_entry}")
        else:
            with open(log_path, "w", encoding="utf-8") as f:
                f.write(f"# 操作日志\n\n## 关于\n\nFriday 自动摄入与同步记录\n\n---\n{log_entry}")

    def _sync_to_wiki_sources(self, date_str, ingested):
        """同步每日摄入到 07-AI系统/源摘要/ 创建摘要页面"""
        sources_dir = os.path.join(self.vault, "07-AI系统", "源摘要")
        ensure_dir(sources_dir)
        source_created = 0
        for t in ingested:
            # 从 target_folder 找源文件
            src_file = os.path.join(self.vault, "08-知识源", "每日摄入", date_str, f"{t}.md")
            if not os.path.exists(src_file):
                continue
            with open(src_file, "r", encoding="utf-8") as f:
                content = f.read()
            source_title = f"{date_str} {t.split(' ', 1)[-1] if ' ' in t else t}"
            wiki_path = os.path.join(sources_dir, f"{sanitize_filename(source_title)}.md")
            if os.path.exists(wiki_path):
                continue
            first_lines = content.strip().split("\n")[:8]
            summary = "\n".join([l for l in first_lines if l.strip() and not l.startswith("#")])
            tag = t.split(' ', 1)[-1] if ' ' in t else 'note'
            wiki_content = f"""---
type: source
tags: [daily, {tag}]
source_date: {date_str}
---

# {source_title}

> 自动摄入自每日产出

## 摘要

{summary}

## 源文件

完整内容见: [[{t}]]

## 关联页面

- [[07-AI系统/线索/log|操作日志]]

---
*由 Friday 自动同步 · {date_str}*
"""
            with open(wiki_path, "w", encoding="utf-8") as f:
                f.write(wiki_content)
            source_created += 1
        return source_created

    def _refresh_index(self):
        """刷新 07-AI系统/线索/index.md"""
        index_path = os.path.join(self.vault, "07-AI系统", "线索", "index.md")
        if not os.path.exists(index_path):
            return

        # 统计各类页面数量
        counts = {}
        for root, dirs, files in os.walk(self.vault):
            for f in files:
                if f.endswith(".md") and not f.startswith("."):
                    rel_dir = os.path.relpath(root, self.vault)
                    if rel_dir == ".":
                        continue
                    cat = rel_dir.split(os.sep)[0]
                    counts[cat] = counts.get(cat, 0) + 1

        # 读取现有 index 并更新统计行
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()

        # 重写首页统计
        import re
        new_header = f"> 最后更新: {self.today.isoformat()}\n> 总页面: {sum(counts.values())}"
        content = re.sub(r"> 最后更新:.*", f"> 最后更新: {self.today.isoformat()}", content)
        content = re.sub(r"> 总页面:.*", f"> 总页面: {sum(counts.values())}", content)

        with open(index_path, "w", encoding="utf-8") as f:
            f.write(content)


# ==================== 命令行入口 ====================

def main():
    if len(sys.argv) < 2:
        print("用法:")
        print("  python friday_obsidian.py --ingest-daily   → 摄入今日任务产出到 08-知识源/每日摄入/ 日期文件夹")
        print("  python friday_obsidian.py --note '标题' '内容'")
        print("  python friday_obsidian.py --quick '快捷笔记内容'")
        print("  python friday_obsidian.py --test")
        return

    writer = ObsidianWriter()

    if sys.argv[1] == "--ingest-daily":
        writer.ingest_daily()
    elif sys.argv[1] == "--note" and len(sys.argv) >= 4:
        writer.write_note(
            sys.argv[2],
            sys.argv[3],
            tags=["Friday", "note"],
            folder="Inbox"
        )
        print(f"\n  ✅ 笔记已写入！")
    elif sys.argv[1] == "--quick" and len(sys.argv) >= 3:
        writer.quick_note(sys.argv[2])
    elif sys.argv[1] == "--test":
        test_content = """
## 测试笔记

这是一条由 Friday 自动创建的测试笔记。

### 功能验证
- [x] 笔记写入 ✅
- [x] 双向链接 [[欢迎]] ✅
- [x] 标签 #Friday/test ✅

---
*测试时间: 2026-05-14*
"""
        writer.write_note("Friday 联动测试", test_content, tags=["Friday", "test"])
        print("\n  ✅ 测试完成！打开 Obsidian 查看效果")
    else:
        print("参数错误")


if __name__ == "__main__":
    main()
