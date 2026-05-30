#!/usr/bin/env python3
"""
Friday CLI — 事件驱动命令行入口
======================================
唯一职责：装配 EventBus + 模块 → 启动 Friday。

不再存在"中心文件"。每个入口都是独立的组合根。

使用：
  python -m entry.cli

作者：Friday Kernel
版本：3.0.0
"""

import sys
import os
import threading
import time
import itertools
from pathlib import Path

# ── 路径引导 ─────────────────────────────────────────
_MODULE_ROOT = str(Path(__file__).parent.parent)
sys.path.insert(0, _MODULE_ROOT)
sys.path.insert(0, str(Path(_MODULE_ROOT) / "services"))
sys.path.insert(0, str(Path(_MODULE_ROOT) / "legacy"))

# ── SSL 修复 ─────────────────────────────────────────
_local_cert = os.path.join(
    os.environ.get("LOCALAPPDATA", ""), ".certifi", "cacert.pem"
)
if os.path.exists(_local_cert):
    os.environ.setdefault("SSL_CERT_FILE", _local_cert)
    os.environ.setdefault("REQUESTS_CA_BUNDLE", _local_cert)

# ── 导入 ─────────────────────────────────────────────
from core.event_bus import EventBus
from friday_voice import FridayVoiceEngine
from voiceprint_gate import VoiceprintGate
from friday_listener import FridayListener
from friday_hotkey import FridayHotkey
from friday_notifier import FridayNotifier

from legacy.knowledge_engine import KnowledgeEngine
from entry.tts_utils import build_tts_response


# ═══════════════ 初始化阶段 ═══════════════

def _init_voice(bus: EventBus):
    """1. 语音引擎"""
    print("\n🔊 初始化语音引擎...")
    try:
        voice = FridayVoiceEngine()
        bus.register(voice)
        print(f"  {'✅' if voice.tts_available else '❌'} TTS: edge-tts")
        return voice
    except Exception as e:
        print(f"  ⚠️ 语音引擎不可用: {e}")
        return None


def _init_knowledge(bus: EventBus) -> KnowledgeEngine:
    """2. 知识引擎"""
    print("\n🧠 加载知识引擎...")
    knowledge = KnowledgeEngine()
    knowledge.ensure_ready()
    bus.register_service("knowledge", knowledge)
    return knowledge


def _init_listener(bus: EventBus, voice):
    """3. 语音唤醒监听"""
    print("\n🎤 启动语音监听...")

    gate = VoiceprintGate(threshold=0.78)
    enrolled = gate.check_enrolled() if gate else False

    listener = FridayListener(voiceprint_gate=gate if enrolled else None)
    bus.register(listener)

    if voice:
        listener.set_is_speaking_check(lambda: voice.is_speaking)
        listener.on_speech_during_playback = lambda: voice.stop_speaking()

    listener.start()

    status = "已开启 (声纹已注册)" if enrolled else "已开启 (声纹未注册)"
    print(f"  🎤 语音唤醒 {status}")

    # 启动后台线程保持 listener 存活
    threading.Thread(target=_listener_keepalive, daemon=True).start()
    time.sleep(0.5)
    return listener


def _listener_keepalive():
    """Listener 后台保活线程"""
    while True:
        time.sleep(1)


def _init_hotkeys(bus: EventBus):
    """4. 快捷键"""
    print("\n⌨️ 注册快捷键...")
    hk_wake = FridayHotkey(hotkey="ctrl+alt+f", event_name="hotkey.wake")
    hk_end = FridayHotkey(hotkey="ctrl+alt+q", event_name="hotkey.end")
    hk_query = FridayHotkey(hotkey="ctrl+alt+g", event_name="hotkey.query")
    bus.register(hk_wake)
    bus.register(hk_end)
    bus.register(hk_query)


def _init_notifier(bus: EventBus):
    """5. 主动提醒"""
    print("\n🔔 启动主动提醒...")
    try:
        notifier = FridayNotifier()
        bus.register(notifier)
        notifier.start()
        return notifier
    except Exception as e:
        print(f"  ⚠️ 主动提醒不可用: {e}")
        return None


# ═══════════════ 事件处理器 ═══════════════

def _handle_voice_command(text=None, audio=None, voice=None, knowledge=None, bus=None, **kwargs):
    """处理语音识别结果"""
    if not text:
        if voice:
            voice.speak("抱歉，我没有听清")
        return

    print(f"\n  🗣️ 你说: \"{text}\"")
    result = knowledge.query(text)

    if result["type"] == "command":
        if voice:
            voice.speak("好的，再见")
        print("  👋 结束对话")
        return

    tts_text = build_tts_response(result, text)

    print(f"  🤖 {result['type'].upper()}:")
    print(f"  {result['text'][:500]}")
    if result.get("sources"):
        print(f"  📚 来源: {', '.join(result['sources'][:3])}")

    if voice:
        voice.speak(tts_text)


