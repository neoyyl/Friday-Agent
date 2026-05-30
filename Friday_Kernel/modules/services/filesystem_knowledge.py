#!/usr/bin/env python3
"""
Friday OS Layer - 文件系统安全知识图谱
========================================
Friday 知道什么文件能碰、什么不能碰。

这不仅仅是一个黑名单/白名单。
这是 Friday 对 Windows 文件系统的"理解"——
知道系统文件、用户文件、临时文件、缓存文件的区别，
知道哪些目录删除是安全的，哪些会崩系统。

作者：Friday Kernel
版本：0.1.0
"""

import os
from pathlib import Path


class FileSystemKnowledge:
    """
    文件系统知识图谱

    每个路径都有安全等级和说明，Friday 据此决策：
      - safe:      直接操作，不需要问你
      - cautious:  操作前提醒你
      - dangerous: 绝不触碰（除非你明确要求）
    """

    def __init__(self):
        # ========== Windows 系统核心 ==========
        self.system_root = os.environ.get("SystemRoot", "C:\\Windows")
        self.program_files = os.environ.get("ProgramFiles", "C:\\Program Files")
        self.program_files_x86 = os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")
        self.user_profile = os.environ.get("USERPROFILE", "C:\\Users\\Default")
        self.temp = os.environ.get("TEMP", os.environ.get("TMP", "C:\\Windows\\Temp"))
        self.appdata = os.environ.get("APPDATA", "")
        self.local_appdata = os.environ.get("LOCALAPPDATA", "")

        # ========== 构建知识图谱 ==========
        self.knowledge = self._build_knowledge_base()

    def _build_knowledge_base(self):
        """构建完整的文件系统知识图谱"""
        return {
            # ==================== 🔴 禁区 ====================
            # 触碰这些 → 系统崩溃
            "forbidden": {
                "paths": [
                    # Windows 系统核心
                    rf"{self.system_root}\System32",
                    rf"{self.system_root}\SysWOW64",
                    rf"{self.system_root}\WinSxS",
                    rf"{self.system_root}\assembly",
                    rf"{self.system_root}\Microsoft.NET",
                    rf"{self.system_root}\Installer",
                    rf"{self.system_root}\Globalization",
                    rf"{self.system_root}\INF",
                    rf"{self.system_root}\Help",
                    rf"{self.system_root}\Branding",
                    rf"{self.system_root}\Cursors",
                    # 引导相关
                    r"C:\Boot",
                    r"C:\bootmgr",
                    r"C:\BOOTSECT.BAK",
                    # 系统卷信息
                    r"C:\System Volume Information",
                    r"C:\$Recycle.Bin",
                    r"C:\$WinREAgent",
                    # 系统文件（不要直接删除）
                    r"C:\pagefile.sys",
                    r"C:\hiberfil.sys",
                    r"C:\swapfile.sys",
                    # 驱动程序
                    rf"{self.system_root}\System32\drivers",
                ],
                "patterns": [
                    # 系统 DLL（个别除外）
                    r"*.dll",
                    # 系统驱动
                    r"*.sys",
                    # Windows 更新备份
                    r"WinSxS\*",
                ],
                "description": "系统核心文件，删除会导致系统崩溃或无法启动",
            },

            # ==================== 🟡 谨慎区 ====================
            # 操作前应该确认
            "cautious": {
                "paths": [
                    # 程序安装目录
                    self.program_files,
                    self.program_files_x86,
                    # Windows 目录本身
                    self.system_root,
                    # 用户默认配置
                    r"C:\Users\Default",
                    r"C:\Users\Public",
                    # 注册表备份
                    rf"{self.system_root}\System32\config\RegBack",
                    # .NET 临时文件
                    rf"{self.system_root}\Microsoft.NET\Framework",
                    rf"{self.system_root}\Microsoft.NET\Framework64",
                ],
                "description": "程序安装和系统配置文件，删除可能导致软件无法运行",
            },

            # ==================== 🟢 安全区 ====================
            # 可直接操作，不需要问你
            "safe": {
                "paths": [
                    # 临时文件
                    self.temp,
                    rf"{self.user_profile}\AppData\Local\Temp",
                    # 用户文档
                    rf"{self.user_profile}\Documents",
                    rf"{self.user_profile}\Desktop",
                    rf"{self.user_profile}\Downloads",
                    rf"{self.user_profile}\Pictures",
                    rf"{self.user_profile}\Music",
                    rf"{self.user_profile}\Videos",
                    # 应用数据缓存（可按需清理）
                    rf"{self.local_appdata}\Microsoft\Windows\INetCache",
                    rf"{self.local_appdata}\Microsoft\Windows\WER",
                    # 回收站
                    r"C:\$Recycle.Bin",
                    # 日志文件
                    rf"{self.system_root}\Logs",
                    rf"{self.system_root}\Temp",
                    rf"{self.system_root}\SoftwareDistribution\Download",
                    # 用户自己的项目目录
                    "D:\\",
                    "E:\\",
                    "F:\\",
                ],
                "patterns": [
                    # 常见可删的临时后缀
                    r"*.tmp",
                    r"*.temp",
                    r"*.log",
                    r"*.cache",
                    r"*.bak",
                    r"*.old",
                    # 缩略图缓存
                    r"Thumbs.db",
                ],
                "description": "用户数据和临时文件，安全可操作",
            },

            # ==================== 🟢 安全操作清单 ====================
            # Friday 可以自动执行的系统维护操作
            "auto_maintenance": {
                "tasks": [
                    {
                        "name": "清理临时文件",
                        "targets": [
                            self.temp,
                            rf"{self.user_profile}\AppData\Local\Temp",
                        ],
                        "condition": "目录存在且非空",
                        "risk": "低",
                        "description": "删除 Windows 和用户临时文件",
                    },
                    {
                        "name": "清理回收站",
                        "targets": ["C:\\$Recycle.Bin"],
                        "condition": "回收站非空",
                        "risk": "低",
                        "description": "清空回收站释放空间",
                    },
                    {
                        "name": "清理Windows更新缓存",
                        "targets": [
                            rf"{self.system_root}\SoftwareDistribution\Download"
                        ],
                        "condition": "目录存在且非空",
                        "risk": "低",
                        "description": "删除已安装的更新安装包缓存",
                    },
                    {
                        "name": "清理错误报告",
                        "targets": [
                            rf"{self.local_appdata}\Microsoft\Windows\WER"
                        ],
                        "condition": "目录存在且非空",
                        "risk": "低",
                        "description": "删除 Windows 错误报告文件",
                    },
                    {
                        "name": "清理浏览器缓存",
                        "targets": [
                            rf"{self.local_appdata}\Microsoft\Windows\INetCache"
                        ],
                        "condition": "目录存在且非空",
                        "risk": "低",
                        "description": "删除 Internet Explorer/Edge 缓存",
                    },
                    {
                        "name": "磁盘清理建议",
                        "targets": [],
                        "condition": "任意分区使用率 > 85%",
                        "risk": "信息",
                        "description": "建议运行系统磁盘清理或手动整理大文件",
                    },
                ]
            },
        }

    # ==================== 查询方法 ====================

    def classify_path(self, path):
        """
        判断一个路径的安全等级

        返回:
          ("safe", 说明) / ("cautious", 说明) / ("forbidden", 说明) / ("unknown", 说明)
        """
        path = str(path).lower().rstrip("\\")

        # 检查禁区
        for fp in self.knowledge["forbidden"]["paths"]:
            if fp.lower() in path or path in fp.lower():
                return ("forbidden", self.knowledge["forbidden"]["description"])

        # 检查谨慎区
        for cp in self.knowledge["cautious"]["paths"]:
            if cp.lower() in path or path in cp.lower():
                return ("cautious", self.knowledge["cautious"]["description"])

        # 检查安全区
        for sp in self.knowledge["safe"]["paths"]:
            if sp and (sp.lower() in path or path in sp.lower()):
                return ("safe", self.knowledge["safe"]["description"])

        # 检查文件后缀
        ext = os.path.splitext(path)[1].lower()
        for pattern in self.knowledge["safe"]["patterns"]:
            if pattern.startswith("*") and ext == pattern[1:]:
                return ("safe", "临时/缓存文件，可安全删除")
            if pattern in path:
                return ("safe", "临时/缓存文件，可安全删除")

        # 默认：unknown → 保守处理，归入谨慎
        return ("cautious", "未知路径，建议确认后操作")

    def get_maintenance_tasks(self, disk_usages=None):
        """
        获取推荐的系统维护任务

        参数:
          disk_usages: dict of {mountpoint: percent_used}
        """
        tasks = []

        for task in self.knowledge["auto_maintenance"]["tasks"]:
            if task["name"] == "磁盘清理建议" and disk_usages:
                for mp, pct in disk_usages.items():
                    if isinstance(pct, (int, float)) and pct > 85:
                        tasks.append({
                            "name": f"⚠️ {mp} 磁盘使用率 {pct}%",
                            "risk": "中",
                            "description": f"{mp} 使用率已达 {pct}%，建议清理或扩容",
                        })
            else:
                # 检查目标目录是否存在且非空
                exists = False
                for target in task["targets"]:
                    p = Path(target)
                    if p.exists() and any(p.iterdir()):
                        exists = True
                        break
                if exists:
                    tasks.append(task)

        return tasks

    def generate_markdown(self):
        """生成知识图谱的 Markdown 文档"""
        lines = []
        lines.append("# 📚 Friday 文件系统安全知识图谱")
        lines.append(f"")
        lines.append(f"**系统根目录**: {self.system_root}")
        lines.append(f"**用户目录**: {self.user_profile}")
        lines.append(f"**程序目录**: {self.program_files}")
        lines.append(f"")

        # 禁区
        lines.append(f"## 🔴 禁区（绝不触碰）")
        lines.append(f"{self.knowledge['forbidden']['description']}")
        for p in self.knowledge["forbidden"]["paths"]:
            lines.append(f"- `{p}`")
        lines.append(f"")

        # 谨慎区
        lines.append(f"## 🟡 谨慎区（操作前确认）")
        lines.append(f"{self.knowledge['cautious']['description']}")
        for p in self.knowledge["cautious"]["paths"]:
            lines.append(f"- `{p}`")
        lines.append(f"")

        # 安全区
        lines.append(f"## 🟢 安全区（可直接操作）")
        lines.append(f"{self.knowledge['safe']['description']}")
        for p in self.knowledge["safe"]["paths"]:
            lines.append(f"- `{p}`")
        lines.append(f"")

        # 维护任务
        lines.append(f"## 🔧 自动维护任务")
        for t in self.knowledge["auto_maintenance"]["tasks"]:
            risk_icon = {"低": "🟢", "中": "🟡", "高": "🔴", "信息": "ℹ️"}
            lines.append(f"- {risk_icon.get(t['risk'], '❓')} **{t['name']}**: {t['description']}")
        lines.append(f"")

        lines.append(f"---")
        lines.append(f"*知识版本: 0.1.0 · 由 Friday OS Layer 管理*")
        return "\n".join(lines)


