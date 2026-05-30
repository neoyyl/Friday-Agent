"""
Agent Registry — 子代理注册中心
=================================
管理所有可用子代理的元数据、能力匹配、状态追踪。

20 个专业 Agent + 1 个红队 Agent 的完整定义。

设计原则：
  - 每个 Agent 有唯一 ID、名称、角色描述、能力标签
  - 能力标签用于任务-代理匹配
  - 支持按能力/状态筛选
  - 与 EventBus 集成：状态变化自动通知
"""

import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Callable, Optional

logger = logging.getLogger(__name__)


class AgentStatus(str, Enum):
    """代理状态"""
    ACTIVE = "active"        # 可用
    BUSY = "busy"            # 正在执行
    IDLE = "idle"            # 空闲
    ERROR = "error"          # 异常
    DISABLED = "disabled"    # 禁用


class RoutingMode(str, Enum):
    """路由模式"""
    DIRECT = "direct"        # 单 Agent 直接执行
    CHAIN = "chain"          # 链式 A→B→C
    PARALLEL = "parallel"    # 并行执行
    HYBRID = "hybrid"        # 混合模式


@dataclass
class AgentSpec:
    """
    子代理定义规范

    Attributes:
        id:         唯一标识 (01-20 + 21=红队)
        name:       英文名称
        role:       角色描述
        capabilities: 能力标签列表（用于任务匹配）
        status:     当前状态
        description: 详细描述
        tags:       分类标签
    """
    id: str
    name: str
    role: str
    capabilities: list = field(default_factory=list)
    status: str = AgentStatus.ACTIVE
    description: str = ""
    tags: list = field(default_factory=list)
    last_used: Optional[str] = None
    use_count: int = 0
    success_count: int = 0
    avg_rating: float = 0.0

    def to_dict(self) -> dict:
        return asdict(self)


# ───────── 20 + 1 Agent 定义 ─────────

