"""URL摘要 - 使用 summarize CLI 摘要网页/PDF/视频"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class SummarizeUrlSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="summarize-url",
            name="URL摘要",
            version="1.0.0",
            description="使用 summarize CLI 摘要网页/PDF/视频",
            author="Friday",
            capabilities=["summarize", "url摘要", "网页摘要", "视频摘要"],
            tags=["utility"],
            icon="📋",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"📋 URL/文件摘要\n\n"
            f"支持: 网页、PDF、图片、音频、YouTube\n"
            f"使用 summarize CLI 工具\n"
            f"💡 请提供要摘要的 URL 或文件路径")
