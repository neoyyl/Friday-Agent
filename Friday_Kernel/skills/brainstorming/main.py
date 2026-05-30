"""头脑风暴 - 结构化头脑风暴，探索创意和方案"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class BrainstormingSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="brainstorming",
            name="头脑风暴",
            version="1.0.0",
            description="结构化头脑风暴，探索创意和方案",
            author="Friday",
            capabilities=["brainstorm", "头脑风暴", "创意", "brainstorming"],
            tags=["creative"],
            icon="💡",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"💡 头脑风暴模式\n\n"
            f"结构化创意探索：\n"
            f"1. 问题重新定义\n"
            f"2. 发散思维 (类比/反转/组合)\n"
            f"3. 收敛筛选\n"
            f"4. 方案细化\n\n"
            f"💡 请描述要头脑风暴的主题")
