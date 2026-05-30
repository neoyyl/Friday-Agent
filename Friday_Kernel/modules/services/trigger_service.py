"""
Trigger Service — 事件驱动条件触发器
======================================
监听 EventBus 事件，评估条件表达式，条件满足时触发动作。

设计：
  1. 每个触发器绑定一个或多个 EventBus 事件
  2. 事件到来时评估条件表达式
  3. 条件满足 → 执行动作（与 SchedulerService 共用 action_map）
  4. 支持持久化和 Web UI 管理

条件表达式 DSL：
  {"type": "threshold", "field": "disk_usage", "operator": ">", "value": 90}
  {"type": "event_match", "event": "notifier.*", "field": "level", "operator": "==", "value": "error"}
  {"type": "process_status", "field": "process_name", "operator": "==", "value": "notepad.exe"}
  {"type": "and", "conditions": [...]}
  {"type": "or", "conditions": [...]}
  {"type": "not", "condition": {...}}

用法:
    from services.trigger_service import TriggerService
    triggers = TriggerService(event_bus=bus)
    triggers.add_trigger(name="磁盘告警",
                         event_pattern="scheduler.health_report",
                         condition={"type": "threshold", "field": "disk_free",
                                    "operator": "<", "value": 20},
                         action_name="notifier.warning")
"""

import json
import logging
import os
import re
import threading
import traceback
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


# ───────── 条件表达式评估引擎 ─────────

def evaluate_condition(condition: dict, event_data: dict) -> bool:
    """
    评估条件表达式。

    支持的运算符:
      ==, !=, >, >=, <, <=, in, not_in, contains, matches, exists, not_exists
    """
    if not condition:
        return True

    cond_type = condition.get("type", "event_match")

    if cond_type == "and":
        return all(evaluate_condition(c, event_data)
                   for c in condition.get("conditions", []))

    elif cond_type == "or":
        return any(evaluate_condition(c, event_data)
                   for c in condition.get("conditions", []))

    elif cond_type == "not":
        return not evaluate_condition(condition.get("condition", {}), event_data)

    elif cond_type == "threshold":
        field = condition.get("field", "")
        operator = condition.get("operator", ">")
        value = condition.get("value")
        actual = _get_nested_value(event_data, field)

        if actual is None:
            return False

        try:
            actual = float(actual)
            value = float(value)
        except (TypeError, ValueError):
            return _compare_str(str(actual), operator, str(value))

        return _compare_num(actual, operator, value)

    elif cond_type == "event_match":
        event = condition.get("event", "")
        # 如果连 event 都指定了，先用 glob 匹配事件名
        if event and not glob_match(event, event_data.get("_event_name", "")):
            return False

        field = condition.get("field")
        if not field:
            return True  # 只匹配事件名

        operator = condition.get("operator", "==")
        value = condition.get("value")
        actual = _get_nested_value(event_data, field)

        if value is None:
            return operator == "not_exists" and actual is None

        return _compare(actual, operator, value)

    elif cond_type == "process_status":
        field = condition.get("field", "process_name")
        operator = condition.get("operator", "==")
        value = condition.get("value")
        actual = _get_nested_value(event_data, field)
        return _compare(actual, operator, value)

    return False


def _get_nested_value(data: dict, field: str):
    """从嵌套 dict 中取值，支持点号路径如 'system.cpu'"""
    parts = field.split(".")
    current = data
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def _compare(actual, operator, value):
    """通用比较"""
    try:
        return _compare_num(float(actual), operator, float(value))
    except (TypeError, ValueError):
        return _compare_str(str(actual), operator, str(value))


def _compare_num(a: float, op: str, b: float) -> bool:
    if op == ">": return a > b
    if op == ">=": return a >= b
    if op == "<": return a < b
    if op == "<=": return a <= b
    if op == "==": return a == b
    if op == "!=": return a != b
    return False


def _compare_str(a: str, op: str, b: str) -> bool:
    a, b = a.lower(), b.lower()
    if op in ("==", "==="): return a == b
    if op == "!=": return a != b
    if op == "contains": return b in a
    if op == "not_contains": return b not in a
    if op == "matches": return bool(re.search(b, a))
    if op == "in": return b in a.split(",")
    if op == "not_in": return b not in a.split(",")
    return False


def glob_match(pattern: str, value: str) -> bool:
    """简单的 glob 匹配（支持 * 和 ?）"""
    if pattern == "*":
        return True
    regex = "^" + re.escape(pattern).replace(r"\*", ".*").replace(r"\?", ".") + "$"
    return bool(re.match(regex, value))


