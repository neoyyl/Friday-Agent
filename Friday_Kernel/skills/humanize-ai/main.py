"""AI文本人性化 - 去除 AI 写作痕迹，通过 AI 检测"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class HumanizeAiSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="humanize-ai",
            name="AI文本人性化",
            version="1.0.0",
            description="去除 AI 写作痕迹，通过 AI 检测",
            author="Friday",
            capabilities=["humanize", "人性化", "ai检测", "降重"],
            tags=["text", "writing"],
            icon="🧑",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🧑 AI 文本人性化\n\n"
            f"基于 Wikipedia 写作特征：\n"
            f"- 去除过度修饰\n"
            f"- 减少规则三\n"
            f"- 避免 AI 高频词\n"
            f"- 增加具体细节\n"
            f"- 自然过渡\n\n"
            f"💡 请提供需要人性化的文本")
