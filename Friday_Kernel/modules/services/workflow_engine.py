"""
Workflow DAG Engine — 工作流编排引擎
======================================
链式编排 + 条件分支 + 失败重试 + 降级策略 + 超时控制。

设计：
  WorkflowDef (DAG) → WorkflowInstance (执行)
               ↓
          Step Executor (线程池)
               ↓
          EventBus 通知 + 持久化

Step 类型：
  - action:   调用注册的动作（与 scheduler/trigger 共用 action_map）
  - condition:条件分支，根据结果选择路径
  - delay:    等待 N 秒
  - event:    发送 EventBus 事件
  - sub:      子工作流

功能：
  - ✅ A→B→C 链式执行
  - ✅ 条件分支（result_match / expression）
  - ✅ 失败重试（指数退避）
  - ✅ 超时控制（per-step timeout）
  - ✅ 降级策略（fallback step）
  - ✅ 执行历史 + 持久化

用法:
    engine = WorkflowEngine(event_bus=bus)
    engine.register_actions(scheduler._action_map)
    
    wf = engine.create_workflow("检查+报告", steps=[...], edges=[...])
    inst = engine.run_workflow(wf.id)
"""

import json
import logging
import os
import re
import threading
import time
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


# ───────── 枚举 ─────────

class StepType(str, Enum):
    ACTION = "action"
    CONDITION = "condition"
    DELAY = "delay"
    EVENT = "event"
    SUB_WORKFLOW = "sub_workflow"


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class WorkflowStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PARTIAL = "partial"  # 部分成功


# ───────── 数据模型 ─────────

@dataclass
class WorkflowStep:
    """工作流步骤定义"""
    id: str
    name: str
    type: str = StepType.ACTION
    action_name: str = ""                       # action / event 的名称
    action_args: dict = field(default_factory=dict)
    condition_field: str = ""                   # condition 判断的字段
    condition_operator: str = "=="
    condition_value: Any = None
    timeout: int = 120                          # 秒
    retry_count: int = 0                        # 重试次数
    retry_delay: int = 5                        # 重试基础等待(秒)，指数退避
    fallback_step: Optional[str] = None         # 失败时跳转到
    description: str = ""


@dataclass
class WorkflowEdge:
    """工作流边定义"""
    from_step: str
    to_step: str
    condition: Optional[dict] = None            # 条件表达式（可选，用于分支）


@dataclass
class WorkflowDef:
    """工作流定义（DAG）"""
    id: str
    name: str
    version: int = 1
    steps: list = field(default_factory=list)   # [WorkflowStep, ...]
    edges: list = field(default_factory=list)   # [WorkflowEdge, ...]
    start_step: str = ""
    description: str = ""
    tags: list = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""
    run_count: int = 0
    last_run: Optional[str] = None


@dataclass
class StepResult:
    """单步执行结果"""
    step_id: str
    status: str = StepStatus.PENDING
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration: float = 0.0
    result: Any = None
    error: Optional[str] = None
    retry_count: int = 0
    output: dict = field(default_factory=dict)


@dataclass
class WorkflowInstance:
    """工作流实例（一次执行）"""
    id: str
    workflow_id: str
    workflow_name: str = ""
    status: str = WorkflowStatus.PENDING
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration: float = 0.0
    current_step: Optional[str] = None
    steps: dict = field(default_factory=dict)   # step_id -> StepResult
    input_data: dict = field(default_factory=dict)
    output_data: dict = field(default_factory=dict)
    error: Optional[str] = None
    trigger: str = "manual"                     # manual / cron / trigger / sub


# ───────── Workflow Engine ─────────

