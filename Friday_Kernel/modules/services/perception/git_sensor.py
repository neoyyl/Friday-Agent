"""
Git 传感器 — Git 分支 + 提交感知
==================================
读取当前 Git 分支名、最近 N 条提交、未暂存改动文件列表。
自动检测项目根目录（从 Git 仓库根目录）。
"""

import logging
import os
import subprocess
import threading
import time
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger("perception.git")


@dataclass
class GitStatus:
    """当前 Git 仓库状态"""
    branch: str = ""
    recent_commits: List[dict] = field(default_factory=list)
    unstaged_files: List[str] = field(default_factory=list)
    staged_files: List[str] = field(default_factory=list)
    untracked_files: List[str] = field(default_factory=list)
    ahead_behind: str = ""
    repo_root: str = ""
    is_git_repo: bool = False
    error: str = ""
    timestamp: float = 0.0

    def __bool__(self):
        return self.is_git_repo

    def summary(self) -> str:
        """生成简短摘要"""
        if not self.is_git_repo:
            return "不是 Git 仓库"
        parts = [f"分支: {self.branch}"]
        if self.ahead_behind:
            parts.append(self.ahead_behind)
        if self.unstaged_files:
            parts.append(f"未暂存: {len(self.unstaged_files)} 文件")
        if self.staged_files:
            parts.append(f"已暂存: {len(self.staged_files)} 文件")
        if self.untracked_files:
            parts.append(f"未追踪: {len(self.untracked_files)} 文件")
        return " · ".join(parts)


def _run_git(cmd: List[str], cwd: Optional[str] = None) -> tuple:
    """执行 Git 命令，返回 (stdout, stderr, returncode)"""
    try:
        result = subprocess.run(
            ["git"] + cmd,
            capture_output=True,
            text=True,
            cwd=cwd or os.getcwd(),
            timeout=10,
            encoding='utf-8',
            errors='replace',
        )
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except subprocess.TimeoutExpired:
        return "", "timeout", -1
    except FileNotFoundError:
        return "", "git not found", -1
    except Exception as e:
        return "", str(e), -1


def get_repo_root(path: Optional[str] = None) -> str:
    """获取 Git 仓库根目录"""
    out, _, rc = _run_git(["rev-parse", "--show-toplevel"], cwd=path)
    return out if rc == 0 else ""


def get_git_status(path: Optional[str] = None) -> GitStatus:
    """获取 Git 状态"""
    status = GitStatus(timestamp=time.time())

    # 1. 检测是否为 Git 仓库
    root = get_repo_root(path)
    if not root:
        status.error = "not a git repository"
        return status
    status.repo_root = root
    status.is_git_repo = True

    # 2. 分支名
    out, _, rc = _run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=root)
    if rc == 0 and out:
        status.branch = out

    # 3. 最近 5 条提交
    out, _, rc = _run_git(
        ["log", "--oneline", "-5", "--pretty=format:%h|%an|%s|%ar"],
        cwd=root,
    )
    if rc == 0 and out:
        for line in out.split("\n"):
            parts = line.split("|", 3)
            if len(parts) == 4:
                status.recent_commits.append({
                    "hash": parts[0],
                    "author": parts[1],
                    "message": parts[2],
                    "relative_time": parts[3],
                })

    # 4. 未暂存文件 (modified + deleted)
    out, _, rc = _run_git(["status", "--porcelain"], cwd=root)
    if rc == 0 and out:
        for line in out.split("\n"):
            if not line.strip():
                continue
            code = line[:2]
            fpath = line[3:]
            if code == "??":
                status.untracked_files.append(fpath)
            elif code[0] != " ":
                status.staged_files.append(fpath)
            else:
                status.unstaged_files.append(fpath)

    # 5. ahead/behind
    out, _, rc = _run_git(
        ["rev-list", "--count", "--left-right", "HEAD...@{u}"],
        cwd=root,
    )
    if rc == 0 and out:
        parts = out.split("\t")
        if len(parts) == 2:
            status.ahead_behind = f"↑{parts[0]} ↓{parts[1]}"

    return status


class GitSensor:
    """
    Git 传感器。
    定期扫描当前目录的 Git 状态。
    """

    def __init__(self, event_bus=None, poll_interval=10.0):
        self._bus = event_bus
        self._interval = poll_interval
        self._last_status = GitStatus()
        self._running = False
        self._thread = None
        self._watch_dirs = set()
        self._callbacks = []

    def on_change(self, callback):
        self._callbacks.append(callback)

    def add_watch_dir(self, directory: str):
        """添加要监视的目录"""
        if os.path.isdir(directory):
            self._watch_dirs.add(os.path.abspath(directory))

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._poll_loop,
                                        daemon=True, name="git-sensor")
        self._thread.start()
        logger.info("GitSensor 启动 (interval=%ss)", self._interval)

    def stop(self):
        self._running = False

    def _poll_loop(self):
        import threading  # already imported at top
        while self._running:
            try:
                # 检测当前目录（默认从 watch_dirs 或 CWD）
                dirs = list(self._watch_dirs) or [os.getcwd()]
                for d in dirs:
                    status = get_git_status(d)
                    if status.is_git_repo and \
                       status.branch != self._last_status.branch:
                        self._on_git_changed(status)
                        self._last_status = status
            except Exception as e:
                logger.error("Git 检测异常: %s", e)
            time.sleep(self._interval)

    def _on_git_changed(self, status: GitStatus):
        for cb in self._callbacks:
            try:
                cb(status)
            except Exception:
                pass

        if self._bus:
            self._bus.emit("perception.git_changed",
                           branch=status.branch,
                           repo_root=status.repo_root,
                           summary=status.summary(),
                           commit_count=len(status.recent_commits),
                           unstaged_count=len(status.unstaged_files))

    def scan(self, path: Optional[str] = None) -> GitStatus:
        """手动触发一次扫描"""
        status = get_git_status(path)
        if status.is_git_repo:
            self._last_status = status
        return status

    def get_current(self) -> GitStatus:
        return self._last_status
