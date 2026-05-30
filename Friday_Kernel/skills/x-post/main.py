"""X/Twitter发布 - 发布内容到 X (Twitter)"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class XPostSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="x-post",
            name="X/Twitter发布",
            version="1.0.0",
            description="发布内容到 X (Twitter)",
            author="Friday",
            capabilities=["x", "twitter", "发推", "tweet"],
            tags=["social", "publishing"],
            icon="🐦",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🐦 X/Twitter 发布\n\n"
            f"支持: 推文 + X Articles (长文)\n"
            f"💡 请描述要发布的内容")
