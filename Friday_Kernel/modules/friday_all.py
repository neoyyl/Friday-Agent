#!/usr/bin/env python3
"""
[DEPRECATED] Friday — 旧版整合入口
======================================
此文件已废弃，保留仅为向后兼容。

请使用新的入口：
  python -m entry.cli          ← CLI 命令行模式
  python -m entry.nuwa         ← Friday 状态机桥接

v3.0 架构变化：
  - EventBus 是唯一主干
  - 不存在"中心文件"
  - 每个入口是独立的组合根
"""

import sys
import os
import warnings
from pathlib import Path

_MODULE_ROOT = str(Path(__file__).parent)
sys.path.insert(0, _MODULE_ROOT)
sys.path.insert(0, str(Path(_MODULE_ROOT) / "services"))
sys.path.insert(0, str(Path(_MODULE_ROOT) / "legacy"))

warnings.warn(
    "friday_all.py 已废弃，请使用 python -m entry.cli",
    DeprecationWarning,
    stacklevel=2,
)

from entry.cli import main

if __name__ == "__main__":
    print("⚠️  friday_all.py 已废弃，正在转发到 entry.cli ...")
    main()
