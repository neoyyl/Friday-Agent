"""Skill审查 - 安全审查 Skill，检查可疑模式"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class SkillVetterSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="skill-vetter",
            name="Skill审查",
            version="1.0.0",
            description="安全审查 Skill，检查可疑模式",
            author="Friday",
            capabilities=["vet", "审查", "安全审查", "skill-vetter"],
            tags=["security", "meta"],
            icon="🛡️",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🛡️ Skill 安全审查\n\n"
            f"检查项目：\n"
            f"- 可疑代码模式\n"
            f"- 权限范围\n"
            f"- 供应链风险\n"
            f"- 数据安全\n\n"
            f"💡 请提供要审查的 Skill 信息")
