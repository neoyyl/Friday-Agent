"""PPT处理 - 创建、检查、编辑 PowerPoint 演示文稿"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class PowerpointSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="powerpoint",
            name="PPT处理",
            version="1.0.0",
            description="创建、检查、编辑 PowerPoint 演示文稿",
            author="Friday",
            capabilities=["pptx", "powerpoint", "ppt", "演示文稿"],
            tags=["office", "presentation"],
            icon="📽️",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"📽️ PowerPoint/PPTX 处理\n\n"
            f"支持: 布局、模板、占位符、\n"
            f"备注、图表、视觉QA\n"
            f"💡 请提供 PPT 操作需求")
