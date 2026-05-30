"""测试驱动开发 - 红-绿-重构循环的 TDD 实践"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class TddSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="tdd",
            name="测试驱动开发",
            version="1.0.0",
            description="红-绿-重构循环的 TDD 实践",
            author="Friday",
            capabilities=["tdd", "测试驱动", "red-green-refactor", "单元测试"],
            tags=["development", "testing"],
            icon="✅",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"✅ 测试驱动开发 (TDD)\n\n"
            f"红-绿-重构循环：\n"
            f"🔴 红: 写一个失败的测试\n"
            f"🟢 绿: 写最少代码让测试通过\n"
            f"🔵 重构: 改善代码结构\n\n"
            f"💡 请描述要实现的功能")
