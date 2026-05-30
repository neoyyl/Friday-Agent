"""
Friday 状态机 — 7 状态状态机实现
================================
定义 Friday 的 7 种行为状态及合法转换规则。
支持 on_enter/on_exit 回调、状态历史栈、超时看门狗。
可绑定 EventBus 实现模块间通信。

状态: IDLE ↔ WAKING ↔ LISTENING ↔ WORKING ↔ SPEAKING
        ↕                   ↕           ↕
      SLEEPING            (cancel)   (interrupt)
        ↕
      NOTIFY (单向: NOTIFY → IDLE)
"""
import enum
import time
import logging
import threading

logger = logging.getLogger("friday.state")


class FridayState(enum.Enum):
    """Friday 的 7 种状态"""
    IDLE      = "idle"       # 待机 — 等待唤醒
    WAKING    = "waking"     # 唤醒中 — 正在从休眠/待机过渡到激活
    LISTENING = "listening"  # 倾听中 — 正在听用户说话
    WORKING   = "working"    # 处理中 — 正在思考/调用 LLM/执行任务
    SPEAKING  = "speaking"   # 回复中 — 正在 TTS 输出
    NOTIFY    = "notify"     # 提醒 — 有主动通知要播放
    SLEEPING  = "sleeping"   # 休眠 — 低功耗，仅唤醒词可激活

    def __str__(self):
        return self.value

    def __repr__(self):
        return f"FridayState.{self.name}"


# ─── 状态元数据 ───

STATE_META = {
    FridayState.IDLE:      {"label": "待机",   "level": "passive", "zoom": 0},
    FridayState.WAKING:    {"label": "唤醒中", "level": "active",  "zoom": 1},
    FridayState.LISTENING: {"label": "倾听中", "level": "active",  "zoom": 2},
    FridayState.WORKING:   {"label": "处理中", "level": "active",  "zoom": 1},
    FridayState.SPEAKING:  {"label": "回复中", "level": "active",  "zoom": 2},
    FridayState.NOTIFY:    {"label": "提醒",   "level": "active",  "zoom": 1},
    FridayState.SLEEPING:  {"label": "休眠",   "level": "passive", "zoom": 0},
}


# ─── 转换规则表 ───
# { from_state: { to_state: reason, ... } }

TRANSITION_RULES = {
    FridayState.IDLE: {
        FridayState.WAKING:   "wake_word",      # 唤醒词检测
        FridayState.SLEEPING: "timeout",         # 超时进入休眠
        FridayState.NOTIFY:   "notification",    # 收到通知
    },
    FridayState.WAKING: {
        FridayState.LISTENING: "wake_ready",      # 唤醒完成，开始听
        FridayState.IDLE:      "wake_failed",      # 唤醒失败，回到待机
        FridayState.SLEEPING:  "manual",           # 手动休眠
    },
    FridayState.LISTENING: {
        FridayState.WORKING:  "asr_complete",       # ASR 完成，开始处理
        FridayState.IDLE:     "timeout",            # 超时无人说话
        FridayState.WAKING:   "interrupt",          # 打断
        FridayState.SLEEPING: "manual",
    },
    FridayState.WORKING: {
        FridayState.SPEAKING:  "llm_done",         # LLM 生成完毕，开始回复
        FridayState.IDLE:      "silent_mode",       # 静默模式（不 TTS）
        FridayState.LISTENING: "need_more_input",  # 需要补充信息
        FridayState.SLEEPING:  "manual",
    },
    FridayState.SPEAKING: {
        FridayState.IDLE:     "tts_done",           # TTS 播放完毕
        FridayState.WAKING:   "interrupt",          # 打断（检测到新唤醒词）
        FridayState.SLEEPING: "manual",
    },
    FridayState.NOTIFY: {
        FridayState.IDLE:     "notify_done",        # 通知播放完毕
        FridayState.WAKING:   "interrupt",          # 打断
        FridayState.SLEEPING: "manual",
    },
    FridayState.SLEEPING: {
        FridayState.WAKING: "wake_word",            # 唤醒词检测
    },
}


def is_valid_transition(from_state, to_state):
    """检查状态转换是否合法"""
    if from_state == to_state:
        return True
    rules = TRANSITION_RULES.get(from_state, {})
    return to_state in rules


