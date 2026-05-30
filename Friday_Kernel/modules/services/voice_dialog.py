"""
Voice Dialog — 语音对话编排器
===============================
将 StateMachine + ASR + LLM + TTS + 声纹 + 记忆 串联为完整对话闭环。
通过 EventBus 与各模块通信，不直接 import 第三方模块。

新版本集成:
  - 流式 TTS (streaming_tts.py) — 带语气变化
  - 声纹识别 (voice_service.py) — 唤醒时识别说话人
  - 永续记忆 (conversation_memory.py) — 上下文保持

对话流程:
  IDLE → (唤醒词+声纹) → WAKING → LISTENING
  → (ASR结果) → WORKING → (LLM回复+语气检测) → SPEAKING
  → (流式TTS完成) → IDLE"""
import asyncio
import logging
import threading
import time

logger = logging.getLogger("friday.dialog")

# ─── 状态机事件名称 ───
EVT_WAKE_WORD   = "voice.wake_word"    # 唤醒词检测到 → { }
EVT_ASR_RESULT  = "voice.asr_result"   # ASR 完成 → { text: str }
EVT_ASR_ERROR   = "voice.asr_error"    # ASR 错误 → { error: str }
EVT_ASR_TIMEOUT = "voice.asr_timeout"  # ASR 超时 → { }
EVT_LLM_RESULT  = "voice.llm_result"   # LLM 完成 → { text: str }
EVT_TTS_DONE    = "voice.tts_done"     # TTS 播放完毕 → { }
EVT_INTERRUPT   = "voice.interrupt"    # 打断 → { }


