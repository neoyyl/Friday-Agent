"""前端设计 - 创建高质量的前端界面和组件"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class FrontendDesignSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="frontend-design",
            name="前端设计",
            version="1.0.0",
            description="创建高质量的前端界面和组件",
            author="Friday",
            capabilities=["frontend", "前端", "设计", "ui", "界面"],
            tags=["design", "frontend"],
            icon="🎨",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🎨 前端设计系统\n\n"
            f"创建高质量前端界面：\n"
            f"- React/Vue/Next.js 组件\n"
            f"- 响应式布局\n"
            f"- 设计系统 (Token/主题)\n"
            f"- 动效设计\n\n"
            f"💡 请描述要设计的界面")
