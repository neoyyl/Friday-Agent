"""图片压缩 - 压缩图片为 WebP/PNG"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class BaoyuCompressImgSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="baoyu-compress-img",
            name="图片压缩",
            version="1.0.0",
            description="压缩图片为 WebP/PNG",
            author="Friday",
            capabilities=["compress", "图片压缩", "压缩图片", "webp"],
            tags=["utility", "image"],
            icon="🖼️",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🖼️ 图片压缩\n\n"
            f"自动选择最佳工具：\n"
            f"- WebP (默认，推荐)\n"
            f"- PNG (无损)\n"
            f"- 批量处理\n\n"
            f"💡 请提供图片路径")
