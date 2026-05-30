#!/usr/bin/env python3
# Friday Kernel 智能启动脚本 v2.0
# 新增：Friday OS Layer 系统监控

import os
import sys
from pathlib import Path


def console_safe(text):
    """清理文本中的非GBK字符，确保Windows控制台安全输出"""
    # 常见emoji→文本映射
    emoji_map = {
        '\U0001f7e2': '[OK]', '\U0001f7e1': '[~]', '\U0001f7e0': '[!]', '\U0001f534': '[!!]',
        '\u26a0\ufe0f': '[!]', '\u26a0': '[!]',
        '\U0001f4ca': '',   # 📊
        '\u2705': '[OK]',   # ✅
        '\u2757': '[!]',    # ❗
        '\U0001f4a1': '',   # 💡
        '\U0001f5a5\ufe0f': '', # 🖥️
        '\U0001f5a5': '',   # 🖥
    }
    for emoji, replacement in emoji_map.items():
        text = text.replace(emoji, replacement)
    # 移除其他无法编码的字符
    try:
        text.encode('gbk')
        return text
    except UnicodeEncodeError:
        result = []
        for ch in text:
            try:
                ch.encode('gbk')
                result.append(ch)
            except UnicodeEncodeError:
                result.append('?')
        return ''.join(result)


def load_kernel():
    """
    自动加载 Friday Kernel 所有组件 + OS Layer
    """
    print("========================================")
    print("  Friday Kernel Smart Loading v2.0")
    print("  with OS Layer (System Monitor)")
    print("========================================")
    print("")
    
    kernel_root = str(Path(__file__).resolve().parent.parent)
    opencode_dir = str(Path(kernel_root).parent / ".opencode")
    modules_dir = os.path.join(kernel_root, "modules")
    
    # 1. 加载核心记忆
    print("[1/5] Loading core memory...", end="")
    memory_file = os.path.join(kernel_root, "memory", "friday_memory.md")
    if os.path.exists(memory_file):
        try:
            with open(memory_file, 'r', encoding='utf-8') as f:
                memory_content = f.read()
            print(" OK")
        except Exception as e:
            print(f" ERROR: {e}")
    else:
        print(" NOT FOUND")
    
    # 2. 检索已安装技能（三目录）
    print("[2/5] Scanning installed skills...")
    skill_dirs = {
        "系统技能 (opencode)": os.path.join(opencode_dir, "skills"),
        "用户技能 (.agents)": os.path.join(os.environ.get("USERPROFILE", "C:/Users/31822"), ".agents", "skills"),
        "自定义技能 (AITest)": os.path.join(kernel_root, "..", "skills"),
    }
    total_skills = 0
    for label, sdir in skill_dirs.items():
        sdir = os.path.abspath(sdir)
        if os.path.exists(sdir):
            try:
                count = len([d for d in os.listdir(sdir) if os.path.isdir(os.path.join(sdir, d))])
                print(f"   {label}: {count} skills ({sdir})")
                total_skills += count
            except Exception as e:
                print(f"   {label}: ERROR - {e}")
        else:
            print(f"   {label}: NOT FOUND ({sdir})")
    print(f"   → 总计: {total_skills} skills")
    
    # 3. 加载 OS Layer 系统监控
    print("[3/5] Loading OS Layer (System Monitor)...", end="")
    os_layer = os.path.join(modules_dir, "os_layer.py")
    filesystem_knowledge = os.path.join(modules_dir, "filesystem_knowledge.py")
    system_monitor = os.path.join(modules_dir, "system_monitor.py")
    loaded = 0
    if os.path.exists(os_layer):
        loaded += 1
    if os.path.exists(filesystem_knowledge):
        loaded += 1
    if os.path.exists(system_monitor):
        loaded += 1
    print(f" OK ({loaded}/3 modules loaded)")
    
    # 4. 加载决策配置
    print("[4/5] Loading decision config...", end="")
    thinking_file = os.path.join(opencode_dir, "THINKING.md")
    realtime_file = os.path.join(opencode_dir, "realtime_data.md")
    loaded_count = 0
    if os.path.exists(thinking_file):
        loaded_count += 1
    if os.path.exists(realtime_file):
        loaded_count += 1
    print(f" OK ({loaded_count}/2 configs loaded)")
    
    # 5. 执行健康快检
    print("[5/5] Running system health quick check...", end="")
    try:
        sys.path.insert(0, modules_dir)
        sys.path.insert(0, os.path.join(modules_dir, "legacy"))
        sys.path.insert(0, os.path.join(modules_dir, "services"))
        from system_monitor import FridaySystemMonitor
        monitor = FridaySystemMonitor()
        health = monitor.health_check()
        
        # GBK-safe level icons (Windows console不能直接输出emoji)
        level_icon = {"green": "[OK]", "yellow": "[~]", "orange": "[!]", "red": "[!!]"}
        level = health.get("overall_level", "unknown")
        
        verdict = console_safe(health.get('verdict', 'N/A'))
        print(f" {level_icon.get(level, '[?]')} {verdict}")
        
        if health["warnings"]:
            print("")
            print("  [!] 启动告警:")
            for w in health["warnings"]:
                print(f"     {console_safe(w)}")
    except Exception as e:
        print(f" ERROR: {e}")
    
    # 6. [可选] 启动 Friday Web UI
    print("[6/6] Starting Friday Web UI...", end="")
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--web', action='store_true', help='启动 Friday Web UI')
    parser.add_argument('--web-port', type=int, default=5000, help='Web UI 端口')
    args, _ = parser.parse_known_args()

    if args.web:
        try:
            from core.event_bus import get_bus
            bus = get_bus()
            from entry.nuwa import FridayBridge
            bridge = FridayBridge(event_bus=bus)
            bridge.start_web_ui(event_bus=bus, port=args.web_port)
            bridge.start_dialog(event_bus=bus)
            # 启动感知系统 (从 kernel.json 或默认路径检测工作目录)
            kernel_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            perception = bridge.start_perception(event_bus=bus, workspace=kernel_root)
            if perception:
                ctx = bridge.get_perception_context()
                print(f" OK (http://127.0.0.1:{args.web_port})")
                print("   语音对话引擎已启动，等待唤醒词...")
                print("   感知系统已启动")
                print(f"   当前工作目录: {perception.workspace}")
                print(f"   活跃窗口: {perception.window.get_current().process_name}")
            else:
                print(f" OK (http://127.0.0.1:{args.web_port}) (感知系统未加载)")
        except Exception as e:
            print(f" FAILED: {e}")
    else:
        print(" 跳过（使用 --web 启动）")

    print("")
    print("========================================")
    print("  Friday Kernel + OS Layer 加载完成！")
    print("========================================")
    print("")
    print("  新指令:")
    print("  '系统健康' → 完整系统健康检查")
    print("  '系统监控' → 实时系统监控仪表盘")
    print("  '电脑状态' → 快速查看电脑状态")
    print("  '维护建议' → 获取系统维护推荐")
    print("")
    print("  Web UI: python scripts/load_kernel.py --web")
    print("")
    return True


def main():
    try:
        success = load_kernel()
        if success:
            print("Friday Kernel is READY!")
            # 如果启动了 Web UI，不退出让线程继续运行
            import argparse
            parser = argparse.ArgumentParser()
            parser.add_argument('--web', action='store_true')
            args, _ = parser.parse_known_args()
            if not args.web:
                sys.exit(0)
            # 否则保持进程运行
            import time
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print("\nShutting down...")
                sys.exit(0)
        else:
            print("Kernel loading FAILED")
            sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
