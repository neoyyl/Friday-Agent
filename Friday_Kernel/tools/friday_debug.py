#!/usr/bin/env python3
"""
Friday Debug & Maintenance Tool v1.0
=====================================
自动化检测、诊断、修复星期五开发环境。

用法：
  python friday_debug.py             完整检测
  python friday_debug.py --quick     快速检查（跳过依赖安装）
  python friday_debug.py --fix       自动修复常见问题
  python friday_debug.py --doctor    深度诊断 + 输出报告
  python friday_debug.py --watch     持续监控模式（每 N 秒检测）
"""

import sys
import os
import subprocess
import importlib
import ast
import time
import textwrap
import shutil
import json
from pathlib import Path
from datetime import datetime

# ─── 配置 ───────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent          # tools/
PROJECT_DIR = BASE_DIR.parent                        # Friday_Kernel/
MODULES_DIR = PROJECT_DIR / "modules"
KNOWN_ISSUES_LOG = PROJECT_DIR / "logs" / "debug_issues.json"
WATCH_INTERVAL = 60  # --watch 默认间隔（秒）

REQUIRED_PACKAGES = {
    "numpy": "numpy",
    "sounddevice": "sounddevice",
    "webrtcvad": "webrtcvad",
    "edge_tts": "edge-tts",
    "pygame": "pygame",
    "speech_recognition": "SpeechRecognition",
}

OPTIONAL_PACKAGES = {
    "sherpa_onnx": "sherpa-onnx",
    "psutil": "psutil",
    "requests": "requests",
    "PIL": "Pillow",
    "watchdog": "watchdog",
}

DIR_LAYERS = ["core", "entry", "services", "legacy", "audio"]

# ─── 工具函数 ───────────────────────────────────────────────────────

def color(s, code):
    return f"\033[{code}m{s}\033[0m" if sys.platform != "win32" else s

def green(s):  return color(s, "92")
def yellow(s): return color(s, "93")
def red(s):    return color(s, "91")
def blue(s):   return color(s, "94")
def bold(s):   return color(s, "1")

def timestamp():
    return datetime.now().strftime("%H:%M:%S")

def section(title):
    w = 58
    print(f"\n  {'=' * w}")
    print(f"  {bold(title):^{w}}")
    print(f"  {'=' * w}")

def ok(msg):   print(f"  {green('✓')} {msg}")
def warn(msg): print(f"  {yellow('⚠')} {msg}")
def fail(msg): print(f"  {red('✗')} {msg}")
def info(msg): print(f"    {msg}")

class CheckResult:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
        self.fixes_applied = []

    def record(self, name, success, detail=""):
        if success:
            self.passed.append(name)
            ok(name + (f" — {detail}" if detail else ""))
        else:
            self.failed.append(name)
            fail(name + (f" — {detail}" if detail else ""))

    def log_issue(self, category, message, severity="warning"):
        entry = {
            "timestamp": datetime.now().isoformat(),
            "category": category,
            "message": message,
            "severity": severity,
        }
        self.warnings.append(entry)

    @property
    def score(self):
        total = len(self.passed) + len(self.failed)
        return f"{len(self.passed)}/{total}" if total else "0/0"

    def print_summary(self):
        total = len(self.passed) + len(self.failed)
        print(f"\n  {'─' * 58}")
        print(f"  结果: {green(str(len(self.passed)))} 通过, "
              f"{red(str(len(self.failed)))} 失败, "
              f"{yellow(str(len(self.warnings)))} 警告")
        if self.fixes_applied:
            print(f"  修复: {green(str(len(self.fixes_applied)))} 项")
        print(f"  得分: {bold(self.score)}")
        return len(self.failed) == 0


# ─── 检测项 ────────────────────────────────────────────────────────

def check_environment(result: CheckResult):
    section("1. 运行环境")
    ok(f"操作系统: {sys.platform}")
    ok(f"Python: {sys.version.split()[0]} ({"64-bit" if sys.maxsize > 2**32 else "32-bit"})")
    ok(f"项目路径: {PROJECT_DIR}")
    ok(f"模块路径: {MODULES_DIR}")

    # Python >= 3.10
    py_ok = sys.version_info >= (3, 10)
    result.record("Python 版本 ≥ 3.10", py_ok,
                  sys.version.split()[0] if py_ok else f"当前 {sys.version.split()[0]}，需要 ≥ 3.10")

    # 目录存在
    for layer in DIR_LAYERS:
        p = MODULES_DIR / layer
        exists = p.is_dir()
        result.record(f"目录 {layer}/", exists, "✅" if exists else "❌ 缺失")

    # 模块根 __init__.py
    init_ok = (MODULES_DIR / "__init__.py").exists()
    result.record("modules/__init__.py", init_ok)

    # 日志目录
    log_dir = PROJECT_DIR / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    ok(f"日志目录: {log_dir}")


