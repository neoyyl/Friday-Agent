#!/usr/bin/env python3
# Friday Kernel 自检脚本

import os
import sys
from pathlib import Path

def check_path(path, name):
    if os.path.exists(path):
        print(f"[OK] {name}: {path}")
        return True
    else:
        print(f"[FAIL] {name}: {path} NOT FOUND")
        return False

def main():
    print("Friday Kernel 自检中...")
    
    # 定义关键路径
    kernel_root = str(Path(__file__).resolve().parent.parent)
    paths = [
        (os.path.join(kernel_root, "kernel.json"), "内核配置"),
        (os.path.join(kernel_root, "memory", "friday_memory.md"), "核心记忆"),
        (os.path.join(kernel_root, "scripts", "load_kernel.py"), "启动脚本"),
        (os.path.join(kernel_root, "docs", "OPERATIONS.md"), "运维文档"),
        (os.path.join(kernel_root, "QUICK_START.md"), "快速指南"),
        (os.path.join(os.environ.get("USERPROFILE", ""), ".opencode.json"), "全局配置")
    ]
    
    # 检查所有路径
    all_ok = True
    for path, name in paths:
        if not check_path(path, name):
            all_ok = False
    
    print("")
    if all_ok:
        print("[PASS] 所有关键文件就绪 - Friday Kernel 状态良好")
        sys.exit(0)
    else:
        print("[FAIL] 系统存在缺失文件，请检查")
        sys.exit(1)

if __name__ == "__main__":
    main()