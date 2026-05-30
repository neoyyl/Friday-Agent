"""主动式Agent - 从被动执行转变为主动预测和改进"""
from skills.skill_base import SkillBase, SkillManifest, SkillResult, create_skill_result


class ProactiveAgentSkill(SkillBase):

    @property
    def manifest(self) -> SkillManifest:
        return SkillManifest(
            id="proactive-agent",
            name="主动式Agent",
            version="1.0.0",
            description="从被动执行转变为主动预测和改进",
            author="Friday",
            capabilities=["proactive", "主动", "预测", "自主"],
            tags=["agent", "meta"],
            icon="🚀",
        )

    async def handle(self, context: dict) -> SkillResult:
        q = context.get("query", "")
        return create_skill_result(
            f"🚀 主动式 Agent\n\n"
            f"WAL 协议 + 工作缓冲区：\n"
            f"- 预测用户需求\n"
            f"- 自主改进工作流\n"
            f"- 主动通知和建议\n"
            f"- 持续自我优化\n\n"
            f"💡 请描述希望 Agent 主动完成的任务")
