"""调试专家 - 系统化调试方法论和语言特定调试命令"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class DebugProSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="debug-pro",
            name="调试专家",
            version="1.0.0",
            description="系统化调试方法论和语言特定调试命令",
            author="Friday",
            capabilities=["debug", "调试", "debugging", "排错"],
            tags=["development", "debugging"],
            icon="🐛",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🐛 系统化调试\n\n"
            f"四阶段调试法：\n"
            f"1. 调查: 收集错误信息和上下文\n"
            f"2. 分析: 缩小范围，定位根因\n"
            f"3. 假设: 形成并验证假设\n"
            f"4. 实施: 修复并验证\n\n"
            f"铁律: 没有根因分析就不修复\n"
            f"💡 请描述遇到的问题")
