"""封面图 - 为文章生成专业封面图，支持多种比例"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class CoverImageSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="cover-image",
            name="封面图",
            version="1.0.0",
            description="为文章生成专业封面图，支持多种比例",
            author="Friday",
            capabilities=["cover", "封面", "封面图", "banner"],
            tags=["creative", "content"],
            icon="🎬",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🎬 封面图生成\n\n"
            f"5 维度 × 11 色板 × 7 渲染风格：\n"
            f"- 比例: 2.35:1 / 16:9 / 1:1\n"
            f"- 风格: 电影感、扁平、3D、水彩\n\n"
            f"💡 请描述封面主题和风格偏好")
