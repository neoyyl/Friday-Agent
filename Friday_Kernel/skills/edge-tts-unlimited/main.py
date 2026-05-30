"""无限TTS - 免费无限文本转语音"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class EdgeTtsUnlimitedSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="edge-tts-unlimited",
            name="无限TTS",
            version="1.0.0",
            description="免费无限文本转语音",
            author="Friday",
            capabilities=["tts-unlimited", "无限语音", "免费tts"],
            tags=["utility", "voice"],
            icon="🔊",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🔊 无限 TTS (Edge Neural)\n\n"
            f"免费无限文本转语音：\n"
            f"- 无 API Key 需求\n"
            f"- 无字符限制\n"
            f"- 多语言多音色\n"
            f"- 字幕生成\n\n"
            f"💡 请提供要朗读的文本")
