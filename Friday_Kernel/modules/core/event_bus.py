#!/usr/bin/env python3
"""
Friday Event Bus — 解耦核心 v1.0
=================================
取代模块间的直接 import + 回调传递，改为事件驱动通信。

设计原则：
  1. 模块不直接 import 其他模块，只通过总线通信
  2. 总线支持 发布-订阅（emit/on）和 服务（service）
  3. 模块通过 on_register(bus) 声明自己关心的事件
  4. 模块可以同时是事件生产者和消费者

事件命名规范：
  voice.*         → 语音相关事件
  hotkey.*        → 快捷键事件
  notifier.*      → 主动提醒事件
  llm.*           → LLM 相关事件
  knowledge.*     → 知识库事件

用法：
  from core.event_bus import EventBus
  
  bus = EventBus()
  
  # 订阅事件
  bus.on("voice.command", lambda text: print(f"收到: {text}"))
  
  # 发布事件
  bus.emit("voice.command", text="你好")
  
  # 注册模块（模块需实现 on_register(bus)）
  bus.register(my_module_instance)
  
  # 获取服务（注册时用 register_service 的服务）
  engine = bus.service("tts")
"""

import threading
import traceback


class EventBus:
    """
    Friday 事件总线
    
    核心能力：
      - on / off: 事件订阅与取消
      - emit:     事件发布（同步，按注册顺序执行）
      - once:     一次性订阅
      - register: 注册模块（自动发现 on_register）
      - register_service / service: 服务注册与发现
    """

    def __init__(self):
        self._handlers = {}        # event_name → [callback, ...]
        self._once_handlers = {}   # event_name → [callback, ...]
        self._modules = {}         # module_class_name → instance
        self._services = {}        # service_name → instance
        self._lock = threading.Lock()

    # ───────── 发布-订阅 ─────────

    def on(self, event, callback):
        """订阅事件。同事件按注册顺序依次执行。"""
        with self._lock:
            self._handlers.setdefault(event, []).append(callback)

    def off(self, event, callback):
        """取消订阅。"""
        with self._lock:
            if event in self._handlers:
                self._handlers[event] = [
                    cb for cb in self._handlers[event] if cb != callback
                ]

    def once(self, event, callback):
        """订阅一次。触发后自动取消。"""
        with self._lock:
            self._once_handlers.setdefault(event, []).append(callback)

    def emit(self, event, **data):
        """
        发布事件。
        
        所有订阅者按注册顺序执行。如果某个订阅者抛出异常，
        不影响其他订阅者执行。
        
        返回: 所有订阅者的返回值列表
        """
        results = []
        handlers = []

        with self._lock:
            if event in self._handlers:
                handlers.extend(self._handlers[event])
            if event in self._once_handlers:
                handlers.extend(self._once_handlers[event])
                del self._once_handlers[event]

        # 注入事件名，方便处理器识别
        enriched_data = dict(data)
        enriched_data["_event_name"] = event

        for callback in handlers:
            try:
                result = callback(**enriched_data)
                results.append(result)
            except Exception:
                print(f"[EventBus] Warning: \"{event}\" handler exception:")
                traceback.print_exc()
                results.append(None)

        return results

    def emit_async(self, event, **data):
        """
        异步发布事件（在新线程中执行所有处理器）。
        适用于不希望阻塞发布者的场景。
        """
        thread = threading.Thread(
            target=self.emit,
            args=(event,),
            kwargs=data,
            daemon=True,
            name=f"event-{event}"
        )
        thread.start()

    # ───────── 模块注册 ─────────

    def register(self, module, name=None):
        """
        注册模块到总线。
        
        如果模块实现了 on_register(bus)，会自动调用，
        让模块有机会订阅事件或注册服务。
        """
        name = name or type(module).__name__
        with self._lock:
            self._modules[name] = module

        if hasattr(module, 'on_register'):
            module.on_register(self)

        print(f"  🟢 [总线] 模块已注册: {name}")
        return module

    def has_module(self, name):
        return name in self._modules

    def get_module(self, name):
        return self._modules.get(name)

    # ───────── 服务注册与发现 ─────────

    def register_service(self, name, instance):
        """注册一个具名服务（如 "tts", "llm", "knowledge"）。"""
        with self._lock:
            self._services[name] = instance

    def service(self, name):
        """获取已注册的服务实例。"""
        return self._services.get(name)

    def has_service(self, name):
        return name in self._services

    # ───────── 调试与状态 ─────────

    @property
    def event_count(self):
        return len(self._handlers)

    @property
    def module_count(self):
        return len(self._modules)

    def list_events(self):
        """列出所有已注册的事件和订阅者数量。"""
        return {
            event: len(cbs)
            for event, cbs in sorted(self._handlers.items())
        }

    def list_modules(self):
        """列出所有已注册的模块。"""
        return list(self._modules.keys())

    def list_services(self):
        """列出所有已注册的服务。"""
        return list(self._services.keys())

    def summary(self):
        """返回总线状态摘要。"""
        return (
            f"🅱 EventBus: {self.module_count} 模块, "
            f"{self.event_count} 事件, "
            f"{len(self._services)} 服务"
        )


# ───────── 全局单例（可选） ─────────

_default_bus = None


def get_bus():
    """获取/创建全局单例总线。"""
    global _default_bus
    if _default_bus is None:
        _default_bus = EventBus()
    return _default_bus
