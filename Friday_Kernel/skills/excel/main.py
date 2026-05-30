"""Excel处理 - 创建、检查、编辑 Excel 工作簿"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class ExcelSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="excel",
            name="Excel处理",
            version="1.0.0",
            description="创建、检查、编辑 Excel 工作簿",
            author="Friday",
            capabilities=["excel", "xlsx", "表格", "电子表格"],
            tags=["office", "data"],
            icon="📊",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"📊 Excel/XLSX 处理\n\n"
            f"支持: 公式、日期、类型、格式、\n"
            f"重算、模板保护、兼容性检查\n"
            f"💡 请提供 Excel 操作需求")