ALL_AGENTS = [
    AgentSpec(
        id="01", name="Researcher", role="搜索与信息获取",
        capabilities=["search", "fetch", "research", "web", "information"],
        description="网络搜索、网页抓取、信息核实",
        tags=["core", "research"],
    ),
    AgentSpec(
        id="02", name="Coder", role="代码编写与调试",
        capabilities=["code", "debug", "programming", "python", "javascript", "refactor"],
        description="编写代码、调试、代码审查、重构",
        tags=["core", "development"],
    ),
    AgentSpec(
        id="03", name="Writer", role="文档撰写与编辑",
        capabilities=["write", "edit", "documentation", "article", "content"],
        description="撰写文档、编辑、内容创作",
        tags=["core", "content"],
    ),
    AgentSpec(
        id="04", name="Academic", role="学术论文与文献",
        capabilities=["academic", "paper", "literature", "citation", "research"],
        description="学术论文搜索、文献综述、APA/MLA 引用",
        tags=["research", "academic"],
    ),
    AgentSpec(
        id="05", name="Companion", role="闲聊与思考",
        capabilities=["chat", "think", "companion", "brainstorm", "idea"],
        description="陪伴聊天、头脑风暴、创意发散",
        tags=["social"],
    ),
    AgentSpec(
        id="06", name="Memory", role="长期记忆管理",
        capabilities=["memory", "remember", "context", "history", "archive"],
        description="长期记忆存取、上下文管理、归档",
        tags=["infra"],
    ),
    AgentSpec(
        id="07", name="Legal", role="法律咨询",
        capabilities=["legal", "law", "contract", "compliance", "regulation"],
        description="法律咨询、合同审查、法规解读",
        tags=["professional", "legal"],
    ),
    AgentSpec(
        id="08", name="Finance", role="财务与预算",
        capabilities=["finance", "budget", "accounting", "cost", "expense"],
        description="财务分析、预算管理、成本核算",
        tags=["professional", "finance"],
    ),
    AgentSpec(
        id="09", name="Marketing", role="推广与运营",
        capabilities=["marketing", "promotion", "social_media", "seo", "growth"],
        description="营销推广、社媒运营、SEO 优化",
        tags=["professional", "marketing"],
    ),
    AgentSpec(
        id="10", name="DataAnalysis", role="数据分析",
        capabilities=["data", "analysis", "statistics", "visualization", "sql", "excel"],
        description="数据分析、统计建模、可视化",
        tags=["core", "data"],
    ),
    AgentSpec(
        id="11", name="Philosophy", role="哲学思辨",
        capabilities=["philosophy", "ethics", "logic", "critical_thinking"],
        description="哲学分析、伦理判断、逻辑论证",
        tags=["thinking"],
    ),
    AgentSpec(
        id="12", name="Health", role="健康咨询",
        capabilities=["health", "medical", "wellness", "nutrition", "exercise"],
        description="健康建议、医疗信息、营养搭配",
        tags=["lifestyle", "health"],
    ),
    AgentSpec(
        id="13", name="Psychology", role="心理学",
        capabilities=["psychology", "mental", "emotion", "counseling", "behavior"],
        description="心理学分析、情绪管理、行为洞察",
        tags=["professional", "psychology"],
    ),
    AgentSpec(
        id="14", name="Education", role="教育辅导",
        capabilities=["education", "tutor", "teaching", "learning", "course"],
        description="教育辅导、课程设计、学习方法",
        tags=["professional", "education"],
    ),
    AgentSpec(
        id="15", name="Investment", role="投资分析",
        capabilities=["investment", "stock", "trading", "portfolio", "risk"],
        description="投资分析、股票研究、风险管理",
        tags=["professional", "investment"],
    ),
    AgentSpec(
        id="16", name="Fitness", role="健身指导",
        capabilities=["fitness", "workout", "exercise", "training", "strength"],
        description="健身计划、训练指导、动作纠正",
        tags=["lifestyle", "fitness"],
    ),
    AgentSpec(
        id="17", name="Food", role="美食与食谱",
        capabilities=["food", "recipe", "cooking", "cuisine", "diet"],
        description="美食推荐、食谱开发、烹饪技巧",
        tags=["lifestyle", "food"],
    ),
    AgentSpec(
        id="18", name="Photography", role="摄影",
        capabilities=["photography", "camera", "photo", "composition", "editing"],
        description="摄影技巧、设备推荐、后期处理",
        tags=["creative", "photography"],
    ),
    AgentSpec(
        id="19", name="Music", role="音乐",
        capabilities=["music", "composition", "instrument", "song", "audio"],
        description="音乐分析、作曲建议、乐器指导",
        tags=["creative", "music"],
    ),
    AgentSpec(
        id="20", name="Workflow", role="自动调度",
        capabilities=["dispatch", "workflow", "automation", "orchestrate", "plan"],
        description="任务自动分解、多 Agent 协同调度、工作流编排",
        tags=["infra", "dispatch"],
    ),
    # 红队 Agent (21)
    AgentSpec(
        id="21", name="RedTeam", role="安全审计与对抗测试",
        capabilities=["audit", "security", "adversarial", "review", "critique", "pentest"],
        description="红队安全审计、对抗性测试、漏洞查找、压力测试",
        tags=["security", "audit"],
    ),
]


