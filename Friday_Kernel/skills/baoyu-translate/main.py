"""精翻 - 三模式翻译: 快速/普通/精翻"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class BaoyuTranslateSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="baoyu-translate",
            name="精翻",
            version="1.0.0",
            description="三模式翻译: 快速/普通/精翻",
            author="Friday",
            capabilities=["translate-pro", "精翻", "专业翻译", "翻译"],
            tags=["language", "translation"],
            icon="🌐",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🌐 专业翻译系统\n\n"
            f"三模式：\n"
            f"- 快翻: 直译\n"
            f"- 普通: 分析后翻译\n"
            f"- 精翻: 分析→翻译→审校→润色\n\n"
            f"支持自定义术语表\n"
            f"💡 请提供翻译内容和目标语言")
