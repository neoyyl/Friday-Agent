"""X转Markdown - 将 X/Twitter 推文转为 Markdown"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class BaoyuDangerXMdSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="baoyu-danger-x-md",
            name="X转Markdown",
            version="1.0.0",
            description="将 X/Twitter 推文转为 Markdown",
            author="Friday",
            capabilities=["x-md", "推文转md", "tweet-markdown"],
            tags=["social", "conversion"],
            icon="🐦",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🐦 X/Twitter → Markdown\n\n"
            f"转换推文为结构化 Markdown：\n"
            f"- YAML front matter\n"
            f"- 嵌入媒体\n"
            f"- 线程展开\n\n"
            f"💡 请提供 X/Twitter 链接")