def check_dependencies(result: CheckResult, auto_fix=False):
    section("2. 依赖检查")

    for name, pip_name in REQUIRED_PACKAGES.items():
        try:
            importlib.import_module(name)
            result.record(f"依赖 {name}", True, pip_name)
        except ImportError:
            result.record(f"依赖 {name}", False, f"未安装 ({pip_name})")
            result.log_issue("dependency", f"{name} ({pip_name}) 未安装")
            if auto_fix:
                _pip_install(pip_name)
                result.fixes_applied.append(f"pip install {pip_name}")

    for name, pip_name in OPTIONAL_PACKAGES.items():
        try:
            importlib.import_module(name)
            ok(f"  可选 {name} — {green('✓')} {pip_name}")
        except ImportError:
            warn(f"  可选 {name} — 未安装 ({pip_name})")


def _pip_install(package):
    info(f"    → 正在安装 {package}...")
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", package],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        info(f"    → {green('安装成功')}")
    except Exception:
        fail(f"    → 安装失败: {package}")


def check_syntax(result: CheckResult):
    section("3. 语法检查")

    py_files = list(MODULES_DIR.rglob("*.py"))
    # 排除 __pycache__
    py_files = [f for f in py_files if "__pycache__" not in f.parts]

    errors = 0
    for f in py_files:
        try:
            with open(f, "r", encoding="utf-8") as fp:
                ast.parse(fp.read())
        except SyntaxError as e:
            errors += 1
            rel = f.relative_to(PROJECT_DIR)
            result.record(f"语法 {rel}", False, str(e))
            result.log_issue("syntax", f"{rel}: {e}", severity="error")

    if errors == 0:
        result.record(f"语法检查 ({len(py_files)} 文件)", True, "全部通过")
    else:
        result.record(f"语法检查 ({len(py_files)} 文件)", False, f"{errors} 个错误")


def check_imports(result: CheckResult):
    section("4. 导入完整性")

    sys.path.insert(0, str(MODULES_DIR))
    sys.path.insert(0, str(MODULES_DIR / "services"))
    sys.path.insert(0, str(MODULES_DIR / "legacy"))
    sys.path.insert(0, str(MODULES_DIR / "entry"))

    modules_to_check = [
        # core
        ("core.event_bus", "EventBus"),
        # entry
        ("entry.cli", "main"),
        ("entry.nuwa", "FridayBridge"),
        ("entry.tts_utils", "truncate_tts"),
        # services
        ("services.friday_hotkey", "FridayHotkey"),
        ("services.friday_voiceprint", "VoiceprintRecognizer"),
        # legacy
        ("legacy.friday_voice", "FridayVoiceEngine"),
        ("legacy.friday_listener", "FridayListener"),
        ("legacy.friday_notifier", "FridayNotifier"),
        ("legacy.knowledge_engine", "KnowledgeEngine"),
        # audio
        ("audio.player", "TTSPlayer"),
        ("audio.recognizer", "VADDetector"),
        # wrappers
        ("friday_all", "main"),
    ]

    for mod_path, attr in modules_to_check:
        try:
            mod = importlib.import_module(mod_path)
            if attr:
                getattr(mod, attr)
            result.record(f"导入 {mod_path}.{attr}", True)
        except ImportError as e:
            result.record(f"导入 {mod_path}.{attr}", False, str(e))
            result.log_issue("import", f"{mod_path}.{attr}: {e}", severity="error")
        except AttributeError as e:
            result.record(f"导入 {mod_path}.{attr}", False, f"属性缺失: {e}")
            result.log_issue("import", f"{mod_path} 缺少 {attr}: {e}", severity="error")