def _text_query_loop(knowledge: KnowledgeEngine):
    """交互式文本查询"""
    print("\n" + "=" * 50)
    print("  📝 Friday 知识查询模式")
    print("  输入问题，按 Enter 查询")
    print("  输入 `exit` 或 `q` 退出")
    print("=" * 50)

    while True:
        try:
            q = input("\n  ❓ ").strip()
            if not q:
                continue
            if q.lower() in ("exit", "quit", "q"):
                print("  👋 退出查询模式")
                break

            print("  🔍 搜索中...")
            result = knowledge.query(q)

            if result["type"] == "answer":
                print(f"\n  🤖 {result['text']}")
            elif result["type"] == "knowledge":
                print(f"\n  📚 {result['text'][:600]}")
            else:
                print(f"  {result['text']}")

            if result.get("sources"):
                print(f"  来源: {' | '.join(result['sources'][:3])}")

        except KeyboardInterrupt:
            print("\n  👋 退出查询模式")
            break
        except Exception as e:
            print(f"  ⚠️ 错误: {e}")


def _on_hotkey_end(listener):
    """快捷键：结束对话"""
    if listener:
        listener.end_conversation()


def _on_hotkey_query(knowledge):
    """快捷键：打开文字查询"""
    threading.Thread(target=_text_query_loop, args=(knowledge,), daemon=True).start()


def _on_notifier_notify(title=None, message=None, **kwargs):
    """系统通知"""
    if not title or not message:
        return
    try:
        from plyer import notification
        notification.notify(title=title, message=message, timeout=5, app_name="Friday")
    except Exception:
        pass


def _on_notifier_speak(text=None, voice=None, bus=None, **kwargs):
    """TTS 播报"""
    if not text or not voice:
        return
    print(f"  🗣️ 播报: {text}")
    bus.emit("voice.speak", text=text)


def _register_handlers(bus, voice, knowledge, listener):
    """6. 注册事件处理器"""
    bus.on("voice.command",
           lambda text=None, audio=None, **kw:
               _handle_voice_command(text=text, audio=audio, voice=voice,
                                     knowledge=knowledge, bus=bus, **kw))
    bus.on("voice.wake", lambda text, audio: print(f"\n🔥 语音唤醒!"))
    bus.on("hotkey.wake", lambda: print(f"\n⌨️ 快捷键唤醒!"))
    bus.on("hotkey.end", lambda: _on_hotkey_end(listener))
    bus.on("hotkey.query", lambda: _on_hotkey_query(knowledge))
    bus.on("notifier.notify", _on_notifier_notify)
    bus.on("notifier.speak",
           lambda text=None, **kw: _on_notifier_speak(text=text, voice=voice, bus=bus, **kw))


# ═══════════════ LLM 等待阶段 ═══════════════

def _wait_for_llm(knowledge):
    """7. 等待本地 LLM 加载"""
    print("\n🤖 预加载本地 LLM（DeepSeek-R1-8B，约 4.4GB）...")
    spinner = itertools.cycle(["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"])
    llm_done = False
    llm_check_start = time.time()
    time.sleep(0.3)

    while not knowledge.llm_ready:
        elapsed = time.time() - llm_check_start
        if elapsed > 60:
            print(f"  ⚠️ LLM 加载超时（60s），后台继续加载中")
            break
        loader_status = getattr(knowledge._llm, 'status', 'loading') if knowledge._llm else 'loading'
        print(f"  {next(spinner)} 加载中...（{elapsed:.0f}s，{loader_status}）", end="\r")
        time.sleep(0.5)
    else:
        llm_done = True

    llm_total = time.time() - knowledge._llm_load_start
    if llm_done:
        print(f"  ✅ LLM 就绪（{llm_total:.1f}s，CPU 模式）{' ' * 20}")
    else:
        print(f"  {' ' * 50}")

    return llm_done, llm_total


def _print_summary(bus, llm_done, llm_total):
    """8. 启动摘要"""
    print("\n" + "=" * 50)
    print("  🟢 Friday CLI 运行中")
    print("  🎤 说句话唤醒 | Ctrl+Alt+F 快捷键")
    print("  📝 Ctrl+Alt+G 文字查询 | Ctrl+Alt+Q 结束对话")
    print("  💬 说「拜拜」结束对话")
    print(f"  {bus.summary()}")
    if llm_done:
        print(f"  🤖 LLM 已就绪（{llm_total:.1f}s）")
    else:
        print(f"  🤖 LLM 后台加载中（{llm_total:.0f}s）")
    print("=" * 50)


def _main_loop(knowledge):
    """9. 主循环（保持运行）"""
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n  👋 正在关闭 Friday...")
        knowledge.unload_llm()
        print("  ✅ Friday 已停止")


# ── 组合根 ───────────────────────────────────────────

def main():
    """Friday CLI 组合根：装配 → 启动 → 保持运行"""
    print("=" * 50)
    print("  Friday CLI (事件驱动)")
    print("  启动中，请稍候...")
    print("=" * 50)

    bus = EventBus()

    # 1-5. 模块初始化
    voice = _init_voice(bus)
    knowledge = _init_knowledge(bus)
    listener = _init_listener(bus, voice)
    _init_hotkeys(bus)
    notifier = _init_notifier(bus)

    # 6. 事件接线
    _register_handlers(bus, voice, knowledge, listener)

    # 7-9. LLM 等待 → 打印 → 保持运行
    llm_done, llm_total = _wait_for_llm(knowledge)
    _print_summary(bus, llm_done, llm_total)
    _main_loop(knowledge)


if __name__ == "__main__":
    main()
