"""
感知系统 (Perception) — Friday 的感知神经
=========================================
让 Friday 知道你在做什么：编辑器、Git、项目结构、活跃窗口。

传感器:
  - WindowSensor  — 活跃窗口检测 (Win32 API)
  - GitSensor     — Git 分支/提交/文件状态
  - ProjectSensor — 项目元数据扫描
  - Aggregator    — 合并所有数据 → LLM Context
"""
from .window_sensor import WindowSensor, get_active_window, parse_vscode_title, WindowInfo
from .git_sensor import GitSensor, get_git_status, GitStatus
from .project_sensor import ProjectSensor, scan_project, ProjectInfo
from .aggregator import PerceptionAggregator, PerceptionContext
