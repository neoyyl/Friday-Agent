"""知识漫画 - 将知识内容转化为漫画形式，支持多种画风"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class ComicSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="comic",
            name="知识漫画",
            version="1.0.0",
            description="将知识内容转化为漫画形式，支持多种画风",
            author="Friday",
            capabilities=["comic", "漫画", "知识漫画", "教育漫画"],
            tags=["creative", "education"],
            icon="📚",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"📚 知识漫画生成器\n\n"
            f"将知识内容转化为有趣的漫画：\n"
            f"1. 分解知识点为分镜\n"
            f"2. 设计角色和场景\n"
            f"3. 生成分镜脚本和画面描述\n\n"
            f"支持风格: 写实、Q版、极简、Logicomix风\n"
            f"💡 请描述要漫画化的知识主题")
