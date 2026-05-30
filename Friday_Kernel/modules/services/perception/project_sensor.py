"""
项目结构扫描器 — 自动发现项目元数据
=====================================
读取项目 README → 构建配置 → 入口文件 → 目录结构树。
支持多种项目类型（Python、Node.js、Rust、C++、Go 等）。
"""

import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger("perception.project")


@dataclass
class ProjectInfo:
    """项目信息"""
    name: str = ""
    type: str = ""              # python, node, rust, cpp, go, etc.
    root: str = ""
    readme_summary: str = ""
    build_files: List[str] = field(default_factory=list)
    entry_files: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    language: str = ""
    dir_tree_lines: int = 0     # 目录树行数
    error: str = ""
    timestamp: float = 0.0

    def __bool__(self):
        return bool(self.root) and os.path.isdir(self.root)

    def summary(self) -> str:
        if not self:
            return "无项目信息"
        parts = [f"项目: {self.name}", f"类型: {self.type}"]
        if self.dependencies:
            parts.append(f"依赖: {len(self.dependencies)}")
        if self.entry_files:
            parts.append(f"入口: {self.entry_files[0]}")
        return " · ".join(parts)


# ─── 项目类型检测器 ───

_PROJECT_DETECTORS = [
    # Python
    ({"pyproject.toml", "setup.py", "setup.cfg", "Pipfile"}, "python", "Python"),
    # Node.js
    ({"package.json", "yarn.lock", "pnpm-lock.yaml"}, "node", "JavaScript/TypeScript"),
    # Rust
    ({"Cargo.toml"}, "rust", "Rust"),
    # Go
    ({"go.mod", "go.sum"}, "go", "Go"),
    # C/C++
    ({"CMakeLists.txt", "Makefile", "meson.build"}, "cpp", "C/C++"),
    # .NET
    ({"*.csproj", "*.sln", "*.fsproj"}, "dotnet", "C#"),
    # Java
    ({"pom.xml", "build.gradle", "build.gradle.kts"}, "java", "Java"),
    # Ruby
    ({"Gemfile", "*.gemspec"}, "ruby", "Ruby"),
    # PHP
    ({"composer.json"}, "php", "PHP"),
    # Swift
    ({"Package.swift"}, "swift", "Swift"),
    # Docker
    ({"Dockerfile"}, "docker", "Docker"),
]


def detect_project_type(root: str) -> tuple:
    """检测项目类型，返回 (type_id, language_name)"""
    for markers, type_id, lang in _PROJECT_DETECTORS:
        for marker in markers:
            if marker.startswith("*."):
                # glob pattern
                pattern = marker[1:]
                if list(Path(root).rglob(pattern)):
                    return type_id, lang
            elif os.path.exists(os.path.join(root, marker)):
                return type_id, lang
    return "unknown", "Unknown"