def check_event_bus(result: CheckResult):
    section("5. 事件总线测试")

    try:
        from core.event_bus import EventBus
        bus = EventBus()
        result.record("EventBus 创建", True)

        # 注册/注销（off 需要 callback 引用）
        cb_results = []
        def hello_cb(**kw):
            cb_results.append(("hello", kw.get("name")))
        bus.on("test.hello", hello_cb)
        bus.emit("test.hello", name="world")
        assert len(cb_results) == 1 and cb_results[0] == ("hello", "world")

        bus.off("test.hello", hello_cb)
        bus.emit("test.hello", name="again")
        assert len(cb_results) == 1  # 不增加
        result.record("EventBus on/off/emit", True)

        # 一次性
        once_results = []
        bus.once("test.once", lambda **kw: once_results.append(True))
        bus.emit("test.once")
        bus.emit("test.once")
        assert len(once_results) == 1
        result.record("EventBus once", True)

        # register / get_module
        class DummyMod:
            def on_register(self, b):
                self.bus = b
        mod = DummyMod()
        bus.register(mod)
        assert bus.get_module("DummyMod") is mod
        result.record("EventBus register/get_module", True)

    except Exception as e:
        result.record("事件总线测试", False, str(e))
        result.log_issue("event_bus", str(e), severity="error")


def check_audio(result: CheckResult):
    section("6. 音频子系统")

    try:
        from audio.player import TTSPlayer
        p = TTSPlayer()
        avail = p.tts_available
        result.record("TTSPlayer 初始化", True,
                      f"TTS {'可用' if avail else '不可用——未配置 edge-tts 或 网络'}")

        from audio.recognizer import VADDetector, SpeechValidator, normalize_audio, frames_to_audio
        v = VADDetector(sample_rate=16000)
        result.record("VADDetector 初始化", True, f"模式: {v._vad_mode}")

        # 模拟帧
        import numpy as np
        frames = [np.zeros((320,), dtype=np.float64),
                  np.zeros((320,), dtype=np.float64)]
        audio_data, duration = frames_to_audio(frames, 16000)
        assert duration > 0
        result.record("frames_to_audio", True, f"{duration:.2f}s")

        audio_norm = normalize_audio(audio_data)
        assert audio_norm.shape == audio_data.shape
        result.record("normalize_audio", True)

        # SpeechValidator 时长过滤（<0.3s 的音频被正确拒绝）
        short_data = np.zeros((1600,), dtype=np.float64)  # 0.1s @16kHz
        is_speech = SpeechValidator.is_actual_speech(short_data, 0.1)
        assert is_speech is False, f"短音频应被拒绝，但返回 {is_speech}"
        result.record("SpeechValidator（短音频拒绝）", True)

        # SpeechValidator 高频振荡（响指/拍手类似）被正确拒绝
        oscillation = np.array([1.0 if i % 2 == 0 else -1.0 for i in range(16000)], dtype=np.float64)
        is_speech = SpeechValidator.is_actual_speech(oscillation, 1.0)
        result.record("SpeechValidator（高频振荡拒绝）", not is_speech)

    except Exception as e:
        result.record("音频子系统", False, str(e))
        result.log_issue("audio", str(e), severity="error")


def check_integration(result: CheckResult):
    section("7. 集成测试")

    try:
        from core.event_bus import EventBus
        bus = EventBus()

        from legacy.friday_voice import FridayVoiceEngine
        from legacy.friday_listener import FridayListener
        from services.friday_hotkey import FridayHotkey
        from legacy.friday_notifier import FridayNotifier

        bus.register(FridayVoiceEngine())
        bus.register(FridayListener())
        bus.register(FridayHotkey(hotkey="ctrl+alt+t", event_name="test.hotkey"))
        bus.register(FridayNotifier())

        count = bus.module_count
        result.record(f"总线注册 4 模块", count == 4, f"实际: {count}")

        # service 查询
        has_tts = bus.has_service("tts")
        result.record("bus.has_service('tts')", has_tts)

        # 事件路由
        cmd_results = []
        bus.on("voice.command", lambda text, **kw: cmd_results.append(text))
        bus.emit("voice.command", text="测试命令")
        assert cmd_results == ["测试命令"]
        result.record("总线事件路由", True)

    except Exception as e:
        result.record("集成测试", False, str(e))
        result.log_issue("integration", str(e), severity="error")