class WorkflowEngine:
    """
    工作流 DAG 编排引擎

    核心能力：
      - 有向无环图 (DAG) 执行
      - 条件分支
      - 失败重试（指数退避）
      - 每步超时控制
      - 降级跳转
      - 并行执行池
    """

    def __init__(self, event_bus=None, data_dir: str = None,
                 max_workers: int = 4):
        self.bus = event_bus
        self.data_dir = data_dir or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data"
        )
        self._workflows_file = os.path.join(self.data_dir, "workflows.json")
        self._instances_file = os.path.join(self.data_dir, "workflow_instances.json")

        self._workflows: dict[str, WorkflowDef] = {}   # wf_id -> def
        self._instances: dict[str, WorkflowInstance] = {}  # inst_id -> instance
        self._action_map: dict[str, Callable] = {}
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._lock = threading.Lock()
        self._running = False

    def register_action(self, name: str, callable_fn: Callable):
        """注册可调用的动作"""
        self._action_map[name] = callable_fn

    def register_actions(self, action_map: dict):
        """批量注册动作"""
        self._action_map.update(action_map)

    # ───────── 工作流定义管理 ─────────

    def create_workflow(self, name: str, steps: list = None,
                        edges: list = None, description: str = "",
                        tags: list = None) -> WorkflowDef:
        """创建工作流定义"""
        wf_id = str(uuid.uuid4())[:8]
        now = datetime.now().isoformat()

        wf = WorkflowDef(
            id=wf_id,
            name=name,
            steps=steps or [],
            edges=edges or [],
            start_step=(steps or [{}])[0].get("id", "") if steps else "",
            description=description,
            tags=tags or [],
            created_at=now,
            updated_at=now,
        )

        # 将 dict 转为 dataclass
        wf.steps = [WorkflowStep(**s) if isinstance(s, dict) else s for s in wf.steps]
        wf.edges = [WorkflowEdge(**e) if isinstance(e, dict) else e for e in wf.edges]

        with self._lock:
            self._workflows[wf_id] = wf
            self._save_workflows()

        logger.info("Workflow created: %s (%s)", name, wf_id)
        self._notify_updated()
        return wf

    def update_workflow(self, wf_id: str, **updates) -> bool:
        """更新工作流"""
        with self._lock:
            if wf_id not in self._workflows:
                return False
            wf = self._workflows[wf_id]
            for key, value in updates.items():
                if hasattr(wf, key) and key != "id":
                    if key == "steps":
                        value = [WorkflowStep(**s) if isinstance(s, dict) else s for s in value]
                    elif key == "edges":
                        value = [WorkflowEdge(**e) if isinstance(e, dict) else e for e in value]
                    setattr(wf, key, value)
            wf.updated_at = datetime.now().isoformat()
            self._save_workflows()
        self._notify_updated()
        return True

    def delete_workflow(self, wf_id: str) -> bool:
        """删除工作流"""
        with self._lock:
            if wf_id not in self._workflows:
                return False
            del self._workflows[wf_id]
            self._save_workflows()
        self._notify_updated()
        return True

    def get_workflow(self, wf_id: str) -> Optional[dict]:
        wf = self._workflows.get(wf_id)
        return self._wf_to_dict(wf) if wf else None

    def list_workflows(self) -> list[dict]:
        return [self._wf_to_dict(wf) for wf in self._workflows.values()]

    def _wf_to_dict(self, wf: WorkflowDef) -> dict:
        d = asdict(wf)
        return d

    # ───────── 工作流执行 ─────────

    def run_workflow(self, wf_id: str, input_data: dict = None,
                     trigger: str = "manual") -> Optional[str]:
        """
        运行工作流。返回 instance_id。
        异步执行，不阻塞。
        """
        wf = self._workflows.get(wf_id)
        if not wf:
            logger.error("Workflow not found: %s", wf_id)
            return None

        inst_id = str(uuid.uuid4())[:12]
        now = datetime.now().isoformat()

        inst = WorkflowInstance(
            id=inst_id,
            workflow_id=wf_id,
            workflow_name=wf.name,
            start_time=now,
            input_data=input_data or {},
            trigger=trigger,
            steps={s.id: StepResult(step_id=s.id) for s in wf.steps},
        )

        with self._lock:
            self._instances[inst_id] = inst
            wf.run_count += 1
            wf.last_run = now
            self._save_workflows()

        if self.bus:
            self.bus.emit("workflow.started",
                         instance_id=inst_id, workflow_id=wf_id,
                         workflow_name=wf.name)

        # 异步执行
        self._executor.submit(self._execute, inst_id, wf_id)
        return inst_id

    def _execute(self, inst_id: str, wf_id: str):
        """执行工作流（在后台线程中）"""
        with self._lock:
            inst = self._instances.get(inst_id)
            wf = self._workflows.get(wf_id)
            if not inst or not wf:
                return
            inst.status = WorkflowStatus.RUNNING

        flow_output = dict(inst.input_data)
        current_id = wf.start_step
        visited = set()
        max_steps = len(wf.steps) * 3  # 防止死循环

        steps_remaining = max_steps

        while current_id and steps_remaining > 0:
            steps_remaining -= 1

            if current_id in visited:
                logger.warning("Loop detected at %s, breaking", current_id)
                break
            visited.add(current_id)

            step_def = next((s for s in wf.steps if s.id == current_id), None)
            if not step_def:
                logger.warning("Step not found: %s", current_id)
                break

            # 更新当前步骤
            with self._lock:
                inst.current_step = current_id
                if current_id in inst.steps:
                    inst.steps[current_id].status = StepStatus.RUNNING
                    inst.steps[current_id].start_time = datetime.now().isoformat()

            # 执行步骤
            step_result = self._execute_step(step_def, inst, flow_output)

            # 更新步骤结果
            with self._lock:
                if current_id in inst.steps:
                    inst.steps[current_id].status = step_result["status"]
                    inst.steps[current_id].end_time = datetime.now().isoformat()
                    inst.steps[current_id].duration = step_result.get("duration", 0)
                    inst.steps[current_id].result = step_result.get("result")
                    inst.steps[current_id].output = step_result.get("output", {})
                    inst.steps[current_id].error = step_result.get("error")

            # 合并输出
            if step_result.get("output"):
                flow_output.update(step_result["output"])

            # 判断失败处理
            if step_result["status"] in (StepStatus.FAILED, StepStatus.TIMEOUT):
                # 尝试重试
                if step_def.retry_count > 0:
                    retried = self._retry_step(step_def, inst, flow_output)
                    if retried["status"] == StepStatus.SUCCESS:
                        step_result = retried
                        with self._lock:
                            if current_id in inst.steps:
                                inst.steps[current_id].status = StepStatus.SUCCESS
                                inst.steps[current_id].result = retried.get("result")
                    else:
                        # 检查 fallback
                        if step_def.fallback_step:
                            current_id = step_def.fallback_step
                            self._notify_step(inst, current_id, "fallback")
                            continue
                        else:
                            with self._lock:
                                inst.status = WorkflowStatus.FAILED
                                inst.error = step_result.get("error", "Step failed")
                            break
                elif step_def.fallback_step:
                    current_id = step_def.fallback_step
                    self._notify_step(inst, current_id, "fallback")
                    continue
                else:
                    with self._lock:
                        inst.status = WorkflowStatus.FAILED
                        inst.error = step_result.get("error", "Step failed")
                    break

            # 找下一步
            next_id = self._find_next_step(wf, current_id, step_result.get("output", {}))
            if next_id is None:
                break
            current_id = next_id

        # 完成
        now_end = datetime.now().isoformat()
        with self._lock:
            inst.end_time = now_end
            inst.output_data = flow_output
            if inst.status != WorkflowStatus.FAILED:
                inst.status = WorkflowStatus.COMPLETED

        if self.bus:
            self.bus.emit("workflow.completed",
                         instance_id=inst_id, workflow_id=wf_id,
                         status=inst.status)

        self._save_instances()
        self._save_workflows()
        self._notify_updated()

        logger.info("Workflow %s completed: %s", wf_id, inst.status)

    def _execute_step(self, step: WorkflowStep, inst: WorkflowInstance,
                      context: dict) -> dict:
        """执行单个步骤"""
        start = time.time()
        result = {"status": StepStatus.SUCCESS, "result": None,
                  "output": {}, "error": None, "duration": 0}

        try:
            if step.type == StepType.ACTION:
                fn = self._action_map.get(step.action_name)
                if fn:
                    # 超时执行
                    future = self._executor.submit(fn, bus=self.bus,
                                                   **step.action_args,
                                                   **context)
                    r = future.result(timeout=step.timeout)
                    result["result"] = r
                    result["output"] = {"result": r}
                else:
                    result["status"] = StepStatus.FAILED
                    result["error"] = f"action not found: {step.action_name}"

            elif step.type == StepType.DELAY:
                delay = step.action_args.get("seconds", 1)
                time.sleep(min(delay, step.timeout))
                result["output"] = {"delayed": delay}

            elif step.type == StepType.EVENT:
                if self.bus:
                    self.bus.emit(step.action_name,
                                 instance_id=inst.id,
                                 **step.action_args)

            elif step.type == StepType.CONDITION:
                # 条件判断 - 结果决定分支
                actual = context.get(step.condition_field)
                result["output"] = {"field": step.condition_field,
                                    "actual": actual,
                                    "expected": step.condition_value,
                                    "operator": step.condition_operator}
                # 判断本身不失败，结果交给边选择

            elif step.type == StepType.SUB_WORKFLOW:
                sub_wf_id = step.action_args.get("workflow_id", "")
                if sub_wf_id in self._workflows:
                    sub_inst_id = self.run_workflow(sub_wf_id, input_data=context,
                                                    trigger="sub")
                    result["output"] = {"sub_instance_id": sub_inst_id}
                else:
                    result["status"] = StepStatus.FAILED
                    result["error"] = f"sub workflow not found: {sub_wf_id}"

        except TimeoutError:
            result["status"] = StepStatus.TIMEOUT
            result["error"] = f"Timeout after {step.timeout}s"
        except Exception as e:
            result["status"] = StepStatus.FAILED
            result["error"] = f"{type(e).__name__}: {e}"
            traceback.print_exc()

        result["duration"] = time.time() - start
        return result

    def _retry_step(self, step: WorkflowStep, inst: WorkflowInstance,
                    context: dict) -> dict:
        """带指数退避的重试"""
        last_result = {"status": StepStatus.FAILED}
        for attempt in range(step.retry_count):
            delay = step.retry_delay * (2 ** attempt)
            logger.info("Retry %s (%d/%d) after %ds",
                       step.name, attempt + 1, step.retry_count, delay)
            time.sleep(delay)
            last_result = self._execute_step(step, inst, context)
            if last_result["status"] == StepStatus.SUCCESS:
                return last_result

        return last_result

    def _find_next_step(self, wf: WorkflowDef, current_id: str,
                        step_output: dict) -> Optional[str]:
        """根据边和条件找下一步"""
        outgoing = [e for e in wf.edges if e.from_step == current_id]
        if not outgoing:
            return None

        # 无条件边
        unconditional = [e for e in outgoing if not e.condition]
        conditional = [e for e in outgoing if e.condition]

        # 先试条件边
        for edge in conditional:
            try:
                from services.trigger_service import evaluate_condition
                if evaluate_condition(edge.condition, step_output):
                    return edge.to_step
            except Exception:
                continue

        # 无条件边
        if unconditional:
            return unconditional[0].to_step

        return None

    # ───────── 实例管理 ─────────

    def get_instance(self, inst_id: str) -> Optional[dict]:
        inst = self._instances.get(inst_id)
        return asdict(inst) if inst else None

    def list_instances(self, limit: int = 50) -> list[dict]:
        sorted_insts = sorted(
            self._instances.values(),
            key=lambda x: x.start_time or "",
            reverse=True,
        )
        return [asdict(i) for i in sorted_insts[:limit]]

    def cancel_instance(self, inst_id: str) -> bool:
        with self._lock:
            if inst_id not in self._instances:
                return False
            self._instances[inst_id].status = WorkflowStatus.CANCELLED
            self._save_instances()
        return True

    # ───────── 持久化 ─────────

    def _save_workflows(self):
        try:
            data = [asdict(w) for w in self._workflows.values()]
            with open(self._workflows_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("Failed to save workflows: %s", e)

    def _load_workflows(self):
        if not os.path.exists(self._workflows_file):
            return
        try:
            with open(self._workflows_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for item in data:
                wf = WorkflowDef(**item)
                wf.steps = [WorkflowStep(**s) if isinstance(s, dict) else s for s in wf.steps]
                wf.edges = [WorkflowEdge(**e) if isinstance(e, dict) else e for e in wf.edges]
                self._workflows[wf.id] = wf
        except Exception as e:
            logger.error("Failed to load workflows: %s", e)

    def _save_instances(self):
        try:
            data = [asdict(i) for i in self._instances.values()]
            with open(self._instances_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("Failed to save instances: %s", e)

    def _load_instances(self):
        if not os.path.exists(self._instances_file):
            return
        try:
            with open(self._instances_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for item in data:
                inst = WorkflowInstance(**item)
                inst.steps = {k: StepResult(**v) if isinstance(v, dict) else v
                             for k, v in inst.steps.items()}
                self._instances[inst.id] = inst
        except Exception as e:
            logger.error("Failed to load instances: %s", e)

    # ───────── 生命周期 ─────────

    def start(self):
        if self._running:
            return
        self._running = True
        os.makedirs(self.data_dir, exist_ok=True)
        self._load_workflows()
        self._load_instances()
        logger.info("Workflow engine started (%d workflows, %d instances)",
                    len(self._workflows), len(self._instances))
        return self

    def stop(self):
        self._running = False
        self._save_workflows()
        self._save_instances()
        logger.info("Workflow engine stopped")

    # ───────── WebSocket ─────────

    def _notify_updated(self):
        if self.bus:
            self.bus.emit("workflows.updated",
                         workflows=self.list_workflows())

    def _notify_step(self, inst, step_id, event_type="step"):
        if self.bus:
            self.bus.emit(f"workflow.{event_type}",
                         instance_id=inst.id,
                         step_id=step_id)

    # ───────── 状态 ─────────

    def summary(self) -> dict:
        return {
            "running": self._running,
            "workflows": len(self._workflows),
            "total_runs": sum(w.run_count for w in self._workflows.values()),
            "recent_instances": len(self._instances),
            "actions_registered": list(self._action_map.keys()),
        }


# ───────── 单例 ─────────

_instance = None

def get_engine(event_bus=None):
    global _instance
    if _instance is None:
        _instance = WorkflowEngine(event_bus=event_bus)
    return _instance
