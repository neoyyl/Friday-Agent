"""
Friday Bridge — Friday 模块与 Friday 状态机之间的桥接
=====================================================
取代 friday_bridge.py。
包含 Web UI 启动、模块发现、状态机构建等核心功能。
"""

import asyncio
import logging
import threading
from pathlib import Path

logger = logging.getLogger("friday.bridge")

_MODULES_DIR = Path(__file__).parent.parent


class FridayBridge:
    """Bridge between Friday modules and Friday state machine."""

    def __init__(self, event_bus=None, state_machine=None):
        self._bus = event_bus
        self.sm = state_machine
        self._available_modules = {}
        self._web_server = None
        self._web_thread = None
        self._scan_modules()

        # 如果没有传入状态机，自动创建一个（绑定 EventBus）
        if self.sm is None:
            from entry.nuwa_state import FridayStateMachine
            self.sm = FridayStateMachine(event_bus=event_bus)
            logger.info("FridayStateMachine 自动创建 (event_bus=%s)", bool(event_bus))

    def _scan_modules(self):
        """扫描可用模块（不导入）"""
        targets = [
            "friday_awake", "friday_listener",
            "friday_voice", "friday_notifier",
        ]
        for name in targets:
            for subdir in ["services", "legacy", ""]:
                path = _MODULES_DIR / subdir / f"{name}.py"
                if path.exists():
                    self._available_modules[name] = str(path)
                    logger.info("Found module: %s in %s", name, subdir or 'root')
                    break

    async def start(self):
        """启动监听（Sprint 2+）"""
        if not self._available_modules:
            logger.info("No Friday modules found — standalone mode")
            return
        logger.info("Friday modules: %s", list(self._available_modules.keys()))

    async def stop(self):
        """清理"""
        pass

    # ==================== 深度推理桥接 ====================

    async def enter_reasoning(self):
        """进入推理状态"""
        if self.sm:
            await self.sm.transition("reasoning")
        logger.info("Friday 进入深度推理状态")

    async def exit_reasoning(self):
        """退出推理状态"""
        if self.sm:
            await self.sm.transition("result")
        logger.info("Friday 退出深度推理状态")

    async def reasoning_with_llm(self, query, llm_instance):
        await self.enter_reasoning()
        try:
            result = llm_instance.chat_first_principles(query)
        except Exception as e:
            logger.error("推理出错: %s", e)
            result = {"answer": f"推理出错: {e}", "reasoning_mode": "first_principles", "context_used": False}
        await asyncio.sleep(0.5)
        await self.exit_reasoning()
        return result

    # ==================== Web UI 启动 ====================

    # ==================== 感知系统 ====================

    def start_perception(self, event_bus=None, workspace=None):
        """启动感知系统（窗口/Git/项目扫描）"""
        try:
            from services.perception import PerceptionAggregator
            self._perception = PerceptionAggregator(event_bus=event_bus)
            if workspace:
                self._perception.set_workspace(workspace)
            self._perception.start()
            # 立即获取一次上下文
            ctx = self._perception.get_context()
            logger.info("感知系统已启动 | 工作目录: %s", self._perception.workspace)
            return self._perception
        except Exception as e:
            logger.error("感知系统启动失败: %s", e)
            return None

    def get_perception_context(self, refresh=True) -> str:
        """获取当前感知上下文的格式化文本"""
        if hasattr(self, '_perception') and self._perception:
            return self._perception.format_prompt_block()
        return "<perception_context>未加载</perception_context>"

    # ==================== Voice Dialog ====================

    def start_dialog(self, event_bus=None):
        """启动语音对话引擎"""
        from services.voice_dialog import VoiceDialog
        self._dialog = VoiceDialog(self.sm, event_bus=event_bus)
        self._dialog.start()
        logger.info("VoiceDialog 已启动")

    def feed_asr(self, text):
        """注入 ASR 结果（调试/外部调用用）"""
        if hasattr(self, '_dialog') and self._dialog:
            self._dialog.feed_asr(text)

    def wake(self):
        """手动唤醒"""
        if hasattr(self, '_dialog') and self._dialog:
            self._dialog.wake()

    # ==================== Web UI ====================

    def start_web_ui(self, event_bus=None, host="127.0.0.1", port=5000, daemon=True):
        """
        在后台线程中启动 Friday Web UI (含 WebSocket)。
        如果提供 event_bus，Flask 会注册到总线上。
        """
        if self._web_server is not None:
            logger.warning("Friday Web UI 已在运行")
            return

        from web.app import create_app, get_socketio

        app = create_app(event_bus=event_bus)
        self._web_server = app

        def _run():
            sio = get_socketio()
            try:
                # SocketIO 自带 HTTP 服务能力，不需要 waitress
                logger.info("女娲 Web UI 启动于 http://%s:%s (WebSocket 就绪)", host, port)
                sio.run(app, host=host, port=port, debug=False,
                        allow_unsafe_werkzeug=True, use_reloader=False)
            except Exception as e:
                logger.error("Web UI 启动失败: %s", e)

        self._web_thread = threading.Thread(target=_run, daemon=daemon, name="friday-web")
        self._web_thread.start()
        logger.info("Friday Web UI 线程已启动 (port=%s)", port)
        return app