class AgentRegistry:
    """
    子代理注册中心

    核心能力：
      - 注册/注销代理
      - 按能力标签匹配最佳代理
      - 状态追踪
      - 统计信息
    """

    def __init__(self, event_bus=None):
        self.bus = event_bus
        self._agents: dict[str, AgentSpec] = {}
        self._implementations: dict[str, Callable] = {}  # agent_id -> callable
        self._custom_agents: dict[str, AgentSpec] = {}

        # 注册所有内置代理
        for agent in ALL_AGENTS:
            self._agents[agent.id] = agent

    # ───────── 代理管理 ─────────

    def register_implementation(self, agent_id: str, callable_fn: Callable):
        """注册代理的具体实现"""
        if agent_id in self._agents:
            self._implementations[agent_id] = callable_fn
            logger.info("Implementation registered for agent %s (%s)",
                       agent_id, self._agents[agent_id].name)

    def register_custom_agent(self, agent: AgentSpec, callable_fn: Callable = None):
        """注册自定义代理"""
        self._custom_agents[agent.id] = agent
        self._agents[agent.id] = agent
        if callable_fn:
            self._implementations[agent.id] = callable_fn
        logger.info("Custom agent registered: %s (%s)", agent.name, agent.id)

    def get_agent(self, agent_id: str) -> Optional[AgentSpec]:
        return self._agents.get(agent_id)

    def get_implementation(self, agent_id: str) -> Optional[Callable]:
        return self._implementations.get(agent_id)

    def has_implementation(self, agent_id: str) -> bool:
        return agent_id in self._implementations

    # ───────── 能力匹配 ─────────

    def find_agents(self, capability: str, status: str = None,
                    min_match: float = 0.0) -> list[AgentSpec]:
        """
        按能力匹配代理。

        参数:
            capability: 能力关键字
            status: 筛选状态 (None=全部)
            min_match: 最低匹配度 (0-1)
        返回:
            按匹配度排序的代理列表
        """
        cap_lower = capability.lower()
        results = []

        for agent in self._agents.values():
            if status and agent.status != status:
                continue

            # 计算匹配度
            match_score = self._calc_match(cap_lower, agent.capabilities)
            if match_score >= min_match:
                results.append((match_score, agent))

        results.sort(key=lambda x: -x[0])
        return [agent for _, agent in results]

    def find_best_agent(self, capability: str) -> Optional[AgentSpec]:
        """找到最匹配的代理"""
        agents = self.find_agents(capability, min_match=0.1)
        return agents[0] if agents else None

    def match_task(self, task_description: str) -> list[AgentSpec]:
        """
        根据任务描述自动匹配所需代理。
        提取关键词，与所有代理的能力标签比对。
        """
        # 简单分词 + 关键词提取
        keywords = self._extract_keywords(task_description)
        scored = []

        for agent in self._agents.values():
            score = 0
            for kw in keywords:
                score += self._calc_match(kw, agent.capabilities)
            if score > 0:
                scored.append((score, agent))

        scored.sort(key=lambda x: -x[0])
        return [a for _, a in scored[:5]]  # 最多返回 5 个

    def _calc_match(self, keyword: str, capabilities: list[str]) -> float:
        """计算关键词与能力标签的匹配度"""
        if not keyword:
            return 0.0
        best = 0.0
        for cap in capabilities:
            cap_lower = cap.lower()
            if keyword == cap_lower:
                return 1.0
            if keyword in cap_lower or cap_lower in keyword:
                best = max(best, 0.7)
            # 部分匹配
            kw_parts = set(keyword.replace("_", " ").split())
            cap_parts = set(cap_lower.replace("_", " ").split())
            if kw_parts & cap_parts:
                best = max(best, 0.4)
        return best

    def _extract_keywords(self, text: str) -> list[str]:
        """从任务描述中提取关键词"""
        # 简单关键词提取
        stop_words = {"的", "了", "是", "在", "把", "被", "把", "让", "给",
                      "我", "你", "他", "她", "它", "们", "这", "那",
                      "a", "an", "the", "is", "are", "was", "were",
                      "to", "for", "with", "by", "at", "in", "of", "on"}
        import re
        words = re.findall(r'[\w]+', text.lower())
        return [w for w in words if w not in stop_words and len(w) > 1]

    # ───────── 状态管理 ─────────

    def set_status(self, agent_id: str, status: str) -> bool:
        """设置代理状态"""
        if agent_id not in self._agents:
            return False
        self._agents[agent_id].status = status
        if self.bus:
            self.bus.emit("agent.status.changed",
                         agent_id=agent_id,
                         name=self._agents[agent_id].name,
                         status=status)
        return True

    def record_usage(self, agent_id: str, success: bool = True, rating: float = 0.0):
        """记录使用情况"""
        if agent_id not in self._agents:
            return
        agent = self._agents[agent_id]
        agent.last_used = datetime.now().isoformat()
        agent.use_count += 1
        if success:
            agent.success_count += 1

        # 加权平均评分
        if rating > 0:
            total = agent.use_count
            agent.avg_rating = (agent.avg_rating * (total - 1) + rating) / total

    # ───────── 查询 ─────────

    def list_agents(self, status: str = None) -> list[dict]:
        """列出代理"""
        agents = self._agents.values()
        if status:
            agents = [a for a in agents if a.status == status]
        return [a.to_dict() for a in sorted(agents, key=lambda x: x.id)]

    def get_stats(self) -> dict:
        """获取统计信息"""
        total = len(self._agents)
        active = sum(1 for a in self._agents.values() if a.status == AgentStatus.ACTIVE)
        busy = sum(1 for a in self._agents.values() if a.status == AgentStatus.BUSY)
        total_uses = sum(a.use_count for a in self._agents.values())
        return {
            "total": total,
            "active": active,
            "busy": busy,
            "total_uses": total_uses,
            "implemented": len(self._implementations),
        }


# ───────── 全局单例 ─────────

_default_registry = None


def get_registry(event_bus=None):
    global _default_registry
    if _default_registry is None:
        _default_registry = AgentRegistry(event_bus=event_bus)
    return _default_registry
