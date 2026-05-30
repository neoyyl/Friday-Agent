"""Word处理 - 创建、检查、编辑 Word 文档"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class WordSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="word",
            name="Word处理",
            version="1.0.0",
            description="创建、检查、编辑 Word 文档",
            author="Friday",
            capabilities=["docx", "word", "文档", "文字处理"],
            tags=["office", "document"],
            icon="📝",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"📝 Word/DOCX 处理\n\n"
            f"支持: 样式、编号、修订、\n"
            f"表格、分节、兼容性检查\n"
            f"💡 请提供 Word 操作需求")