def get_reason(from_state, to_state):
    """获取状态转换原因"""
    if from_state == to_state:
        return "same"
    rules = TRANSITION_RULES.get(from_state, {})
    return rules.get(to_state, "unknown")


# ─── 状态历史 ───

class StateHistory:
    """状态历史记录，用于回溯和调试"""

    def __init__(self, maxlen=100):
        self._history = []
        self._maxlen = maxlen

    def push(self, from_state, to_state, reason):
        now = time.time()
        self._history.append({
            "time": now,
            "from": str(from_state),
            "to": str(to_state),
            "reason": reason,
        })
        if len(self._history) > self._maxlen:
            self._history.pop(0)

    @property
    def last(self):
        return self._history[-1] if self._history else None

    @property
    def recent(self):
        """返回最近 20 条"""
        return self._history[-20:]

    def clear(self):
        self._history.clear()

    def __len__(self):
        return len(self._history)


# ─── 状态机 ───

class FridayStateMachine:
    """
    女娲状态机
    
    用法:
        sm = FridayStateMachine()
        
        # 注册进入/退出回调
        @sm.on_enter(FridayState.LISTENING)
        def on_listening():
            print("开始听...")
        
        # 转换状态
        await sm.transition(FridayState.WAKING, reason="wake_word")
    """

    def __init__(self, initial_state=FridayState.IDLE, event_bus=None):
        self._state = initial_state
        self._bus = event_bus
        self._history = StateHistory()
        self._lock = threading.Lock()
        self._enter_callbacks = {}   # state → [callbacks]
        self._exit_callbacks = {}    # state → [callbacks]
        self._any_callbacks = []     # (from, to, reason) → callback
        self._watchdog_timer = None
        self._watchdog_duration = None

        logger.info("FridayStateMachine 初始化: %s", initial_state)

    # ─── 属性 ───

    @property
    def current(self):
        return self._state

    @property
    def label(self):
        meta = STATE_META.get(self._state, {})
        return meta.get("label", str(self._state))

    @property
    def history(self):
        return self._history

    @property
    def event_bus(self):
        return self._bus

    # ─── 回调注册 ───

    def on_enter(self, state):
        """装饰器：进入 state 时回调"""
        def decorator(func):
            self._enter_callbacks.setdefault(state, []).append(func)
            return func
        return decorator

    def on_exit(self, state):
        """装饰器：离开 state 时回调"""
        def decorator(func):
            self._exit_callbacks.setdefault(state, []).append(func)
            return func
        return decorator

    def on_any_transition(self, func):
        """
        装饰器：任意状态转换后回调
        函数签名: func(from_state, to_state, reason)
        """
        self._any_callbacks.append(func)
        return func

    # ─── 核心转换 ───

    async def transition(self, to_state, reason="manual", **kwargs):
        """
        执行状态转换。
        
        流程:
          1. 验证合法性
          2. 调用当前状态的 on_exit
          3. 更新状态
          4. 调用新状态的 on_enter
          5. 通知 EventBus
          6. 记录历史
        """
        from_state = self._state
        
        if from_state == to_state:
            return  # 相同状态不重复触发

        if not is_valid_transition(from_state, to_state):
            logger.warning("非法转换: %s → %s (%s)", from_state, to_state, reason)
            raise ValueError(
                f"非法状态转换: {from_state.value} → {to_state.value} "
                f"(reason={reason})"
            )

        logger.info("状态转换: %s → %s (%s)", from_state.value, to_state.value, reason)

        with self._lock:
            # 1. on_exit 回调
            for cb in self._exit_callbacks.get(from_state, []):
                try:
                    if asyncio.iscoroutinefunction(cb):
                        await cb(to_state, reason=reason, **kwargs)
                    else:
                        cb(to_state, reason=reason, **kwargs)
                except Exception as e:
                    logger.error("on_exit 回调异常: %s", e)

            # 2. 更新状态
            old_state = self._state
            self._state = to_state

            # 3. on_enter 回调
            for cb in self._enter_callbacks.get(to_state, []):
                try:
                    if asyncio.iscoroutinefunction(cb):
                        await cb(from_state, reason=reason, **kwargs)
                    else:
                        cb(from_state, reason=reason, **kwargs)
                except Exception as e:
                    logger.error("on_enter 回调异常: %s", e)

            # 4. 任意转换回调
            for cb in self._any_callbacks:
                try:
                    if asyncio.iscoroutinefunction(cb):
                        await cb(from_state, to_state, reason=reason, **kwargs)
                    else:
                        cb(from_state, to_state, reason=reason, **kwargs)
                except Exception as e:
                    logger.error("on_any 回调异常: %s", e)

        # 5. 记录历史
        self._history.push(from_state, to_state, reason)

        # 6. 通知 EventBus
        if self._bus:
            self._bus.emit("friday.state.changed", 
                          state=str(to_state),
                          from_state=str(from_state),
                          reason=reason,
                          label=self.label,
                          **kwargs)

        # 7. 管理看门狗
        self._reset_watchdog(to_state)

    # ─── 便捷转换方法 ───

    async def wake(self, reason="wake_word"):
        """唤醒：IDLE/SLEEPING → WAKING"""
        return await self.transition(FridayState.WAKING, reason=reason)

    async def listen(self, reason="wake_ready"):
        """开始听：WAKING → LISTENING"""
        return await self.transition(FridayState.LISTENING, reason=reason)

    async def work(self, reason="asr_complete", **kwargs):
        """处理：LISTENING → WORKING"""
        return await self.transition(FridayState.WORKING, reason=reason, **kwargs)

    async def speak(self, reason="llm_done", **kwargs):
        """回复：WORKING → SPEAKING"""
        return await self.transition(FridayState.SPEAKING, reason=reason, **kwargs)

    async def done(self, reason="tts_done"):
        """完成：SPEAKING → IDLE"""
        return await self.transition(FridayState.IDLE, reason=reason)

    async def interrupt(self, reason="interrupt"):
        """打断：SPEAKING/NOTIFY/LISTENING → WAKING"""
        # 如果已经在 WAKING，先回到 IDLE 再唤醒
        if self._state == FridayState.WAKING:
            return
        # 如果已经在 IDLE/SLEEPING，直接唤醒
        if self._state in (FridayState.IDLE, FridayState.SLEEPING):
            return await self.transition(FridayState.WAKING, reason="wake_word")
        return await self.transition(FridayState.WAKING, reason=reason)

    async def sleep(self, reason="manual"):
        """休眠：任何状态 → SLEEPING"""
        return await self.transition(FridayState.SLEEPING, reason=reason)

    async def notify(self, reason="notification"):
        """通知：IDLE → NOTIFY"""
        return await self.transition(FridayState.NOTIFY, reason=reason)

    # ─── 看门狗 ───

    def _reset_watchdog(self, state):
        """根据当前状态设置超时看门狗"""
        if self._watchdog_timer:
            self._watchdog_timer.cancel()
            self._watchdog_timer = None

        # 为各状态设置最大停留时间
        timeouts = {
            FridayState.WAKING:    5.0,     # 5 秒内必须完成唤醒
            FridayState.LISTENING: 15.0,    # 15 秒不说话则超时
            FridayState.WORKING:   30.0,    # 30 秒处理超时
            FridayState.SPEAKING:  60.0,    # 60 秒 TTS 超时
            FridayState.NOTIFY:    10.0,    # 10 秒通知超时
        }
        duration = timeouts.get(state)
        if duration:
            self._watchdog_duration = duration
            self._watchdog_timer = threading.Timer(
                duration, self._on_watchdog_timeout,
                args=(state,)
            )
            self._watchdog_timer.daemon = True
            self._watchdog_timer.start()

    def _on_watchdog_timeout(self, state):
        """看门狗超时：回到 IDLE"""
        logger.warning("状态 %s 超时 (%s秒)，回到 IDLE",
                       state.value, self._watchdog_duration)
        # 在线程中异步执行
        import asyncio
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(
                self.transition(FridayState.IDLE, reason="watchdog_timeout")
            )
            loop.close()
        except Exception as e:
            logger.error("看门狗超时处理异常: %s", e)

    # ─── 工具方法 ───

    def can_transition_to(self, state):
        """检查能否转换到目标状态"""
        return is_valid_transition(self._state, state)

    def summary(self):
        """返回状态机摘要"""
        return {
            "current": str(self._state),
            "label": self.label,
            "history_count": len(self._history),
            "last_transition": self._history.last,
            "valid_transitions": [
                str(s) for s in TRANSITION_RULES.get(self._state, {}).keys()
            ],
        }

    def __repr__(self):
        return f"<FridayStateMachine: {self._state.value}>"
