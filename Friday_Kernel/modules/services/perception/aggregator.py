"""
感知聚合器 (Perception Aggregator) — 1.5
==========================================
将 WindowSensor + GitSensor + ProjectSensor 的数据合并为
结构化的感知上下文，自动注入 LLM System Prompt。

输出格式：
  PerceptionContext {
    active_window: { process, title, is_vscode, vscode_file, ... }
    git: { branch, recent_commits, unstaged_files, ... }
    project: { name, type, language, readme_summary, ... }
    timestamp
  }
"""

import json
import logging
import os
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional

from .window_sensor import WindowSensor, get_active_window, parse_vscode_title
from .git_sensor import GitSensor, get_git_status, GitStatus
from .project_sensor import ProjectSensor, scan_project, ProjectInfo

logger = logging.getLogger("perception.aggregator")


@dataclass
class PerceptionContext:
    """完整感知上下文"""
    active_window: dict = field(default_factory=dict)
    git: dict = field(default_factory=dict)
    project: dict = field(default_factory=dict)
    timestamp: str = ""
    formatted: str = ""  # 人类可读格式

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self, indent=2) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)


class PerceptionAggregator:
    """
    感知聚合器 — 将所有传感器数据合并为 LLM Context。
    
    用法:
        agg = PerceptionAggregator(event_bus=bus)
        agg.start()               # 启动所有传感器
        ctx = agg.get_context()   # 获取当前感知上下文
        prompt = agg.format_prompt()  # 生成注入 Prompt 的文本
    """

    def __init__(self, event_bus=None):
        self._bus = event_bus

        # 子传感器
        self.window = WindowSensor(event_bus=event_bus)
        self.git = GitSensor(event_bus=event_bus)
        self.project = ProjectSensor(event_bus=event_bus)

        # 缓存
        self._last_context = PerceptionContext()
        self._workspace_root = ""

        # 自动推导工作目录
        self._detect_workspace()

    def _detect_workspace(self):
        """尝试检测当前工作目录"""
        # 优先从 VS Code 窗口标题检测
        info = get_active_window()
        if info.is_vscode:
            parsed = parse_vscode_title(info.window_title)
            project = parsed.get("project", "")
            # 尝试在常见路径中匹配项目
            for base in [
                os.path.expanduser("~"),
                "F:/AITest",
                "F:/",
                "C:/Users/31822",
            ]:
                candidate = os.path.join(base, project) if project else ""
                if candidate and os.path.isdir(candidate):
                    self._workspace_root = candidate
                    self.git.add_watch_dir(candidate)
                    self.project.set_root(candidate)
                    logger.info("工作目录自动检测: %s", candidate)
                    return

        # 回退到当前目录
        cwd = os.getcwd()
        self._workspace_root = cwd
        self.git.add_watch_dir(cwd)
        self.project.set_root(cwd)
        logger.info("工作目录: %s (fallback)", cwd)

    def set_workspace(self, path: str):
        """手动设置工作目录"""
        if os.path.isdir(path):
            self._workspace_root = os.path.abspath(path)
            self.git.add_watch_dir(self._workspace_root)
            self.project.set_root(self._workspace_root)
            logger.info("工作目录手动设置: %s", self._workspace_root)

    def start(self):
        """启动所有传感器"""
        self.window.start()
        self.git.start()
        self.project.start()
        logger.info("PerceptionAggregator 启动完成")

    def stop(self):
        """停止所有传感器"""
        self.window.stop()
        self.git.stop()
        self.project.stop()

    def get_context(self, refresh=True) -> PerceptionContext:
        """
        获取当前感知上下文。
        refresh=True 时重新扫描 Git 和 Project。
        """
        ctx = PerceptionContext()
        ctx.timestamp = datetime.now().isoformat()

        # 1. 活跃窗口
        win = get_active_window()
        ctx.active_window = asdict(win)
        if win.is_vscode:
            ctx.active_window["vscode_parse"] = parse_vscode_title(win.window_title)
        # 移除 HWND (内部)
        ctx.active_window.pop("hwnd", None)

        # 2. Git 状态
        if refresh:
            git_status = get_git_status(self._workspace_root or None)
        else:
            git_status = self.git.get_current()

        ctx.git = {
            "branch": git_status.branch,
            "is_git_repo": git_status.is_git_repo,
            "repo_root": git_status.repo_root,
            "recent_commits": git_status.recent_commits[:5],
            "unstaged_count": len(git_status.unstaged_files),
            "staged_count": len(git_status.staged_files),
            "untracked_count": len(git_status.untracked_files),
            "unstaged_files": git_status.unstaged_files[:10],
            "summary": git_status.summary(),
        }

        # 3. 项目信息
        if refresh:
            proj = scan_project(self._workspace_root or os.getcwd())
        else:
            proj = self.project.get_current()

        ctx.project = {
            "name": proj.name,
            "type": proj.type,
            "language": proj.language,
            "root": proj.root,
            "readme_summary": proj.readme_summary[:200],
            "entry_files": proj.entry_files,
            "build_files": proj.build_files,
            "dependency_count": len(proj.dependencies),
            "dir_tree_lines": proj.dir_tree_lines,
            "summary": proj.summary(),
        }

        # 4. 生成人类可读格式
        ctx.formatted = self._format_context(ctx)

        self._last_context = ctx
        return ctx

    def _format_context(self, ctx: PerceptionContext) -> str:
        """生成人类可读的感知摘要（可直接注入 System Prompt）"""
        lines = []
        lines.append("-- 当前工作环境感知 --")

        # 窗口
        w = ctx.active_window
        if w.get("process_name"):
            lines.append(f"- 活跃窗口: {w.get('process_name')}")
            lines.append(f"  Title: {w.get('window_title', '')}")

            vscode = w.get("vscode_parse", {})
            if vscode.get("file"):
                lines.append(f"  编辑文件: {vscode['file']}")
                if vscode.get("project"):
                    lines.append(f"  项目: {vscode['project']}")
                if vscode.get("language"):
                    lines.append(f"  文件类型: {vscode['language']}")

        # Git
        g = ctx.git
        if g.get("is_git_repo"):
            lines.append(f"• Git 分支: {g.get('branch', '?')}")
            if g.get("unstaged_count", 0) > 0:
                files = g.get("unstaged_files", [])
                lines.append(f"  未暂存改动 ({g['unstaged_count']}): {', '.join(files[:5])}")
            if g.get("recent_commits"):
                lines.append(f"  最近提交:")
                for c in g["recent_commits"][:3]:
                    lines.append(f"    [{c.get('hash','')}] {c.get('message','')}")
        else:
            if g.get("repo_root"):
                lines.append(f"- Git: {g['repo_root']}")

        # 项目
        p = ctx.project
        if p.get("name"):
            lines.append(f"• 项目: {p['name']} ({p.get('type', '?')})")
            if p.get("readme_summary"):
                summary = p["readme_summary"][:100]
                lines.append(f"  简介: {summary}")
            if p.get("entry_files"):
                lines.append(f"  入口: {', '.join(p['entry_files'][:3])}")

        if len(lines) <= 1:
            lines.append("- 无感知数据")

        result = "\n".join(lines)
        # 替换不能编码的字符
        result = result.replace('\u2022', '-')
        result = result.replace('\u2014', '--')
        result = result.replace('\u2018', "'").replace('\u2019', "'")
        return result

    def format_prompt_block(self) -> str:
        """
        生成可直接注入 System Prompt 的感知数据块。
        适合放在 LLM 的 System Prompt 末尾。
        """
        ctx = self.get_context(refresh=True)

        block = f"""<perception_context timestamp="{ctx.timestamp}">
{ctx.formatted}
</perception_context>"""
        return block

    def on_event(self, event, **data):
        """EventBus 事件触发刷新"""
        if event in ("perception.window_changed", "perception.git_changed",
                     "perception.project_changed"):
            logger.debug("感知事件触发刷新: %s", event)

    @property
    def current(self) -> PerceptionContext:
        return self._last_context

    @property
    def workspace(self) -> str:
        return self._workspace_root
