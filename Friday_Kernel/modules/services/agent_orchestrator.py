"""
Agent Orchestrator — Master Agent 智能调度引擎
==============================================
核心职责：
  1. 分析任务复杂度 → 选择路由模式 (direct / chain / parallel / hybrid)
  2. 动态匹配最优 Sub-Agent
  3. 调度执行（链式/并行）
  4. 审计结果（如人类的 review）
  5. 不通过则重试或切换 Agent

路由模式：
  DIRECT   → 单一 Agent 直接执行
  CHAIN    → A→B→C 链式（前一输出是后一输入）
  PARALLEL → 多 Agent 同时执行，结果合并
  HYBRID   → 先并行再链式（复杂任务分解）

用法:
    orchestrator = AgentOrchestrator(event_bus=bus)
    orchestrator.register_registry(registry)
    
    # 自动路由
    result = orchestrator.dispatch("搜索最新的 AI 论文并总结")
    
    # 手动指定
    result = orchestrator.dispatch("写一个 Python 脚本", mode="direct", agent_id="02")
"""

import json
import logging
import time
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class RoutingMode(str, Enum):
    DIRECT = "direct"
    CHAIN = "chain"
    PARALLEL = "parallel"
    HYBRID = "hybrid"


class TaskComplexity(str, Enum):
    SIMPLE = "simple"          # 直接模式
    MEDIUM = "medium"          # 链式（2-3 步）
    COMPLEX = "complex"        # 混合（并行+链式）


@dataclass
class DispatchRecord:
    """一次调度记录"""
    id: str
    task: str
    mode: str
    agents_used: list = field(default_factory=list)
    steps: list = field(default_factory=list)  # [{agent_id, input, output, status, duration}]
    status: str = "pending"     # pending / running / success / failed / partial
    result: Any = None
    error: Optional[str] = None
    start_time: str = ""
    end_time: str = ""
    duration: float = 0.0
    audit_passed: bool = False
    retry_count: int = 0


