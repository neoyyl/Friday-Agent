"""深度研究 - 多源深度研究，自动搜索、综合、引用"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class DeepResearchProSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="deep-research-pro",
            name="深度研究",
            version="1.0.0",
            description="多源深度研究，自动搜索、综合、引用",
            author="Friday",
            capabilities=["deep-research", "深度研究", "研究", "调研"],
            tags=["research"],
            icon="🔬",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🔬 深度研究模式\n\n"
            f"自动执行多轮研究：\n"
            f"1. 主题分解 → 子问题\n"
            f"2. 多源搜索 (Web + 学术)\n"
            f"3. 证据层级评估\n"
            f"4. 综合分析 + 引用\n"
            f"5. 生成研究报告\n\n"
            f"💡 请提供研究主题和要求")
