"""
Self Heal — Friday 系统自检与自修复模块
=========================================
功能：
  1. 系统文件完整性检查 — 关键文件/目录是否存在
  2. 目录结构维护 — 自动创建缺失的必要目录
  3. 配置文件验证 — JSON/JSON5 语法检查，修复常见问题
  4. 技能清单检查 — 扫描 skill.json 并报告异常
  5. 日志与临时文件清理 — 自动清理过期文件
  6. 健康报告生成 — 综合评分 + 修复建议

用法：
  from services.self_heal import SelfHeal
  heal = SelfHeal()
  report = heal.full_check()
  heal.fix_all(report)
"""

import os
import json
import time
import glob
import shutil
import logging
import datetime
from pathlib import Path

logger = logging.getLogger("friday.service.self_heal")

_REQUIRED_FILES = [
    "kernel.json",
    "scripts/load_kernel.py",
    "modules/__init__.py",
]

_REQUIRED_DIRS = [
    "data",
    "logs",
    "memory",
    "reports",
    "temp",
    "skills",
    "modules/services",
    "modules/core",
    "modules/audio",
    "modules/entry",
    "modules/web",
    "web/static",
    "web/templates",
]

_EXT_SKILL_DIRS = [
    "F:/AITest/.opencode/skills",
    os.path.join(os.environ.get("USERPROFILE", "C:/Users/default"), ".agents", "skills"),
]

_MAX_TEMP_AGE = 86400 * 3  # 3 days
_MAX_LOG_AGE = 86400 * 14  # 14 days