# ───────── 数据模型 ─────────

@dataclass
class TriggerRule:
    """触发器规则"""
    id: str
    name: str
    enabled: bool = True
    event_pattern: str = "*"            # 监听的事件模式 (glob)
    condition: dict = field(default_factory=dict)  # 条件表达式
    action_type: str = "event"          # event | callable
    action_name: str = ""               # 事件名或 callable 名
    action_args: dict = field(default_factory=dict)  # 额外参数
    description: str = ""
    cooldown: int = 60                  # 冷却时间(秒)，防止重复触发
    created_at: str = ""
    last_triggered: Optional[str] = None
    trigger_count: int = 0


# ───────── 内置条件预设 ─────────

PRESET_CONDITIONS = {
    "disk_low": {
        "name": "磁盘空间不足",
        "event_pattern": "scheduler.health_report",
        "condition": {"type": "threshold", "field": "disk_free",
                      "operator": "<", "value": 20},
        "description": "磁盘剩余空间低于 20GB 时告警",
    },
    "high_cpu": {
        "name": "CPU 过高",
        "event_pattern": "scheduler.health_report",
        "condition": {"type": "threshold", "field": "cpu",
                      "operator": ">", "value": 90},
        "description": "CPU 使用率超过 90% 时告警",
    },
    "high_memory": {
        "name": "内存不足",
        "event_pattern": "scheduler.health_report",
        "condition": {"type": "threshold", "field": "memory",
                      "operator": ">", "value": 90},
        "description": "内存使用率超过 90% 时告警",
    },
}


# ───────── Trigger Service ─────────