def get_project_name(root: str) -> str:
    """获取项目名称"""
    # 尝试从 package.json / pyproject.toml / Cargo.toml 读取
    paths_to_try = [
        ("package.json", ["name"]),
        ("pyproject.toml", None),  # 需要解析 TOML
        ("Cargo.toml", ["package", "name"]),
        ("go.mod", None),  # 第一行 module name
    ]
    for filename, keys in paths_to_try:
        fpath = os.path.join(root, filename)
        if os.path.exists(fpath):
            try:
                if filename == "package.json":
                    with open(fpath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    return data.get("name", "")
                elif filename == "go.mod":
                    with open(fpath, 'r', encoding='utf-8') as f:
                        first_line = f.readline().strip()
                    if first_line.startswith("module "):
                        return first_line[7:].strip()
                elif filename in ("pyproject.toml", "Cargo.toml"):
                    # 简易读取
                    with open(fpath, 'r', encoding='utf-8') as f:
                        for line in f:
                            if 'name' in line and '=' in line:
                                return line.split('=')[1].strip().strip('"').strip("'")
            except Exception:
                pass
    return os.path.basename(root)


def read_readme_summary(root: str, max_chars=300) -> str:
    """读取 README 摘要"""
    for name in ["README.md", "README.txt", "README", "Readme.md"]:
        fpath = os.path.join(root, name)
        if os.path.exists(fpath):
            try:
                with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                    text = f.read(max_chars)
                # 清理 markdown
                text = re.sub(r'#+\s*', '', text)
                text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
                text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
                text = re.sub(r'[`_*~]', '', text)
                text = text.strip()[:max_chars]
                return text
            except Exception:
                pass
    return ""


def get_entry_files(root: str, type_id: str) -> List[str]:
    """检测入口文件"""
    entries = []
    entry_patterns = {
        "python": ["main.py", "app.py", "run.py", "cli.py", "__main__.py"],
        "node":   ["index.js", "index.ts", "main.js", "app.js", "src/index.js"],
        "rust":   ["src/main.rs", "src/lib.rs"],
        "go":     ["main.go", "cmd/main.go"],
        "cpp":    ["main.cpp", "main.c", "src/main.cpp"],
    }
    for pattern in entry_patterns.get(type_id, []):
        fpath = os.path.join(root, pattern)
        if os.path.exists(fpath):
            entries.append(pattern)
    return entries


def get_dependencies(root: str, type_id: str) -> List[str]:
    """获取依赖列表（摘要）"""
    deps = []
    try:
        if type_id == "python":
            # pyproject.toml
            fpath = os.path.join(root, "pyproject.toml")
            if os.path.exists(fpath):
                with open(fpath, 'r', encoding='utf-8') as f:
                    for line in f:
                        if '=' in line and not line.strip().startswith('['):
                            val = line.split('=')[1].strip().strip('"').strip("'")
                            if val and val[0].isalpha():
                                deps.append(val)
            # requirements.txt
            fpath = os.path.join(root, "requirements.txt")
            if os.path.exists(fpath) and not deps:
                with open(fpath, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#'):
                            deps.append(line.split('==')[0].split('>=')[0].split('<')[0].strip())
        elif type_id == "node":
            fpath = os.path.join(root, "package.json")
            if os.path.exists(fpath):
                with open(fpath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                for key in ["dependencies", "devDependencies"]:
                    for dep in data.get(key, {}):
                        deps.append(dep)
    except Exception:
        pass
    return deps[:30]  # 最多 30 项


def get_dir_tree_depth(root: str, max_depth=3) -> int:
    """计算目录树深度（行数估算）"""
    count = 0
    try:
        for dirpath, dirs, files in os.walk(root):
            rel = os.path.relpath(dirpath, root)
            if rel == ".":
                depth = 0
            else:
                depth = len(rel.split(os.sep))
            if depth > max_depth:
                dirs.clear()  # 不继续深入
                continue
            # 跳过隐藏目录和常见非项目目录
            basename = os.path.basename(dirpath)
            if basename.startswith('.') or basename in (
                "node_modules", "__pycache__", ".git", "venv",
                ".venv", "env", "dist", "build", "target", "bin", "obj"
            ):
                dirs.clear()
                continue
            count += 1
            count += len(files)
    except Exception:
        pass
    return count


def scan_project(root: str) -> ProjectInfo:
    """扫描项目结构"""
    info = ProjectInfo(timestamp=time.time())

    if not root or not os.path.isdir(root):
        info.error = "path not found"
        return info

    info.root = os.path.abspath(root)

    # 项目类型
    type_id, lang = detect_project_type(info.root)
    info.type = type_id
    info.language = lang

    # 项目名
    info.name = get_project_name(info.root)

    # README
    info.readme_summary = read_readme_summary(info.root)

    # 入口文件
    info.entry_files = get_entry_files(info.root, type_id)

    # 依赖
    info.dependencies = get_dependencies(info.root, type_id)[:20]

    # 目录树
    info.dir_tree_lines = get_dir_tree_depth(info.root)

    # 构建配置文件
    for markers, _, _ in _PROJECT_DETECTORS:
        for marker in markers:
            if not marker.startswith("*."):
                fpath = os.path.join(info.root, marker)
                if os.path.exists(fpath):
                    info.build_files.append(marker)

    return info


class ProjectSensor:
    """项目结构扫描器"""

    def __init__(self, event_bus=None, poll_interval=30.0):
        self._bus = event_bus
        self._interval = poll_interval
        self._last_info = ProjectInfo()
        self._running = False
        self._current_root = ""
        self._callbacks = []

    def on_change(self, callback):
        self._callbacks.append(callback)

    def set_root(self, root: str):
        """设置要监视的项目根目录"""
        self._current_root = root

    def start(self):
        if self._running:
            return
        self._running = True
        import threading
        self._thread = threading.Thread(target=self._poll_loop,
                                        daemon=True, name="project-sensor")
        self._thread.start()
        logger.info("ProjectSensor 启动")

    def stop(self):
        self._running = False

    def _poll_loop(self):
        while self._running:
            try:
                if self._current_root and os.path.isdir(self._current_root):
                    info = scan_project(self._current_root)
                    if info.name != self._last_info.name or \
                       info.type != self._last_info.type:
                        self._on_project_changed(info)
                        self._last_info = info
            except Exception as e:
                logger.error("项目扫描异常: %s", e)
            time.sleep(self._interval)

    def _on_project_changed(self, info: ProjectInfo):
        for cb in self._callbacks:
            try:
                cb(info)
            except Exception:
                pass
        if self._bus:
            self._bus.emit("perception.project_changed",
                           name=info.name,
                           type=info.type,
                           language=info.language,
                           root=info.root,
                           entry_count=len(info.entry_files),
                           dep_count=len(info.dependencies))

    def scan(self, root: Optional[str] = None) -> ProjectInfo:
        """手动触发一次扫描"""
        target = root or self._current_root
        if target:
            info = scan_project(target)
            self._last_info = info
            return info
        return ProjectInfo()

    def get_current(self) -> ProjectInfo:
        return self._last_info
