"""
Hello World — Friday 示例技能
=============================
展示一个最小可用的 Friday 技能。

用途:
  - 验证热加载系统是否正常工作
  - 作为新技能开发的模板

功能:
  - 收到 "hello" 或 "你好" 时返回问候语
  - 统计调用次数
"""

from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class HelloWorldSkill(SkillBase):
    """最简单的 Friday 技能"""

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="hello-world",
            name="Hello World",
            version="1.0.0",
            description="示例技能 — 验证热加载",
            author="Friday Team",
            capabilities=["hello", "greeting", "test"],
            tags=["example", "demo"],
            icon="👋",
        )

    async def handle(self, context: dict) -> SkillResult:
        query = context.get("query", "")
        name = context.get("speaker", "")

        # 简单的问候
        if any(word in query.lower() for word in ["hello", "hi", "你好", "嗨"]):
            greeting = f"你好{name}！" if name else "你好！欢迎使用 Friday 技能系统 👋"
            return create_skill_result(greeting, data={"greeted": True})

        return create_skill_result(
            f"收到消息: {query[:50]}",
            data={"echo": query},
        )
