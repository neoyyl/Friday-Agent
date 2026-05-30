"""Markdown格式化 - 格式化 Markdown 文件"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class BaoyuFormatMdSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="baoyu-format-md",
            name="Markdown格式化",
            version="1.0.0",
            description="格式化 Markdown 文件",
            author="Friday",
            capabilities=["format-md", "markdown格式", "美化markdown"],
            tags=["utility", "formatting"],
            icon="📝",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"📝 Markdown 格式化\n\n"
            f"美化 Markdown 文件：\n"
            f"- 标题层级\n"
            f"- 列表格式\n"
            f"- 代码块\n"
            f"- 前置元数据\n\n"
            f"💡 请提供要格式化的 Markdown")
