"""信息图 - 将复杂信息可视化为专业信息图"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class InfographicSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="infographic",
            name="信息图",
            version="1.0.0",
            description="将复杂信息可视化为专业信息图",
            author="Friday",
            capabilities=["infographic", "信息图", "可视化", "数据图"],
            tags=["creative", "data"],
            icon="📊",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"📊 专业信息图生成\n\n"
            f"支持 21 种布局类型 × 22 种视觉风格：\n"
            f"- 时间线、流程图、对比图\n"
            f"- 统计图、地图、层级图\n\n"
            f"💡 请提供需要可视化的内容")
