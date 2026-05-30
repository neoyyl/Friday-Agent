#!/usr/bin/env python3
"""
Friday OS Layer - 统一入口
===================================
Friday 系统级能力的启动脚本。

集成：
  - 系统监控（CPU/内存/磁盘/GPU/网络/进程）
  - 文件系统安全知识图谱
  - GPU 监控（显存/温度/利用率/功耗）🔥
  - 系统健康检查与报告
  - 主动维护建议

用法：
  python os_layer.py              → 完整系统健康检查
  python os_layer.py report       → 生成健康报告文件
  python os_layer.py monitor      → 实时监控模式
  python os_layer.py classify 路径 → 判断路径安全等级
"""

import sys
import os
import json
import datetime
from pathlib import Path

# 确保能找到模块
sys.path.insert(0, str(Path(__file__).parent.parent))


def cmd_health():
    """完整系统健康检查"""
    from system_monitor import FridaySystemMonitor

    monitor = FridaySystemMonitor()
    health = monitor.health_check()

    print("=" * 60)
    print("  Friday OS Layer — 系统健康检查")
    print("=" * 60)
    print(f"  主机: {monitor.system_info['hostname']}")
    print(f"  系统: {monitor.system_info['os']} {monitor.system_info['os_release']}")
    print(f"  CPU: {monitor.system_info['cpu_cores_physical']}核{monitor.system_info['cpu_cores_logical']}线程")
    print(f"  运行时间: {monitor.system_info['boot_time']}")
    print("-" * 60)
    print(f"  🖥️  {health['cpu'].get('summary', 'N/A')}")
    print(f"  🧠  {health['memory'].get('summary', 'N/A')}")
    print(f"  💾  {health['disk'].get('summary', 'N/A')}")
    print(f"  🎮  {health.get('gpu', {}).get('summary', '未检测到NVIDIA GPU')}")
    print(f"  🌐  {health['network'].get('summary', 'N/A')}")
    if health["suspicious_processes"]:
        print(f"  🚨  可疑进程: {len(health['suspicious_processes'])} 个")
    if health["warnings"]:
        print("  ⚠️  告警:")
        for w in health["warnings"]:
            print(f"       {w}")
    print("=" * 60)

    return health


def cmd_report():
    """生成健康报告文件"""
    from system_monitor import FridaySystemMonitor

    monitor = FridaySystemMonitor()
    health = monitor.health_check()
    report_md = monitor.generate_markdown_report(health)

    reports_dir = Path(__file__).parent.parent / "reports"
    reports_dir.mkdir(exist_ok=True)
    filename = f"health_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.md"
    report_path = reports_dir / filename
    report_path.write_text(report_md, encoding="utf-8")

    print(f"✅ 系统健康报告已保存: {report_path}")
    return str(report_path)


def cmd_monitor():
    """实时监控模式（持续输出）"""
    import time
    from system_monitor import FridaySystemMonitor

    monitor = FridaySystemMonitor()

    print(f"📊 Friday 实时监控 — 按 Ctrl+C 退出")
    print(f"{'时间':<20} {'CPU%':<8} {'内存%':<8} {'C盘%':<8} {'E盘%':<8} {'网络连接':<10}")
    print("-" * 70)

    try:
        while True:
            cpu = monitor.get_cpu_status()
            mem = monitor.get_memory_status()
            disk = monitor.get_disk_status()
            net = monitor.get_network_status()

            c_disk = next(
                (p for p in disk.get("partitions", []) if p.get("mountpoint") == "C:\\"),
                {"percent": "N/A"},
            )
            e_disk = next(
                (p for p in disk.get("partitions", []) if p.get("mountpoint") == "E:\\"),
                {"percent": "N/A"},
            )

            now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(
                f"{now:<20} "
                f"{cpu.get('overall_percent', 'N/A'):<8} "
                f"{mem.get('virtual', {}).get('percent', 'N/A'):<8} "
                f"{c_disk.get('percent', 'N/A'):<8} "
                f"{e_disk.get('percent', 'N/A'):<8} "
                f"{net.get('total_connections', 'N/A'):<10}"
            )
            time.sleep(5)
    except KeyboardInterrupt:
        print("\n监控已停止")


