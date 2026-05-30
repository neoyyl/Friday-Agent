"""PDF编辑 - 使用自然语言编辑 PDF 文件"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class PdfSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="pdf",
            name="PDF编辑",
            version="1.0.0",
            description="使用自然语言编辑 PDF 文件",
            author="Friday",
            capabilities=["pdf", "pdf编辑", "pdf转换"],
            tags=["office", "document"],
            icon="📄",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"📄 PDF 编辑\n\n"
            f"使用自然语言指令编辑 PDF：\n"
            f"- 合并/拆分页面\n"
            f"- 添加水印/页码\n"
            f"- 提取文本/图片\n"
            f"- 格式转换\n\n"
            f"💡 请描述 PDF 编辑需求")
