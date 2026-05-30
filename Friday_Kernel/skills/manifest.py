"""
Skill Manifest — 技能清单定义与验证
=====================================
每个技能必须包含 skill.json 清单文件，
定义技能的元数据、入口点、依赖关系。

示例 skill.json:
{
    "id": "hello-world",
    "name": "Hello World",
    "version": "1.0.0",
    "description": "一个简单的示例技能",
    "author": "Friday Team",
    "entry": "main.py",
    "class": "HelloWorldSkill",
    "capabilities": ["hello", "greeting"],
    "license": "MIT",
    "tags": ["example", "tutorial"],
    "icon": "👋",
    "dependencies": []
}
"""

import json
import os
from dataclasses import dataclass, field
from typing import Optional


MANIFEST_FILENAME = "skill.json"

REQUIRED_FIELDS = ["id", "name", "version", "entry", "class"]
VALID_LICENSES = ["MIT", "Apache-2.0", "GPL-3.0", "BSD-3-Clause", "Unlicense", "Proprietary"]


@dataclass
class SkillManifestFile:
    """
    从 skill.json 文件解析的清单

    与 skill_base.SkillManifest 不同，
    这个类包含文件路径和加载相关的字段。
    """
    id: str
    name: str
    version: str = "1.0.0"
    description: str = ""
    author: str = "anonymous"
    entry: str = "main.py"         # 入口文件
    class_name: str = "Skill"      # 类名（在 entry 中）
    capabilities: list = field(default_factory=list)
    license: str = "MIT"
    homepage: str = ""
    dependencies: list = field(default_factory=list)
    tags: list = field(default_factory=list)
    icon: str = "🔌"
    min_friday_version: str = ""     # 最低 Friday OS 版本
    config_schema: dict = field(default_factory=dict)  # 配置项定义
    directory: str = ""            # 技能目录（由加载器填充）

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "author": self.author,
            "entry": self.entry,
            "class": self.class_name,
            "capabilities": self.capabilities,
            "license": self.license,
            "homepage": self.homepage,
            "dependencies": self.dependencies,
            "tags": self.tags,
            "icon": self.icon,
            "min_friday_version": self.min_friday_version,
        }


def validate_manifest(data: dict) -> list:
    """
    验证清单数据

    返回: 错误信息列表（空 = 验证通过）
    """
    errors = []

    # 检查必填字段
    for field_name in REQUIRED_FIELDS:
        if field_name not in data or not data[field_name]:
            errors.append(f"缺少必填字段: {field_name}")

    # 版本号格式
    version = data.get("version", "")
    if version and not _is_valid_semver(version):
        errors.append(f"版本号格式无效: {version} (需要 SemVer 格式)")

    # 许可证
    license_val = data.get("license", "MIT")
    if license_val not in VALID_LICENSES and license_val not in ("", None):
        errors.append(f"未知许可证: {license_val}")

    # ID 格式（只允许小写字母、数字、连字符）
    skill_id = data.get("id", "")
    if skill_id and not all(c.isalnum() or c in "-_" for c in skill_id):
        errors.append(f"技能 ID 只能包含字母、数字、连字符和下划线: {skill_id}")

    return errors


def _is_valid_semver(version: str) -> bool:
    """检查是否为有效的 SemVer 版本号"""
    import re
    return bool(re.match(r'^\d+\.\d+\.\d+$', version))


def load_manifest_from_file(filepath: str) -> Optional[SkillManifestFile]:
    """
    从 skill.json 文件加载清单

    参数:
        filepath: skill.json 的完整路径

    返回:
        SkillManifestFile 或 None（失败）
    """
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        errors = validate_manifest(data)
        if errors:
            import logging
            logging.getLogger("friday.skill.manifest").error(
                "清单验证失败 [%s]: %s", filepath, "; ".join(errors))
            return None

        manifest = SkillManifestFile(
            id=data["id"],
            name=data["name"],
            version=data.get("version", "1.0.0"),
            description=data.get("description", ""),
            author=data.get("author", "anonymous"),
            entry=data["entry"],
            class_name=data["class"],
            capabilities=data.get("capabilities", []),
            license=data.get("license", "MIT"),
            homepage=data.get("homepage", ""),
            dependencies=data.get("dependencies", []),
            tags=data.get("tags", []),
            icon=data.get("icon", "🔌"),
            min_friday_version=data.get("min_friday_version", ""),
            config_schema=data.get("config_schema", {}),
            directory=os.path.dirname(filepath),
        )
        return manifest

    except Exception as e:
        import logging
        logging.getLogger("friday.skill.manifest").error(
            "加载清单失败 [%s]: %s", filepath, e)
        return None
