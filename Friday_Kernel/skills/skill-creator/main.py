"""Skill创建 - 创建有效的 Agent Skill 指南"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class SkillCreatorSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="skill-creator",
            name="Skill创建",
            version="1.0.0",
            description="创建有效的 Agent Skill 指南",
            author="Friday",
            capabilities=["skill-creator", "创建skill", "技能创建"],
            tags=["meta", "development"],
            icon="🛠️",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🛠️ Skill 创建指南\n\n"
            f"创建有效 Skill：\n"
            f"1. 定义触发条件和能力标签\n"
            f"2. 设计工作流步骤\n"
            f"3. 编写 SKILL.md 指令\n"
            f"4. 添加工具集成\n"
            f"5. 测试和迭代\n\n"
            f"💡 请描述要创建的 Skill")