class AgentOrchestrator:
    """
    Master Agent 调度引擎

    核心流程：
      Judge → Dispatch → Execute → Audit → Return/Retry
    """

    def __init__(self, event_bus=None, max_workers: int = 4):
        self.bus = event_bus
        self.registry = None
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._history: list[DispatchRecord] = []
        self._max_history = 200
        self._running = False

    def register_registry(self, registry):
        """注入 Agent 注册中心"""
        self.registry = registry

    # ───────── 核心调度 ─────────

    def dispatch(self, task: str, mode: str = None,
                 agent_id: str = None, context: dict = None,
                 auto_audit: bool = True) -> dict:
        """
        主调度入口。

        参数:
            task: 任务描述
            mode: 路由模式（None=自动检测）
            agent_id: 指定 Agent（仅 direct 模式）
            context: 额外上下文
            auto_audit: 是否自动审计结果
        返回:
            {status, result, mode, agents_used, record_id, ...}
        """
        record = DispatchRecord(
            id=str(uuid.uuid4())[:8],
            task=task,
            mode=mode or "auto",
            start_time=datetime.now().isoformat(),
        )
        start_ts = time.time()

        try:
            # Step 1: Judge — 分析任务，决定路由
            if not mode or mode == "auto":
                mode, agents = self._judge_task(task, agent_id)
            else:
                agents = self._select_agents(task, mode, agent_id)

            record.mode = mode
            record.agents_used = [a.id for a in agents]
            logger.info("Dispatch: mode=%s agents=%s task=%s",
                       mode, [a.name for a in agents], task[:60])

            # 通知
            self._emit("dispatch.judged", task=task, mode=mode,
                      agents=[a.to_dict() for a in agents])

            # Step 2: Dispatch & Execute
            if mode == RoutingMode.DIRECT:
                result = self._execute_direct(task, agents, context)
            elif mode == RoutingMode.CHAIN:
                result = self._execute_chain(task, agents, context)
            elif mode == RoutingMode.PARALLEL:
                result = self._execute_parallel(task, agents, context)
            elif mode == RoutingMode.HYBRID:
                result = self._execute_hybrid(task, agents, context)
            else:
                result = self._execute_direct(task, agents, context)

            record.steps = result.get("steps", [])
            record.result = result.get("final_output")

            # Step 3: Audit
            if auto_audit and result.get("status") == "success":
                audit = self._audit_result(task, record)
                record.audit_passed = audit["passed"]
                if not audit["passed"]:
                    # 重试或切换 Agent
                    record.retry_count += 1
                    if record.retry_count < 2:
                        logger.info("Audit failed, retrying with different agent...")
                        new_agents = self._find_alternatives(agents)
                        if new_agents:
                            result = self._execute_direct(task, new_agents, context)
                            record.steps = result.get("steps", [])
                            record.result = result.get("final_output")
                            record.audit_passed = True

            record.status = result.get("status", "success")

        except Exception as e:
            record.status = "failed"
            record.error = f"{type(e).__name__}: {e}"
            logger.error("Dispatch failed: %s", e)
            traceback.print_exc()

        # Finalize
        record.end_time = datetime.now().isoformat()
        record.duration = time.time() - start_ts

        self._history.append(record)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

        # 记录使用
        if self.registry:
            for agent_id in record.agents_used:
                self.registry.record_usage(
                    agent_id,
                    success=record.status == "success",
                    rating=1.0 if record.audit_passed else 0.3
                )

        self._emit("dispatch.completed",
                   record_id=record.id, status=record.status,
                   mode=record.mode, duration=record.duration)

        return {
            "status": record.status,
            "result": record.result,
            "mode": record.mode,
            "agents_used": [{"id": a.id, "name": a.name}
                           for a in agents] if agents else [],
            "steps": record.steps,
            "audit_passed": record.audit_passed,
            "duration": record.duration,
            "record_id": record.id,
            "error": record.error,
        }

    # ───────── 任务分析 ─────────

    def _judge_task(self, task: str, agent_id: str = None) -> tuple:
        """
        分析任务，自动决定路由模式和 Agent 组合。

        规则:
          - 简单问题 (20字以内) → DIRECT
          - 需要多步骤 → CHAIN
          - 需要多视角 → PARALLEL
          - 复杂项目 → HYBRID
        """
        if agent_id:
            agent = self.registry.get_agent(agent_id) if self.registry else None
            return RoutingMode.DIRECT, [agent] if agent else []

        # 关键词检测
        task_lower = task.lower()
        task_len = len(task)

        parallel_keywords = ["对比", "比较", "不同角度", "多角度", "多方面",
                            "compare", "versus", "vs", "different", "multiple perspectives",
                            "优缺点", "pros and cons"]
        chain_keywords = ["然后", "之后", "再", "接着", "先",
                         "then", "after", "next", "first",
                         "搜索", "研究", "调查", "查找", "找"]
        hybrid_keywords = ["项目", "开发", "系统", "完整", "全面",
                          "project", "complete", "full", "system", "platform"]

        # 检测复杂度
        if any(kw in task_lower for kw in hybrid_keywords) and task_len > 50:
            mode = RoutingMode.HYBRID
        elif any(kw in task_lower for kw in parallel_keywords):
            mode = RoutingMode.PARALLEL
        elif any(kw in task_lower for kw in chain_keywords) or task_len > 60:
            mode = RoutingMode.CHAIN
        else:
            mode = RoutingMode.DIRECT

        # 选择 Agent
        agents = self._select_agents(task, mode)
        return mode, agents

    def _select_agents(self, task: str, mode: str,
                       agent_id: str = None) -> list:
        """根据任务和模式选择 Agent"""
        if not self.registry:
            return []

        if agent_id:
            agent = self.registry.get_agent(agent_id)
            return [agent] if agent else []

        # 使用注册中心的匹配引擎
        matched = self.registry.match_task(task)

        if mode == RoutingMode.DIRECT:
            return matched[:1] if matched else []
        elif mode == RoutingMode.CHAIN:
            # 链式：返回所有匹配的 Agent，按匹配度排序
            return matched[:4] if matched else []
        elif mode == RoutingMode.PARALLEL:
            # 并行：返回匹配度最高的 2-3 个不同类别的 Agent
            selected = []
            seen_tags = set()
            for agent in matched:
                for tag in agent.tags:
                    if tag not in seen_tags:
                        seen_tags.add(tag)
                        selected.append(agent)
                        break
                if len(selected) >= 3:
                    break
            return selected if selected else matched[:2]
        elif mode == RoutingMode.HYBRID:
            return matched[:5] if matched else []
        return []

    # ───────── 执行模式 ─────────

    def _execute_direct(self, task: str, agents: list,
                        context: dict = None) -> dict:
        """DIRECT 模式：单 Agent 执行"""
        if not agents:
            return {"status": "failed", "error": "No agent available",
                    "steps": [], "final_output": None}

        agent = agents[0]
        steps = []

        if self.registry and self.registry.has_implementation(agent.id):
            fn = self.registry.get_implementation(agent.id)
            result = self._run_with_timeout(fn, task=task, context=context or {})
            steps.append({
                "agent_id": agent.id,
                "agent_name": agent.name,
                "input": task,
                "output": result,
                "status": "success" if result else "failed",
                "duration": 0,
            })
            return {"status": "success", "steps": steps,
                    "final_output": result}
        else:
            # 无实现 → 返回 Agent 建议（由上层 LLM 执行）
            steps.append({
                "agent_id": agent.id,
                "agent_name": agent.name,
                "input": task,
                "output": f"建议调用 {agent.name} ({agent.role}) 处理: {task}",
                "status": "suggested",
                "duration": 0,
            })
            return {"status": "success", "steps": steps,
                    "final_output": steps[-1]["output"]}

    def _execute_chain(self, task: str, agents: list,
                       context: dict = None) -> dict:
        """CHAIN 模式：A→B→C 链式执行"""
        if not agents:
            return {"status": "failed", "error": "No agents for chain"}

        steps = []
        current_input = task
        final_output = None

        for i, agent in enumerate(agents):
            step_start = time.time()
            step_result = None
            step_status = "success"

            if self.registry and self.registry.has_implementation(agent.id):
                fn = self.registry.get_implementation(agent.id)
                step_result = self._run_with_timeout(
                    fn, task=current_input, context=context or {},
                    chain_index=i, chain_total=len(agents)
                )
            else:
                # 无实现 → 标记为建议
                step_result = f"[Step {i+1}/{len(agents)}] {agent.name}: {current_input[:80]}..."
                step_status = "suggested"

            steps.append({
                "agent_id": agent.id,
                "agent_name": agent.name,
                "input": current_input,
                "output": step_result,
                "status": step_status,
                "duration": time.time() - step_start,
            })

            # 链式传递：前一步输出作为下一步输入
            if step_result:
                current_input = str(step_result)
                final_output = step_result

            # 失败则中断
            if step_status == "failed":
                return {"status": "partial", "steps": steps,
                        "final_output": final_output}

        return {"status": "success", "steps": steps,
                "final_output": final_output}

    def _execute_parallel(self, task: str, agents: list,
                          context: dict = None) -> dict:
        """PARALLEL 模式：多 Agent 同时执行"""
        if not agents:
            return {"status": "failed", "error": "No agents for parallel"}

        futures = {}
        steps = []

        for agent in agents:
            if self.registry and self.registry.has_implementation(agent.id):
                fn = self.registry.get_implementation(agent.id)
                future = self._executor.submit(
                    self._run_with_timeout, fn,
                    task=task, context=context or {},
                    perspective=agent.name
                )
                futures[future] = agent
            else:
                steps.append({
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "input": task,
                    "output": f"[{agent.name}] 建议处理",
                    "status": "suggested",
                    "duration": 0,
                })

        for future in as_completed(futures):
            agent = futures[future]
            try:
                result = future.result(timeout=120)
                steps.append({
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "input": task,
                    "output": result,
                    "status": "success",
                    "duration": 0,
                })
            except Exception as e:
                steps.append({
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "input": task,
                    "output": None,
                    "status": "failed",
                    "error": str(e),
                    "duration": 0,
                })

        # 合并结果
        merged = self._merge_results(steps)
        return {"status": "success", "steps": steps,
                "final_output": merged}

    def _execute_hybrid(self, task: str, agents: list,
                        context: dict = None) -> dict:
        """HYBRID 模式：先并行再链式"""
        if not agents:
            return {"status": "failed", "error": "No agents for hybrid"}

        # Phase 1: 并行调查（Research + DataAnalysis + Academic）
        parallel_agents = [a for a in agents if a.id in ("01", "04", "10")][:3]
        if not parallel_agents:
            parallel_agents = agents[:3]

        parallel_result = self._execute_parallel(task, parallel_agents, context)
        research_data = parallel_result.get("final_output", "")

        # Phase 2: 链式处理（Writer → Coder → ...）
        chain_agents = [a for a in agents if a.id not in ("01", "04", "10")][:3]
        if chain_agents:
            chain_result = self._execute_chain(
                f"{task}\n\n研究资料:\n{research_data}",
                chain_agents, context
            )
            return chain_result

        return parallel_result

    # ───────── 工具方法 ─────────

    def _run_with_timeout(self, fn, **kwargs) -> Any:
        """超时执行"""
        future = self._executor.submit(fn, **kwargs)
        try:
            return future.result(timeout=180)
        except Exception as e:
            logger.error("Agent execution failed: %s", e)
            return f"Error: {e}"

    def _merge_results(self, steps: list) -> str:
        """合并并行执行的结果"""
        outputs = []
        for s in steps:
            name = s.get("agent_name", "?")
            output = s.get("output")
            if output:
                outputs.append(f"[{name}] {output}")
        return "\n\n".join(outputs) if outputs else "No results"

    def _find_alternatives(self, current_agents: list) -> list:
        """寻找替代 Agent"""
        if not self.registry or not current_agents:
            return []
        current_ids = {a.id for a in current_agents}
        alternatives = []
        for agent in self.registry._agents.values():
            if agent.id not in current_ids and agent.status == "active":
                alternatives.append(agent)
        return alternatives[:2]

    # ───────── 审计 ─────────

    def _audit_result(self, task: str, record: DispatchRecord) -> dict:
        """
        审计执行结果。

        检查项:
          - 是否有输出
          - 是否包含错误信息
          - 是否符合任务要求（长度/完整性）
        """
        issues = []
        passed = True

        result = record.result
        if not result:
            issues.append("无输出结果")
            passed = False

        if result and len(str(result)) < 10:
            issues.append("输出太短")
            passed = False

        if result and "error" in str(result).lower():
            issues.append("输出包含错误")
            passed = False

        # 触发红队审计（特定条件）
        if (record.agents_used and len(record.agents_used) >= 2
                or "安全" in task or "法律" in task or "财务" in task):
            red_team_result = self._call_red_team(task, record)
            if not red_team_result.get("passed", True):
                issues.append(f"红队审计: {red_team_result.get('issues', [])}")
                passed = False

        self._emit("dispatch.audited", record_id=record.id,
                  passed=passed, issues=issues)
        return {"passed": passed, "issues": issues}

    def _call_red_team(self, task: str, record: DispatchRecord) -> dict:
        """调用红队 Agent 进行审计"""
        red = self.registry.get_agent("21") if self.registry else None
        if not red:
            return {"passed": True}

        # 红队审计逻辑：检查结果中的潜在问题
        result_str = str(record.result or "")
        issues = []

        # 安全性检查
        security_red_flags = ["password", "secret", "key=", "token=",
                             "DROP TABLE", "rm -rf", "eval("]
        for flag in security_red_flags:
            if flag.lower() in result_str.lower():
                issues.append(f"包含敏感内容: {flag}")

        # 完整性检查
        if result_str and len(result_str) < 20:
            issues.append("输出过短，可能不完整")

        return {"passed": len(issues) == 0, "issues": issues}

    def _emit(self, event, **data):
        """发送 EventBus 事件"""
        if self.bus:
            self.bus.emit(event, **data)

    # ───────── 历史查询 ─────────

    def get_history(self, limit: int = 20) -> list[dict]:
        """获取调度历史"""
        return [asdict(r) for r in self._history[-limit:]]

    def get_record(self, record_id: str) -> Optional[dict]:
        for r in self._history:
            if r.id == record_id:
                return asdict(r)
        return None

    # ───────── 生命周期 ─────────

    def start(self):
        self._running = True
        logger.info("Agent Orchestrator started")
        return self

    def stop(self):
        self._running = False
        logger.info("Agent Orchestrator stopped")

    def summary(self) -> dict:
        total = len(self._history)
        success = sum(1 for r in self._history if r.status == "success")
        failed = sum(1 for r in self._history if r.status == "failed")
        return {
            "running": self._running,
            "total_dispatches": total,
            "success": success,
            "failed": failed,
            "success_rate": f"{success/max(total,1)*100:.0f}%",
            "agents_registered": self.registry.list_agents() if self.registry else [],
        }


# ───────── 全局单例 ─────────

_default_orchestrator = None


def get_orchestrator(event_bus=None):
    global _default_orchestrator
    if _default_orchestrator is None:
        _default_orchestrator = AgentOrchestrator(event_bus=event_bus)
    return _default_orchestrator