def cmd_classify(path):
    """判断文件路径的安全等级"""
    from filesystem_knowledge import FileSystemKnowledge

    fs = FileSystemKnowledge()
    level, desc = fs.classify_path(path)

    icons = {"safe": "🟢 SAFE", "cautious": "🟡 CAUTIOUS", "forbidden": "🔴 FORBIDDEN", "unknown": "❓ UNKNOWN"}
    print(f"{icons.get(level, '❓')} {path}")
    print(f"  → {desc}")

    return level


def cmd_maintenance():
    """获取维护建议"""
    from system_monitor import FridaySystemMonitor
    from filesystem_knowledge import FileSystemKnowledge

    monitor = FridaySystemMonitor()
    fs = FileSystemKnowledge()

    # 获取磁盘使用情况
    disk = monitor.get_disk_status()
    usages = {}
    for p in disk.get("partitions", []):
        if "percent" in p:
            usages[p["mountpoint"]] = p["percent"]

    tasks = fs.get_maintenance_tasks(usages)

    print(f"🔧 Friday 推荐维护任务 ({len(tasks)} 项)")
    print("-" * 60)
    for t in tasks:
        risk_icon = {"低": "🟢", "中": "🟡", "高": "🔴", "信息": "ℹ️"}
        print(f"  {risk_icon.get(t.get('risk', '中'), '❓')} {t['name']}")
        print(f"    {t.get('description', '')}")
    print("-" * 60)

    return tasks


def cmd_system_info():
    """显示系统信息摘要"""
    from system_monitor import FridaySystemMonitor

    monitor = FridaySystemMonitor()
    info = monitor.system_info
    health = monitor.health_check()

    print("=" * 60)
    print(f"  🖥️  Friday OS Layer - 系统信息")
    print("=" * 60)
    print(f"  主机名:     {info['hostname']}")
    print(f"  操作系统:   {info['os']} {info['os_release']}")
    print(f"  版本:       {info['os_version']}")
    print(f"  架构:       {info['architecture']}")
    print(f"  处理器:     {info['processor']}")
    print(f"  CPU核心:    {info['cpu_cores_physical']}物理 / {info['cpu_cores_logical']}逻辑")
    print(f"  运行时间:   {info['boot_time']}")
    print(f"  综合状态:   {health['overall_level']} — {health['verdict']}")
    print("=" * 60)


def cmd_gpu():
    """GPU 状态查询"""
    from gpu_monitor import GPUMonitor
    monitor = GPUMonitor()
    if not monitor.available:
        print("🎮 GPU: nvidia-smi 不可用")
        return
    monitor.print_status()


def main():
    if len(sys.argv) == 1:
        cmd_health()
    elif sys.argv[1] == "report":
        cmd_report()
    elif sys.argv[1] == "monitor":
        cmd_monitor()
    elif sys.argv[1] == "gpu":
        cmd_gpu()
    elif sys.argv[1] == "classify" and len(sys.argv) > 2:
        cmd_classify(sys.argv[2])
    elif sys.argv[1] == "maintenance":
        cmd_maintenance()
    elif sys.argv[1] == "info":
        cmd_system_info()
    elif sys.argv[1] == "all":
        # 全部执行
        print("#" * 60)
        print("#  Friday OS Layer — 全面检查")
        print("#" * 60)
        print()
        cmd_system_info()
        print()
        cmd_health()
        print()
        cmd_maintenance()
        print()
        report_path = cmd_report()
        print(f"\n📄 完整报告: {report_path}")
    else:
        print("用法:")
        print("  python os_layer.py              → 系统健康检查")
        print("  python os_layer.py report       → 生成健康报告")
        print("  python os_layer.py monitor      → 实时监控（每5秒刷新）")
        print("  python os_layer.py gpu          → GPU 状态查询")
        print("  python os_layer.py classify 路径 → 判断路径安全等级")
        print("  python os_layer.py maintenance  → 获取维护建议")
        print("  python os_layer.py info         → 系统信息")
        print("  python os_layer.py all          → 全部执行")


if __name__ == "__main__":
    main()