class VoiceDialog:
    """
    语音对话编排器。
    
    用法:
        dialog = VoiceDialog(state_machine, event_bus)
        dialog.start()   # 开始监听唤醒词
        dialog.stop()    # 停止
    """

    def __init__(self, state_machine, event_bus=None):
        self.sm = state_machine
        self._bus = event_bus

        # ASR / LLM / TTS 回调（可替换为实际实现）
        self._asr_start_cb = None    # func() → 开始录音/ASR
        self._asr_stop_cb = None     # func() → 停止录音
        self._llm_cb = None          # func(text) → 返回回复文本
        self._tts_cb = None          # func(text, done_cb) → 播放TTS（旧版）
        self._tts_player = None      # StreamingTTSPlayer（新版）

        # Phase 4.4: Voiceprint
        self._voice_service = None   # VoiceService 实例
        self._current_speaker = None # 当前说话人信息
        self._auto_voiceprint = True # 唤醒时自动识别说话人

        # Phase 4.5: Conversation Memory
        self._memory = None          # ConversationMemory 实例
        self._use_memory = True      # 是否使用记忆系统

        # 内部状态
        self._running = False
        self._listening = False
        self._current_asr_text = ""
        self._interrupt_requested = False

        # 注册 EventBus 监听
        if self._bus:
            self._bus.on(EVT_WAKE_WORD, self._on_wake_word)
            self._bus.on(EVT_ASR_RESULT, self._on_asr_result)
            self._bus.on(EVT_ASR_ERROR, self._on_asr_error)
            self._bus.on(EVT_ASR_TIMEOUT, self._on_asr_timeout)
            self._bus.on(EVT_LLM_RESULT, self._on_llm_result)
            self._bus.on(EVT_TTS_DONE, self._on_tts_done)
            self._bus.on(EVT_INTERRUPT, self._on_interrupt)

    # ─── 配置外部回调 ───

    def set_asr(self, start_cb, stop_cb=None):
        """
        设置 ASR 回调。
        start_cb: 回调函数，调用后开始录音+ASR，完成后触发 EVT_ASR_RESULT
        stop_cb:  回调函数，调用后停止录音
        """
        self._asr_start_cb = start_cb
        if stop_cb:
            self._asr_stop_cb = stop_cb

    def set_llm(self, callback):
        """
        设置 LLM 回调。
        接收文本，返回回复文本（同步或异步）。
        """
        self._llm_cb = callback

    def set_tts(self, callback):
        """
        设置 TTS 回调（旧版兼容）。
        接收文本 + 完成回调，播放完毕后调用 done_cb。
        """
        self._tts_cb = callback

    # ─── Phase 4.4: Voiceprint 集成 ───

    def set_voice_service(self, voice_service):
        """设置声纹服务（用于唤醒时识别说话人）"""
        self._voice_service = voice_service
        self._auto_voiceprint = True

    def set_voiceprint_enabled(self, enabled: bool):
        """启用/禁用声纹识别"""
        self._auto_voiceprint = enabled

    # ─── Phase 4.5: Memory 集成 ───

    def set_memory(self, memory):
        """设置记忆系统"""
        self._memory = memory

    def set_memory_enabled(self, enabled: bool):
        """启用/禁用记忆"""
        self._use_memory = enabled

    # ─── Phase 4.6: Streaming TTS 集成 ───

    def set_streaming_tts(self, tts_player):
        """设置流式 TTS 播放器（替代旧版 TTS 回调）"""
        self._tts_player = tts_player

    # ─── 生命周期 ───

    def start(self):
        """启动对话引擎（开始监听唤醒词）"""
        self._running = True
        self._interrupt_requested = False
        logger.info("VoiceDialog 启动，等待唤醒词...")

        # 如果 EventBus 已连接，唤醒词通过总线事件触发
        # 否则可以通过外部调用 wake() 方法
        if self._bus:
            logger.info("  唤醒词事件: %s", EVT_WAKE_WORD)
        logger.info("  ASR 事件:    %s", EVT_ASR_RESULT)
        logger.info("  LLM 事件:    %s", EVT_LLM_RESULT)
        logger.info("  TTS 事件:    %s", EVT_TTS_DONE)
        logger.info("  打断事件:    %s", EVT_INTERRUPT)

    def stop(self):
        """停止对话引擎"""
        self._running = False
        logger.info("VoiceDialog 停止")

    # ─── 内部事件处理 ───

    def _on_wake_word(self, audio=None, **kwargs):
        """唤醒词检测到"""
        if not self._running:
            return
        logger.info("唤醒词检测到")

        # 打断当前对话
        if self.sm.current.value in ("speaking", "listening", "working"):
            self._interrupt_requested = True

        # Phase 4.4: 声纹识别（如果有音频数据）
        if self._auto_voiceprint and self._voice_service and audio is not None:
            try:
                speaker = self._voice_service.identify(audio)
                if speaker:
                    self._current_speaker = speaker
                    logger.info("声纹识别: %s (sim=%.3f)",
                                speaker["name"], speaker["similarity"])
                    # 广播识别结果
                    if self._bus:
                        self._bus.emit("voice.speaker_identified", **speaker)
                else:
                    self._current_speaker = None
            except Exception as e:
                logger.warning("声纹识别失败: %s", e)
                self._current_speaker = None

        # 异步执行唤醒流程
        threading.Thread(target=self._run_wake_flow, daemon=True).start()

    def _run_wake_flow(self):
        """唤醒流程: → WAKING → LISTENING"""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self._wake_flow_async())
            loop.close()
        except Exception as e:
            logger.error("唤醒流程异常: %s", e)

    async def _wake_flow_async(self):
        await self.sm.wake(reason="wake_word")
        # 模拟唤醒完成
        await asyncio.sleep(0.3)
        await self.sm.listen(reason="wake_ready")

        # 开始 ASR
        self._start_asr()

    def _start_asr(self):
        """开始录音+ASR"""
        self._listening = True
        self._current_asr_text = ""
        if self._asr_start_cb:
            try:
                self._asr_start_cb()
            except Exception as e:
                logger.error("ASR 启动失败: %s", e)
                # ASR 失败，回到 IDLE
                threading.Thread(target=self._fallback_idle, daemon=True).start()

    def _fallback_idle(self):
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self.sm.transition(
                "idle", reason="asr_failed"))
            loop.close()
        except Exception:
            pass

    def _on_asr_result(self, text=None, **kwargs):
        """ASR 完成"""
        if not self._listening:
            return
        self._listening = False
        text = text or kwargs.get("text", "")
        self._current_asr_text = text
        logger.info("ASR 结果: %s", text)

        # LISTENING → WORKING
        threading.Thread(target=self._run_asr_done_flow, args=(text,),
                         daemon=True).start()

    def _run_asr_done_flow(self, text):
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self._on_asr_done(text))
            loop.close()
        except Exception as e:
            logger.error("ASR 完成流程异常: %s", e)

    async def _on_asr_done(self, text):
        if not text or not text.strip():
            await self.sm.done(reason="empty_asr")
            return

        await self.sm.work(reason="asr_complete", query=text)

        # Phase 4.5: 记忆系统 — 添加用户输入
        if self._use_memory and self._memory:
            self._memory.add("user", text)

        # Phase 4.4: 个性化前缀（如果有说话人信息）
        query = text
        if self._current_speaker:
            speaker_name = self._current_speaker.get("alias", self._current_speaker.get("name", ""))
            query = f"[{speaker_name}]: {text}"

        # Phase 4.5: 附加上下文记忆
        if self._use_memory and self._memory:
            context = self._memory.get_context(max_turns=10)
            # LLM 回调会自己决定是否使用 context
            # 这里可以附加在 query 中或者通过别的方式传给 LLM

        # 调用 LLM
        reply = await self._call_llm(query)

        if self._interrupt_requested:
            self._interrupt_requested = False
            logger.info("LLM 结果被打断，丢弃回复")
            await self.sm.wake(reason="interrupt")
            return

        if reply and reply.strip():
            await self.sm.speak(reason="llm_done", reply=reply)

            # Phase 4.5: 记忆系统 — 添加助手回复
            if self._use_memory and self._memory:
                self._memory.add("assistant", reply)

            self._play_tts(reply)
        else:
            await self.sm.done(reason="empty_reply")

    async def _call_llm(self, text):
        """调用 LLM 获取回复"""
        if self._llm_cb:
            try:
                if asyncio.iscoroutinefunction(self._llm_cb):
                    return await self._llm_cb(text)
                else:
                    # 同步回调在 executor 中运行
                    loop = asyncio.get_event_loop()
                    return await loop.run_in_executor(None, self._llm_cb, text)
            except Exception as e:
                logger.error("LLM 调用异常: %s", e)
                return "抱歉，我处理时出现了一点问题。"
        return ""

    def _play_tts(self, text):
        """播放 TTS — 支持流式 + 语气变化"""
        # Phase 4.6: 使用流式 TTS（带语气检测）
        if self._tts_player:
            try:
                from audio.streaming_tts import detect_tone

                # Phase 4.4: 个性化语气（根据说话人配置）
                tone = None
                if self._current_speaker:
                    speaker_tone = self._current_speaker.get("tone", "")
                    if speaker_tone and speaker_tone != "default":
                        tone = speaker_tone

                # 自动检测语气
                if tone is None:
                    tone = detect_tone(text)

                def on_tts_done():
                    # TTS 完成后回到 IDLE
                    if self._bus:
                        self._bus.emit(EVT_TTS_DONE)
                    else:
                        threading.Thread(
                            target=self._run_tts_done, daemon=True).start()

                # Phase 4.4: 个性化语音（不同说话人用不同语音）
                voice = None
                if self._current_speaker:
                    speaker_name = self._current_speaker.get("name", "")
                    # 语音选择策略可根据说话人配置后续扩展

                self._tts_player.speak(text, tone=tone, voice=voice)
                
                # 轮询等待完成（非阻塞）
                def _poll_tts():
                    while self._tts_player and self._tts_player.is_playing:
                        if self._interrupt_requested:
                            self._tts_player.stop()
                            break
                        time.sleep(0.1)
                    on_tts_done()
                threading.Thread(target=_poll_tts, daemon=True).start()

                return
            except Exception as e:
                logger.warning("流式 TTS 失败，回退旧版: %s", e)

        # 旧版 TTS 回调（回退）
        if self._tts_cb:
            try:
                def on_done():
                    if self._bus:
                        self._bus.emit(EVT_TTS_DONE)
                    else:
                        threading.Thread(
                            target=self._run_tts_done, daemon=True).start()
                self._tts_cb(text, on_done)
            except Exception as e:
                logger.error("TTS 播放异常: %s", e)
                threading.Thread(target=self._fallback_idle, daemon=True).start()

    def _run_tts_done(self):
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self.sm.done(reason="tts_done"))
            loop.close()
        except Exception:
            pass

    def _on_tts_done(self, **kwargs):
        """TTS 播放完毕"""
        logger.info("TTS 播放完毕")
        # 检查是否有打断请求
        if self._interrupt_requested:
            self._interrupt_requested = False
            threading.Thread(target=self._run_interrupt_wake,
                             daemon=True).start()
            return
        threading.Thread(target=self._run_tts_done, daemon=True).start()

    def _run_interrupt_wake(self):
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self.sm.wake(reason="interrupt"))
            loop.close()
        except Exception:
            pass

    def _on_asr_error(self, error=None, **kwargs):
        """ASR 错误"""
        logger.error("ASR 错误: %s", error or kwargs.get("error", "unknown"))
        self._listening = False
        threading.Thread(target=self._fallback_idle, daemon=True).start()

    def _on_asr_timeout(self, **kwargs):
        """ASR 超时（用户没说话）"""
        logger.info("ASR 超时")
        self._listening = False
        threading.Thread(target=self._run_timeout_idle, daemon=True).start()

    def _run_timeout_idle(self):
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self.sm.done(reason="timeout"))
            loop.close()
        except Exception:
            pass

    def _on_llm_result(self, text=None, **kwargs):
        """LLM 结果（通过 EventBus 返回）"""
        logger.info("LLM 结果: %s", text)
        # 如果已经通过回调处理了，这里就不重复处理
        pass

    def _on_interrupt(self, **kwargs):
        """打断信号"""
        logger.info("打断信号")
        self._interrupt_requested = True

    # ─── 外部控制方法 ───

    def wake(self):
        """手动触发唤醒"""
        self._on_wake_word()

    def feed_asr(self, text):
        """手动输入 ASR 结果（调试用）"""
        self._on_asr_result(text=text)

    @property
    def is_listening(self):
        return self._listening

    @property
    def last_asr_text(self):
        return self._current_asr_text
