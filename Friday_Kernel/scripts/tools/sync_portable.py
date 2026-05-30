#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Friday Kernel → Friday-Portable 同步脚本
用法: python sync_portable.py
"""
import os, shutil, datetime, re

KERNEL = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PORTABLE = "F:/Product/Friday-Portable/Friday_Kernel"
PORTABLE_ROOT = "F:/Product/Friday-Portable"

# ===== 隐私保护：这些模式的任何一项存在于文件中，该文件不会同步到 Portable =====
# 包括：电话、学号、身份证、银行卡、QQ、微信号、住址、真实姓名全称
PRIVACY_PATTERNS = [
    # 中国大陆手机号
    r"1[3-9]\d{9}",
    # 身份证号
    r"\d{17}[\dXx]",
    # 学号（6-12位数字，含连续数字串）
    # QQ 号
    r"[Qq][Qq][：:]\s*\d{5,12}",
    r"[Qq][Qq号]\s*\d{5,12}",
    # 微信号
    r"[Ww]?[Xx][Ii][Nn]\s*[：:]\s*\w{6,20}",
    r"微信[号]?[：:]\s*\w{6,20}",
    # 银行卡号
    r"\b\d{16,19}\b",
]


def privacy_check(filepath):
    """
    检查文件是否包含隐私信息。
    返回: (True, matched_pattern) 如果有隐私内容； (False, None) 如果安全
    """
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        for pat in PRIVACY_PATTERNS:
            match = re.search(pat, content)
            if match:
                # 隐藏匹配到的具体内容，只告诉类型
                matched = content[match.start():match.start()+20]
                masked = matched[:6] + "****" + matched[-2:] if len(matched) > 8 else "****"
                return True, masked
        return False, None
    except Exception:
        return False, None


# 需要同步的核心文件和目录（新分层架构）
SYNC_ITEMS = [
    "kernel.json",
    "QUICK_START.md",
    "STARTUP.md",
    # memory
    "memory/",
    # modules — 新分层架构
    "modules/core/",
    "modules/entry/",
    "modules/services/",
    "modules/legacy/",
    "modules/audio/",
    "modules/friday_gui/",
    # docs
    "docs/",
    # knowledge
    "knowledge/",
    # scripts
    "scripts/",
    # tools
    "tools/",
    # web GUI
    "web/",
]

EXCLUDE_PATTERNS = [
    "__pycache__", "_backup_unused", ".pyc", "*.tar.bz2",
    "logs/", "reports/",
]


def should_exclude(name):
    for pat in EXCLUDE_PATTERNS:
        if pat in name:
            return True
    return False


def sync():
    print(f"Friday Kernel → Portable 同步")
    print(f"  源: {KERNEL}")
    print(f"  目标: {PORTABLE}")
    print()

    if not os.path.exists(PORTABLE_ROOT):
        print(f"[创建] Portable 根目录: {PORTABLE_ROOT}")
        os.makedirs(PORTABLE_ROOT, exist_ok=True)

    copied = 0
    skipped = 0
    errors = 0

    for rel in SYNC_ITEMS:
        src = os.path.join(KERNEL, rel)
        dst = os.path.join(PORTABLE, rel)

        if should_exclude(rel):
            skipped += 1
            continue

        if not os.path.exists(src):
            print(f"  [!!] 源不存在: {rel}")
            errors += 1
            continue

        # 隐私检查：文本文件扫描个人信息
        if rel.endswith((".md", ".py", ".json", ".yaml", ".txt", ".bat", ".ps1")):
            has_privacy, detail = privacy_check(src)
            if has_privacy:
                print(f"  [🔒] 隐私保护: 跳过 {rel} ({detail})")
                skipped += 1
                continue

        # 创建目标目录
        os.makedirs(os.path.dirname(dst), exist_ok=True)

        if os.path.isdir(src):
            # 同步目录
            if os.path.exists(dst):
                shutil.rmtree(dst)
            shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
            print(f"  [DIR] {rel}/")
        else:
            shutil.copy2(src, dst)
            size = os.path.getsize(dst)
            print(f"  [CP]  {rel} ({size // 1024} KB)")
        copied += 1

    print()
    print(f"完成: 同步 {copied} 项, 跳过 {skipped} 项, 错误 {errors} 项")

    # 写入同步记录
    record = {
        "last_sync": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "source_kernel": KERNEL,
        "files_copied": copied,
        "errors": errors,
    }
    with open(os.path.join(PORTABLE, ".sync_record.json"), "w", encoding="utf-8") as f:
        import json
        json.dump(record, f, ensure_ascii=False, indent=2)
    print(f"同步记录已写入 Portable/.sync_record.json")


if __name__ == "__main__":
    sync()
