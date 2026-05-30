"""
窗口传感器 (Window Sensor) — 实时活跃窗口检测
==============================================
通过 Win32 API 获取前台进程名、窗口标题。
识别用户在用什么应用（VS Code、浏览器、终端等）。

触发条件：每 2 秒轮询（或事件驱动），变化时推送 EventBus。
"""

import ctypes
import ctypes.wintypes
import logging
import os
import threading
import time
from dataclasses import dataclass, field, asdict
from typing import Optional

logger = logging.getLogger("perception.window")

# ─── Win32 API 封装 ───

_WinDll = ctypes.windll.user32

# GetForegroundWindow
_GetForegroundWindow = _WinDll.GetForegroundWindow
_GetForegroundWindow.argtypes = []
_GetForegroundWindow.restype = ctypes.wintypes.HWND

# GetWindowTextLength
_GetWindowTextLength = _WinDll.GetWindowTextLengthW
_GetWindowTextLength.argtypes = [ctypes.wintypes.HWND]
_GetWindowTextLength.restype = ctypes.c_int

# GetWindowText
_GetWindowText = _WinDll.GetWindowTextW
_GetWindowText.argtypes = [ctypes.wintypes.HWND, ctypes.wintypes.LPWSTR, ctypes.c_int]
_GetWindowText.restype = ctypes.c_int

# GetWindowThreadProcessId
_GetWindowThreadProcessId = _WinDll.GetWindowThreadProcessId
_GetWindowThreadProcessId.argtypes = [ctypes.wintypes.HWND, ctypes.POINTER(ctypes.wintypes.DWORD)]
_GetWindowThreadProcessId.restype = ctypes.wintypes.DWORD

# OpenProcess / CloseHandle (kernel32)
_KernelDll = ctypes.windll.kernel32
_OpenProcess = _KernelDll.OpenProcess
_OpenProcess.argtypes = [ctypes.wintypes.DWORD, ctypes.wintypes.BOOL, ctypes.wintypes.DWORD]
_OpenProcess.restype = ctypes.wintypes.HANDLE

_CloseHandle = _KernelDll.CloseHandle
_CloseHandle.argtypes = [ctypes.wintypes.HANDLE]
_CloseHandle.restype = ctypes.wintypes.BOOL

_QueryFullProcessImageNameW = _KernelDll.QueryFullProcessImageNameW
_QueryFullProcessImageNameW.argtypes = [ctypes.wintypes.HANDLE, ctypes.wintypes.DWORD, ctypes.wintypes.LPWSTR, ctypes.POINTER(ctypes.wintypes.DWORD)]
_QueryFullProcessImageNameW.restype = ctypes.wintypes.BOOL

PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
MAX_PATH = 260


@dataclass
class WindowInfo:
    """活跃窗口信息"""
    process_name: str = ""           # Code.exe, chrome.exe
    window_title: str = ""           # "main.py - myproject - VS Code"
    hwnd: int = 0
    is_vscode: bool = False
    is_browser: bool = False
    is_terminal: bool = False
    is_explorer: bool = False
    timestamp: float = 0.0

    def __bool__(self):
        return bool(self.process_name) or bool(self.window_title)


def _get_process_name(hwnd):
    """通过 HWND 获取进程名称"""
    pid = ctypes.wintypes.DWORD()
    _GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    if not pid.value:
        return ""

    handle = _OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION,
                          False, pid.value)
    if not handle:
        return ""

    try:
        exe_path = ctypes.create_unicode_buffer(MAX_PATH)
        size = ctypes.wintypes.DWORD(MAX_PATH)
        if _QueryFullProcessImageNameW(handle, 0, exe_path, ctypes.byref(size)):
            return os.path.basename(exe_path.value)
    finally:
        _CloseHandle(handle)

    return ""


def _get_window_title(hwnd):
    """获取窗口标题"""
    length = _GetWindowTextLength(hwnd)
    if not length:
        return ""
    buffer = ctypes.create_unicode_buffer(length + 1)
    _GetWindowText(hwnd, buffer, length + 1)
    return buffer.value