class SelfHeal:
    def __init__(self, kernel_root: str = None):
        self.kernel_root = kernel_root or str(Path(__file__).resolve().parent.parent.parent)
        self.fixes_applied = []

    # ==================== 文件完整性检查 ====================

    def check_files(self) -> list[dict]:
        results = []
        for rel_path in _REQUIRED_FILES:
            full = os.path.join(self.kernel_root, rel_path)
            exists = os.path.isfile(full)
            results.append({
                "type": "file",
                "path": rel_path,
                "full_path": full,
                "exists": exists,
                "status": "ok" if exists else "missing",
                "severity": "high" if not exists else "info",
            })
        return results

    def check_dirs(self) -> list[dict]:
        results = []
        for rel_path in _REQUIRED_DIRS:
            full = os.path.join(self.kernel_root, rel_path)
            exists = os.path.isdir(full)
            results.append({
                "type": "dir",
                "path": rel_path,
                "full_path": full,
                "exists": exists,
                "status": "ok" if exists else "missing",
                "severity": "high" if not exists else "info",
            })
        return results

    def check_skill_jsons(self) -> list[dict]:
        results = []
        skills_dir = os.path.join(self.kernel_root, "skills")
        if not os.path.isdir(skills_dir):
            return results
        for entry in os.scandir(skills_dir):
            if not entry.is_dir():
                continue
            skill_json = os.path.join(entry.path, "skill.json")
            if not os.path.isfile(skill_json):
                results.append({
                    "type": "skill_manifest",
                    "path": f"skills/{entry.name}/skill.json",
                    "full_path": skill_json,
                    "exists": False,
                    "status": "missing",
                    "severity": "medium",
                    "detail": f"技能目录 '{entry.name}' 缺少 skill.json",
                })
                continue
            try:
                with open(skill_json, "r", encoding="utf-8") as f:
                    data = json.load(f)
                missing_fields = []
                for field in ["id", "name", "version", "entry", "class"]:
                    if field not in data:
                        missing_fields.append(field)
                if missing_fields:
                    results.append({
                        "type": "skill_manifest",
                        "path": f"skills/{entry.name}/skill.json",
                        "full_path": skill_json,
                        "exists": True,
                        "status": "invalid",
                        "severity": "medium",
                        "detail": f"缺少必填字段: {', '.join(missing_fields)}",
                    })
                else:
                    results.append({
                        "type": "skill_manifest",
                        "path": f"skills/{entry.name}/skill.json",
                        "full_path": skill_json,
                        "exists": True,
                        "status": "ok",
                        "severity": "info",
                        "detail": f"{data.get('name', entry.name)} v{data.get('version', '?')}",
                    })
            except json.JSONDecodeError as e:
                results.append({
                    "type": "skill_manifest",
                    "path": f"skills/{entry.name}/skill.json",
                    "full_path": skill_json,
                    "exists": True,
                    "status": "corrupted",
                    "severity": "high",
                    "detail": f"JSON 解析失败: {e}",
                })
        return results

    def check_configs(self) -> list[dict]:
        results = []
        config_paths = [
            os.path.join(self.kernel_root, "kernel.json"),
            os.path.join(self.kernel_root, "web", "friday_config.json"),
        ]
        for path in config_paths:
            if not os.path.isfile(path):
                continue
            try:
                with open(path, "r", encoding="utf-8") as f:
                    json.load(f)
                results.append({
                    "type": "config",
                    "path": os.path.relpath(path, self.kernel_root),
                    "full_path": path,
                    "exists": True,
                    "status": "ok",
                    "severity": "info",
                })
            except json.JSONDecodeError as e:
                results.append({
                    "type": "config",
                    "path": os.path.relpath(path, self.kernel_root),
                    "full_path": path,
                    "exists": True,
                    "status": "corrupted",
                    "severity": "high",
                    "detail": f"JSON 解析失败: {e}",
                })
        return results

    def check_temp_files(self) -> list[dict]:
        results = []
        temp_dir = os.path.join(self.kernel_root, "temp")
        if not os.path.isdir(temp_dir):
            return results
        now = time.time()
        count = 0
        size = 0
        for f in glob.glob(os.path.join(temp_dir, "**", "*"), recursive=True):
            if os.path.isfile(f):
                age = now - os.path.getmtime(f)
                if age > _MAX_TEMP_AGE:
                    try:
                        s = os.path.getsize(f)
                        os.remove(f)
                        count += 1
                        size += s
                    except Exception:
                        pass
        if count > 0:
            results.append({
                "type": "cleanup",
                "path": "temp/",
                "exists": True,
                "status": "cleaned",
                "severity": "info",
                "detail": f"已清理 {count} 个过期临时文件 ({size / 1024:.1f} KB)",
            })
        return results

    def check_logs(self) -> list[dict]:
        results = []
        log_dir = os.path.join(self.kernel_root, "logs")
        if not os.path.isdir(log_dir):
            return results
        now = time.time()
        count = 0
        size = 0
        for f in glob.glob(os.path.join(log_dir, "**", "*"), recursive=True):
            if os.path.isfile(f):
                age = now - os.path.getmtime(f)
                if age > _MAX_LOG_AGE:
                    try:
                        s = os.path.getsize(f)
                        os.remove(f)
                        count += 1
                        size += s
                    except Exception:
                        pass
        if count > 0:
            results.append({
                "type": "cleanup",
                "path": "logs/",
                "exists": True,
                "status": "cleaned",
                "severity": "info",
                "detail": f"已清理 {count} 个过期日志文件 ({size / 1024:.1f} KB)",
            })
        return results

    def check_electron_build(self) -> list[dict]:
        results = []
        electron_root = os.path.dirname(self.kernel_root)
        main_ts = os.path.join(electron_root, "electron", "main.ts")
        preload_ts = os.path.join(electron_root, "electron", "preload.ts")
        app_layout = os.path.join(electron_root, "src", "ui", "components", "Layout", "AppLayout.tsx")
        for label, path in [("electron/main.ts", main_ts), ("electron/preload.ts", preload_ts),
                            ("src/ui/.../AppLayout.tsx", app_layout)]:
            results.append({
                "type": "electron_file",
                "path": label,
                "full_path": path,
                "exists": os.path.isfile(path),
                "status": "ok" if os.path.isfile(path) else "missing",
                "severity": "high" if not os.path.isfile(path) else "info",
            })
        return results

    # ==================== 目录修复 ====================

    def fix_missing_dirs(self, items: list[dict]) -> list[dict]:
        fixes = []
        for item in items:
            if item.get("status") == "missing" and item.get("type") == "dir":
                try:
                    os.makedirs(item["full_path"], exist_ok=True)
                    fixes.append({**item, "fixed": True, "action": "created"})
                    logger.info("已创建目录: %s", item["path"])
                except Exception as e:
                    fixes.append({**item, "fixed": False, "action": "failed", "error": str(e)})
        return fixes

    # ==================== 综合检查 ====================

    def full_check(self) -> dict:
        results = {}
        results["files"] = self.check_files()
        results["dirs"] = self.check_dirs()
        results["configs"] = self.check_configs()
        results["skills"] = self.check_skill_jsons()
        results["electron"] = self.check_electron_build()
        results["temp_cleanup"] = self.check_temp_files()
        results["log_cleanup"] = self.check_logs()

        total = sum(len(v) for v in results.values())
        ok = sum(1 for v in results.values() for i in v if i.get("status") == "ok")
        warnings = sum(1 for v in results.values() for i in v if i.get("status") in ("missing", "corrupted"))
        errors = sum(1 for v in results.values() for i in v if i.get("severity") == "high" and i.get("status") != "ok")

        score = max(0, 100 - (errors * 20 + warnings * 5))
        score = min(100, score)

        all_items = []
        for category, items in results.items():
            for item in items:
                all_items.append(item)

        return {
            "score": score,
            "total_checks": total,
            "ok_count": ok,
            "warning_count": warnings,
            "error_count": errors,
            "categories": {
                cat: {"total": len(items), "ok": sum(1 for i in items if i.get("status") == "ok")}
                for cat, items in results.items()
            },
            "items": all_items,
            "timestamp": datetime.datetime.now().isoformat(),
        }

    # ==================== 修复所有 ====================

    def fix_all(self, report: dict = None) -> dict:
        if not report:
            report = self.full_check()
        fixes = []
        dir_fixes = self.fix_missing_dirs(report.get("items", []))
        fixes.extend(dir_fixes)
        return {
            "fixes_applied": len(fixes),
            "fixes": fixes,
            "timestamp": datetime.datetime.now().isoformat(),
        }


# ───────── 全局单例 ─────────

_default_service = None


def get_healer(kernel_root: str = None):
    global _default_service
    if _default_service is None:
        _default_service = SelfHeal(kernel_root=kernel_root)
    return _default_service
