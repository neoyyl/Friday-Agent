"""微信公众号 - 发布内容到微信公众号"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class WechatPostSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="wechat-post",
            name="微信公众号",
            version="1.0.0",
            description="发布内容到微信公众号",
            author="Friday",
            capabilities=["wechat", "微信", "公众号", "发布公众号"],
            tags=["social", "publishing"],
            icon="📱",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"📱 微信公众号发布\n\n"
            f"支持: 文章(HTML/Markdown) + 图文贴图\n"
            f"自动外链转底部引用\n"
            f"💡 请描述要发布的内容")
