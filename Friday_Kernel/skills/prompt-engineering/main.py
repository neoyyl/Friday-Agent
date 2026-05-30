"""提示词工程 - 高级提示词设计与优化"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class PromptEngineeringSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="prompt-engineering",
            name="提示词工程",
            version="1.0.0",
            description="高级提示词设计与优化",
            author="Friday",
            capabilities=["prompt", "提示词", "prompt-engineering", "提示词工程"],
            tags=["ai", "optimization"],
            icon="✍️",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"✍️ 提示词工程专家\n\n"
            f"优化 AI 对话效果：\n"
            f"- 角色设定 (Role Prompting)\n"
            f"- 思维链 (Chain of Thought)\n"
            f"- Few-shot 示例\n"
            f"- 结构化输出\n"
            f"- 渐进复杂度\n\n"
            f"💡 请描述你的提示词需求")
