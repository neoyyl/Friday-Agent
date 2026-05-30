"""微博发布 - 发布内容到微博"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class WeiboPostSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="weibo-post",
            name="微博发布",
            version="1.0.0",
            description="发布内容到微博",
            author="Friday",
            capabilities=["weibo", "微博", "发微博"],
            tags=["social", "publishing"],
            icon="📢",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"📢 微博发布\n\n"
            f"支持: 普通微博 + 头条文章(Markdown)\n"
            f"💡 请描述要发布的内容")