def get_active_window() -> WindowInfo:
    """获取当前前台窗口信息"""
    hwnd = _GetForegroundWindow()
    if not hwnd:
        return WindowInfo()

    proc_name = _get_process_name(hwnd)
    title = _get_window_title(hwnd)

    info = WindowInfo(
        process_name=proc_name.lower() if proc_name else "",
        window_title=title,
        hwnd=hwnd,
        is_vscode="code.exe" in (proc_name or "").lower(),
        is_browser=any(b in (proc_name or "").lower()
                       for b in ["chrome", "msedge", "firefox", "opera", "brave"]),
        is_terminal=any(t in (proc_name or "").lower()
                        for t in ["cmd.exe", "powershell", "windowsterminal",
                                  "wt.exe", "bash"]),
        is_explorer="explorer.exe" in (proc_name or "").lower(),
        timestamp=time.time(),
    )
    return info


def parse_vscode_title(title: str) -> dict:
    """
    从 VS Code 窗口标题解析信息。
    
    标题格式: "文件名 (工作区) - Visual Studio Code"
    或:        "文件名 — 项目名 — Visual Studio Code"
    """
    if not title:
        return {}

    result = {}

    # 去掉尾部的 VS Code 标记
    cleaned = title.replace(" - Visual Studio Code", "")
    cleaned = cleaned.replace(" — Visual Studio Code", "")
    cleaned = cleaned.strip()

    # 尝试解析 "文件名 — 项目" 格式
    if " — " in cleaned:
        parts = cleaned.split(" — ", 1)
        result["file"] = parts[0].strip()
        result["project"] = parts[1].strip() if len(parts) > 1 else ""
    elif " - " in cleaned:
        parts = cleaned.split(" - ", 1)
        result["file"] = parts[0].strip()
        result["project"] = parts[1].strip() if len(parts) > 1 else ""
    else:
        result["file"] = cleaned
        result["project"] = ""

    # 文件语言判断
    file_name = result.get("file", "")
    if "." in file_name:
        ext = file_name.rsplit(".", 1)[-1].lower()
        lang_map = {
            "py": "Python", "js": "JavaScript", "ts": "TypeScript",
            "tsx": "TypeScript React", "jsx": "JavaScript React",
            "html": "HTML", "css": "CSS", "scss": "SCSS",
            "json": "JSON", "md": "Markdown", "yaml": "YAML",
            "yml": "YAML", "toml": "TOML", "rs": "Rust",
            "go": "Go", "java": "Java", "cpp": "C++", "c": "C",
            "h": "C/C++ Header", "hpp": "C++ Header",
            "cs": "C#", "swift": "Swift", "kt": "Kotlin",
            "rb": "Ruby", "php": "PHP", "sh": "Shell",
            "bat": "Batch", "ps1": "PowerShell",
            "sql": "SQL", "vue": "Vue", "svelte": "Svelte",
        }
        result["language"] = lang_map.get(ext, ext.upper())

    result["raw_title"] = title
    return result


class WindowSensor:
    """
    活跃窗口传感器。
    定期轮询前台窗口，变化时回调通知。
    """

    def __init__(self, event_bus=None, poll_interval=2.0):
        self._bus = event_bus
        self._interval = poll_interval
        self._last_info = WindowInfo()
        self._running = False
        self._thread = None
        self._callbacks = []

    def on_change(self, callback):
        """注册窗口变化回调"""
        self._callbacks.append(callback)

    def start(self):
        """开始轮询"""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._poll_loop,
                                        daemon=True, name="window-sensor")
        self._thread.start()
        logger.info("WindowSensor 启动 (interval=%ss)", self._interval)

    def stop(self):
        self._running = False

    def _poll_loop(self):
        while self._running:
            try:
                info = get_active_window()
                if info.process_name != self._last_info.process_name or \
                   info.window_title != self._last_info.window_title:
                    self._on_window_changed(info)
                    self._last_info = info
            except Exception as e:
                logger.error("窗口检测异常: %s", e)
            time.sleep(self._interval)

    def _on_window_changed(self, info):
        """窗口变化处理"""
        # 清理零宽空格等不可编码字符
        safe_title = info.window_title[:60].replace('\u200b', '').replace('\u200c', '').replace('\u200d', '').replace('\ufeff', '')
        logger.info("窗口切换: %s | %s", info.process_name, safe_title)

        # 通知回调
        for cb in self._callbacks:
            try:
                cb(info)
            except Exception as e:
                logger.error("窗口回调异常: %s", e)

        # 通知 EventBus
        if self._bus:
            payload = asdict(info)
            payload["vscode"] = parse_vscode_title(info.window_title) if info.is_vscode else {}
            self._bus.emit("perception.window_changed", **payload)

    def get_current(self) -> WindowInfo:
        return get_active_window()

    @property
    def is_running(self):
        return self._running
