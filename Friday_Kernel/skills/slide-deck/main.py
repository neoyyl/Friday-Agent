"""演示文稿 - 将内容转化为专业幻灯片图片"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class SlideDeckSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="slide-deck",
            name="演示文稿",
            version="1.0.0",
            description="将内容转化为专业幻灯片图片",
            author="Friday",
            capabilities=["slides", "ppt", "演示", "幻灯片", "deck"],
            tags=["creative", "presentation"],
            icon="📽️",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"📽️ 演示文稿生成\n\n"
            f"从内容生成专业幻灯片：\n"
            f"1. 分析内容结构\n"
            f"2. 生成幻灯片大纲\n"
            f"3. 逐页生成全幅图片\n"
            f"4. 组装为 PPTX 文件\n\n"
            f"💡 请提供文章/报告内容或主题")
