"""图片卡片 - 生成小红书/微信风格的信息图卡片"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class ImageCardsSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="image-cards",
            name="图片卡片",
            version="1.0.0",
            description="生成小红书/微信风格的信息图卡片",
            author="Friday",
            capabilities=["image-cards", "图片卡片", "小红书", "种草图"],
            tags=["social", "content"],
            icon="🃏",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🃏 图片卡片生成\n\n"
            f"生成社交媒体风格的信息图卡片：\n"
            f"- 12 种视觉风格\n"
            f"- 8 种布局模板\n"
            f"- 3 种配色方案\n\n"
            f"适用平台: 小红书、微信、微博\n"
            f"💡 请提供要制卡的内容")
