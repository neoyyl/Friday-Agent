"""UI/UX设计 - 专业的 UI/UX 设计智能和实现指导"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class UiUxProSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="ui-ux-pro",
            name="UI/UX设计",
            version="1.0.0",
            description="专业的 UI/UX 设计智能和实现指导",
            author="Friday",
            capabilities=["uiux", "ui/ux", "交互设计", "用户体验"],
            tags=["design", "ux"],
            icon="🎯",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🎯 UI/UX 设计智能\n\n"
            f"专业设计指导：\n"
            f"- 信息架构设计\n"
            f"- 交互流程优化\n"
            f"- 视觉风格定义\n"
            f"- 可访问性 (a11y)\n"
            f"- 设计系统构建\n\n"
            f"💡 请描述你的设计需求")
