"""WPS办公 - WPS Office 工作流支持"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class WpsSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="wps",
            name="WPS办公",
            version="1.0.0",
            description="WPS Office 工作流支持",
            author="Friday",
            capabilities=["wps", "wps-office", "wps文字", "wps表格"],
            tags=["office"],
            icon="📋",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"📋 WPS Office 工作流\n\n"
            f"支持 Writer/Spreadsheets/Presentation\n"
            f"- 格式兼容处理\n"
            f"- 批注修订\n"
            f"- 模板套用\n"
            f"- 导出 PDF\n\n"
            f"💡 请描述 WPS 操作需求")