# ==================== 独立运行 ====================

def main():
    fs = FileSystemKnowledge()

    # 测试一些常见路径
    test_paths = [
        r"C:\Windows\System32\ntdll.dll",
        r"C:\Program Files\Google\Chrome\chrome.exe",
        os.environ.get("TEMP", "C:\\Windows\\Temp"),
        os.environ.get("USERPROFILE", "") + "\\Documents\\test.txt",
        r"C:\pagefile.sys",
        r"D:\Projects\myapp",
        r"C:\some_random_path\file.exe",
    ]

    print("=" * 60)
    print("  Friday 文件系统安全知识图谱 — 路径分类测试")
    print("=" * 60)
    for test_path in test_paths:
        level, desc = fs.classify_path(test_path)
        icon = {"safe": "🟢", "cautious": "🟡", "forbidden": "🔴", "unknown": "❓"}
        print(f"  {icon.get(level, '❓')} [{level.upper():>9}] {test_path}")
        print(f"      → {desc}")

    print("-" * 60)
    tasks = fs.get_maintenance_tasks({"C:": 87.0, "D:": 77.5, "E:": 95.8, "F:": 77.3})
    print(f"  推荐的维护任务: {len(tasks)} 项")
    for t in tasks:
        print(f"  - {t['name']}")
    print("=" * 60)

    # 保存知识图谱
    knowledge_dir = Path(__file__).parent.parent / "knowledge"
    knowledge_dir.mkdir(exist_ok=True)
    out_file = knowledge_dir / "filesystem_knowledge.md"
    out_file.write_text(fs.generate_markdown(), encoding="utf-8")
    print(f"  知识图谱已保存: {out_file}")
    print("=" * 60)


if __name__ == "__main__":
    main()