class TriggerService:
    """
    条件触发器服务

    监听 EventBus 事件 → 评估条件 → 触发动作。
    与 SchedulerService 共用 action_map 和 EventBus。
    """

    def __init__(self, event_bus=None, data_dir: str = None):
        self.bus = event_bus
        self.data_dir = data_dir or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data"
        )
        self._triggers_file = os.path.join(self.data_dir, "triggers.json")
        self._triggers: dict[str, TriggerRule] = {}
        self._action_map: dict[str, Callable] = {}
        self._last_fired: dict[str, float] = {}  # trigger_id -> timestamp
        self._lock = threading.Lock()
        self._running = False
        self._listener_refs = []  # 保存 EventBus 取消订阅引用

    def register_action(self, name: str, callable_fn: Callable):
        """注册可触发的动作"""
        self._action_map[name] = callable_fn

    def register_scheduler_actions(self, scheduler):
        """从 SchedulerService 导入动作映射"""
        if hasattr(scheduler, '_action_map'):
            self._action_map.update(scheduler._action_map)

    # ───────── 生命周期 ─────────

    def start(self):
        """启动触发器服务"""
        if self._running:
            return
        self._running = True

        os.makedirs(self.data_dir, exist_ok=True)
        self._load_triggers()

        if self.bus:
            # 为每个启用的触发器注册具体事件监听
            for trigger in self._triggers.values():
                if trigger.enabled:
                    self.bus.on(trigger.event_pattern, self._on_event)

        logger.info("Trigger service started (%d triggers loaded)", len(self._triggers))
        return self

    def stop(self):
        """停止触发器服务"""
        if not self._running:
            return
        self._running = False
        self._save_triggers()
        logger.info("Trigger service stopped")

    # ───────── 触发器管理 ─────────

    def add_trigger(self, name: str, event_pattern: str = "*",
                    condition: dict = None, action_type: str = "event",
                    action_name: str = "", action_args: dict = None,
                    description: str = "", enabled: bool = True,
                    cooldown: int = 60) -> str:
        """添加触发器规则"""
        import uuid
        trigger_id = str(uuid.uuid4())[:8]

        rule = TriggerRule(
            id=trigger_id,
            name=name,
            enabled=enabled,
            event_pattern=event_pattern,
            condition=condition or {},
            action_type=action_type,
            action_name=action_name,
            action_args=action_args or {},
            description=description,
            cooldown=cooldown,
            created_at=datetime.now().isoformat(),
        )

        with self._lock:
            self._triggers[trigger_id] = rule
            # 注册事件监听
            if self._running and self.bus and event_pattern != "*":
                self.bus.on(event_pattern, self._on_event)
            self._save_triggers()

        logger.info("Trigger added: %s (%s)", name, trigger_id)
        self._notify_updated()
        return trigger_id

    def remove_trigger(self, trigger_id: str) -> bool:
        """删除触发器"""
        with self._lock:
            if trigger_id not in self._triggers:
                return False
            del self._triggers[trigger_id]
            self._save_triggers()
        self._notify_updated()
        return True

    def update_trigger(self, trigger_id: str, **updates) -> bool:
        """更新触发器"""
        with self._lock:
            if trigger_id not in self._triggers:
                return False
            rule = self._triggers[trigger_id]
            for key, value in updates.items():
                if hasattr(rule, key) and key != "id":
                    setattr(rule, key, value)
            self._save_triggers()
        self._notify_updated()
        return True

    def toggle_trigger(self, trigger_id: str) -> Optional[bool]:
        """切换启用/禁用"""
        with self._lock:
            if trigger_id not in self._triggers:
                return None
            rule = self._triggers[trigger_id]
            rule.enabled = not rule.enabled
            self._save_triggers()
        self._notify_updated()
        return rule.enabled

    def list_triggers(self) -> list[dict]:
        """列出所有触发器"""
        return [asdict(t) for t in self._triggers.values()]

    def get_trigger(self, trigger_id: str) -> Optional[dict]:
        t = self._triggers.get(trigger_id)
        return asdict(t) if t else None

    # ───────── 事件处理 ─────────

    def _on_event(self, **data):
        """
        EventBus 事件处理器。
        注意：当 event_pattern 为 "*" 时，此方法会收到所有事件。
        快速判断不匹配的事件以节省性能。
        """
        if not self._running:
            return

        event_name = data.get("_event_name", "")
        triggers = list(self._triggers.values())

        for rule in triggers:
            if not rule.enabled:
                continue

            # 事件模式匹配
            if not glob_match(rule.event_pattern, event_name) and rule.event_pattern != "*":
                continue

            # 冷却检查
            now = datetime.now().timestamp()
            last = self._last_fired.get(rule.id, 0)
            if now - last < rule.cooldown:
                continue

            # 构造评估数据
            eval_data = dict(data)
            eval_data["_event_name"] = event_name
            eval_data["_now"] = now

            # 条件评估
            try:
                if not evaluate_condition(rule.condition, eval_data):
                    continue
            except Exception as e:
                logger.warning("Condition eval error for %s: %s", rule.id, e)
                continue

            # 条件满足 → 触发
            self._fire_trigger(rule, event_data=data)
            self._last_fired[rule.id] = now

    def _fire_trigger(self, rule: TriggerRule, event_data: dict):
        """执行触发动作"""
        logger.info("Trigger fired: %s (%s)", rule.name, rule.id)

        try:
            if rule.action_type == "event" and self.bus:
                self.bus.emit(rule.action_name,
                             trigger_id=rule.id,
                             trigger_name=rule.name,
                             **rule.action_args)
            elif rule.action_type == "callable":
                fn = self._action_map.get(rule.action_name)
                if fn:
                    fn(bus=self.bus, **rule.action_args)

            # 更新状态
            with self._lock:
                if rule.id in self._triggers:
                    self._triggers[rule.id].last_triggered = datetime.now().isoformat()
                    self._triggers[rule.id].trigger_count += 1
                    self._save_triggers()

            if self.bus:
                self.bus.emit("trigger.fired",
                             trigger_id=rule.id, trigger_name=rule.name)

        except Exception as e:
            logger.error("Trigger action failed: %s - %s", rule.name, e)
            traceback.print_exc()

        self._notify_updated()

    # ───────── 持久化 ─────────

    def _save_triggers(self):
        try:
            data = [asdict(t) for t in self._triggers.values()]
            with open(self._triggers_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("Failed to save triggers: %s", e)

    def _load_triggers(self):
        if not os.path.exists(self._triggers_file):
            return
        try:
            with open(self._triggers_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for item in data:
                rule = TriggerRule(**item)
                self._triggers[rule.id] = rule
        except Exception as e:
            logger.error("Failed to load triggers: %s", e)

    # ───────── WebSocket 通知 ─────────

    def _notify_updated(self):
        if self.bus:
            self.bus.emit("triggers.updated", triggers=self.list_triggers())

    # ───────── 状态 ─────────

    def summary(self) -> dict:
        return {
            "running": self._running,
            "total_triggers": len(self._triggers),
            "enabled_triggers": sum(1 for t in self._triggers.values() if t.enabled),
            "presets": list(PRESET_CONDITIONS.keys()),
            "actions_registered": list(self._action_map.keys()),
        }


# ───────── 单例 ─────────

_instance = None

def get_trigger_service(event_bus=None):
    global _instance
    if _instance is None:
        _instance = TriggerService(event_bus=event_bus)
    return _instance
