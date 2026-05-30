"""学术深度研究 - 透明严谨的学术研究方法论"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class AcademicDeepResearchSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="academic-deep-research",
            name="学术深度研究",
            version="1.0.0",
            description="透明严谨的学术研究方法论",
            author="Friday",
            capabilities=["academic-research", "学术研究", "文献综述", "研究方法"],
            tags=["research", "academic"],
            icon="🎓",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🎓 学术深度研究\n\n"
            f"严谨研究方法：\n"
            f"- 2 轮研究/主题\n"
            f"- APA 7th 引用\n"
            f"- 证据层级评估\n"
            f"- 3 个用户检查点\n\n"
            f"💡 请提供研究主题和要求")
