"""Markdown转HTML - 将 Markdown 转为微信兼容的 HTML"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class MarkdownToHtmlSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="markdown-to-html",
            name="Markdown转HTML",
            version="1.0.0",
            description="将 Markdown 转为微信兼容的 HTML",
            author="Friday",
            capabilities=["markdown-html", "md转html", "html", "微信排版"],
            tags=["utility", "conversion"],
            icon="📄",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"📄 Markdown → HTML 转换\n\n"
            f"支持: 代码高亮、数学公式、PlantUML、\n"
            f"脚注、提醒框、信息图、外链转底部引用\n\n"
            f"微信兼容: 自动处理外链为底部引用格式\n"
            f"💡 请提供 Markdown 内容或文件路径")