def check_stale_files(result: CheckResult):
    section("8. 文件健康")

    # __pycache__
    caches = list(MODULES_DIR.rglob("__pycache__"))
    if caches:
        warn(f"发现 {len(caches)} 个 __pycache__ 目录（正常运行时自动生成）")

    # .pyc 文件
    pyc_files = list(MODULES_DIR.rglob("*.pyc"))
    if pyc_files:
        warn(f"发现 {len(pyc_files)} 个 .pyc 文件（可清理）")

    # __init__.py 覆盖率
    dirs_without_init = []
    for d in MODULES_DIR.rglob("*"):
        if d.is_dir() and d != MODULES_DIR and "__pycache__" not in d.parts:
            if not (d / "__init__.py").exists():
                dirs_without_init.append(d.relative_to(MODULES_DIR))
    if dirs_without_init:
        warn(f"{len(dirs_without_init)} 个目录缺少 __init__.py:")
        for d in dirs_without_init[:5]:
            info(f"  {d}")
    else:
        ok("所有 Python 包目录均有 __init__.py")

    # 超大文件
    large_files = []
    for f in MODULES_DIR.rglob("*.py"):
        if f.stat().st_size > 100 * 1024:
            large_files.append((f.relative_to(MODULES_DIR), f.stat().st_size // 1024))
    if large_files:
        warn(f"超大文件 (>100KB):")
        for name, size in large_files:
            info(f"  {name} ({size}KB)")
    else:
        ok("无超大文件")

    result.record("文件健康扫描", True, f"{len(caches)} __pycache__, {len(pyc_files)} .pyc")


def fix_common(result: CheckResult):
    section("9. 自动修复")

    # 修复1: 清理 __pycache__
    caches = list(MODULES_DIR.rglob("__pycache__"))
    for d in caches:
        try:
            shutil.rmtree(d)
            result.fixes_applied.append(f"删除 __pycache__: {d.relative_to(PROJECT_DIR)}")
        except Exception:
            pass
    if caches:
        ok(f"已清理 {len(caches)} 个 __pycache__ 目录")

    # 修复2: 清理 .pyc
    pyc_files = list(MODULES_DIR.rglob("*.pyc"))
    for f in pyc_files:
        try:
            f.unlink()
            result.fixes_applied.append(f"删除 .pyc: {f.relative_to(PROJECT_DIR)}")
        except Exception:
            pass
    if pyc_files:
        ok(f"已清理 {len(pyc_files)} 个 .pyc 文件")

    # 修复3: 补充缺失的 __init__.py
    for d in MODULES_DIR.rglob("*"):
        if d.is_dir() and d != MODULES_DIR and "__pycache__" not in d.parts:
            init_file = d / "__init__.py"
            if not init_file.exists():
                try:
                    init_file.write_text(f'"""\n{d.name} package\n"""\n', encoding="utf-8")
                    result.fixes_applied.append(f"创建 {init_file.relative_to(PROJECT_DIR)}")
                except Exception:
                    pass
    ok("已补充缺失的 __init__.py")

    # 修复4: 创建日志目录
    log_dir = PROJECT_DIR / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    # 修复5: 备份已知问题
    if result.warnings:
        KNOWN_ISSUES_LOG.parent.mkdir(parents=True, exist_ok=True)
        try:
            existing = []
            if KNOWN_ISSUES_LOG.exists():
                existing = json.loads(KNOWN_ISSUES_LOG.read_text(encoding="utf-8"))
            existing.extend(result.warnings)
            # 只保留最近 100 条
            existing = existing[-100:]
            KNOWN_ISSUES_LOG.write_text(
                json.dumps(existing, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            result.fixes_applied.append(f"问题已记录: {KNOWN_ISSUES_LOG}")
            ok(f"问题已记录到 {KNOWN_ISSUES_LOG}")
        except Exception as e:
            warn(f"写入问题日志失败: {e}")

    if not result.fixes_applied:
        info("无需修复")


def run_doctor(result: CheckResult):
    """深度诊断 + 输出详细报告"""
    section("10. 深度诊断")

    # 系统资源
    try:
        import psutil
        mem = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=0.5)
        disk = psutil.disk_usage(str(PROJECT_DIR))
        ok(f"CPU: {cpu}% | 内存: {mem.percent}% ({mem.available // 1024**3}GB 可用) | 磁盘: {disk.percent}%")
    except ImportError:
        warn("psutil 未安装，跳过系统资源检测")
        ok("系统资源: 跳过 (pip install psutil)")

    # 音频设备
    try:
        import sounddevice as sd
        devices = sd.query_devices()
        default_in = sd.default.device[0]
        default_out = sd.default.device[1]
        info(f"  默认输入: {devices[default_in]['name'] if default_in else '无'}")
        info(f"  默认输出: {devices[default_out]['name'] if default_out else '无'}")
        hostapi_count = len(sd.query_hostapis())
        ok(f"音频设备: {len(devices)} 个设备, {hostapi_count} 个 API")
    except Exception as e:
        warn(f"音频设备查询失败: {e}")

    # 模型文件
    model_dir = PROJECT_DIR / "models"
    if model_dir.exists():
        onnx_models = list(model_dir.rglob("*.onnx"))
        info(f"  ONNX 模型: {len(onnx_models)} 个")
        for m in onnx_models[:3]:
            info(f"    {m.relative_to(PROJECT_DIR)} ({m.stat().st_size // 1024**2}MB)")
    else:
        warn("models/ 目录不存在")

    # 网络连通性（edge-tts）
    try:
        import socket
        socket.create_connection(("speech.platform.bing.com", 443), timeout=3).close()
        ok("网络连通: edge-tts API 可达")
    except Exception:
        warn("网络连通: edge-tts API 不可达（离线模式仍可用）")


def generate_report(result: CheckResult):
    """生成文本报告"""
    report_path = PROJECT_DIR / "logs" / f"debug_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    lines = []
    lines.append("=" * 60)
    lines.append("  Friday Debug Report")
    lines.append(f"  时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"  系统: {sys.platform} | Python {sys.version.split()[0]}")
    lines.append(f"  项目: {PROJECT_DIR}")
    lines.append("=" * 60)
    lines.append(f"")
    lines.append(f"  通过: {len(result.passed)}")
    lines.append(f"  失败: {len(result.failed)}")
    lines.append(f"  警告: {len(result.warnings)}")
    lines.append(f"  修复: {len(result.fixes_applied)}")
    lines.append(f"")
    if result.failed:
        lines.append("  --- 失败项 ---")
        for f in result.failed:
            lines.append(f"    ✗ {f}")
        lines.append(f"")
    if result.warnings:
        lines.append("  --- 警告 ---")
        for w in result.warnings:
            lines.append(f"    ⚠ [{w['severity']}] {w['category']}: {w['message']}")
        lines.append(f"")
    if result.fixes_applied:
        lines.append("  --- 已执行修复 ---")
        for fx in result.fixes_applied:
            lines.append(f"    ✓ {fx}")
        lines.append(f"")
    lines.append("=" * 60)

    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


# ─── 主流程 ───────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Friday Debug & Maintenance Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            示例:
              python friday_debug.py             完整检测
              python friday_debug.py --quick     快速检查
              python friday_debug.py --fix       检测 + 自动修复
              python friday_debug.py --doctor    深度诊断
              python friday_debug.py --watch     每60秒持续监控
        """),
    )
    parser.add_argument("--quick", action="store_true", help="快速检查（不检查语法/依赖）")
    parser.add_argument("--fix", action="store_true", help="检测并自动修复常见问题")
    parser.add_argument("--doctor", action="store_true", help="深度诊断 + 详细报告")
    parser.add_argument("--watch", type=int, nargs="?", const=WATCH_INTERVAL,
                        help="持续监控模式（默认间隔 {} 秒）".format(WATCH_INTERVAL))
    parser.add_argument("--report", action="store_true", help="生成文本报告")
    args = parser.parse_args()

    print(f"\n{blue('┌──────────────────────────────────────────────────────────┐')}")
    print(f"{blue('│')}  {bold('Friday Debug & Maintenance Tool v1.0')}              {blue('│')}")
    print(f"{blue('│')}  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}                              {blue('│')}")
    print(f"{blue('└──────────────────────────────────────────────────────────┘')}")

    start_time = time.time()

    result = CheckResult()

    # 检测
    check_environment(result)
    check_dependencies(result, auto_fix=args.fix)

    if not args.quick:
        check_syntax(result)

    check_imports(result)
    check_event_bus(result)
    check_audio(result)
    check_integration(result)
    check_stale_files(result)

    if args.doctor:
        run_doctor(result)

    if args.fix:
        fix_common(result)

    if args.report or args.doctor:
        report_path = generate_report(result)
        ok(f"报告已生成: {report_path}")

    elapsed = time.time() - start_time
    passed = result.print_summary()
    info(f"耗时: {elapsed:.1f}s")

    if args.fix and result.fixes_applied:
        print(f"\n  {green('自修复完成:')}")
        for fx in result.fixes_applied:
            print(f"    {green('✓')} {fx}")

    # ─── 持续监控 ──────────────────────────────────────────────
    if args.watch:
        interval = args.watch
        print(f"\n  {blue('监控模式启动')} — 每 {interval}s 检测一次 (Ctrl+C 退出)")
        try:
            while True:
                time.sleep(interval)
                print(f"\n  [{timestamp()}] {bold('定时检测...')}")
                watch_result = CheckResult()
                check_environment(watch_result)
                check_imports(watch_result)
                check_event_bus(watch_result)
                watch_result.print_summary()
        except KeyboardInterrupt:
            print(f"\n  {yellow('监控已退出')}")

    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
