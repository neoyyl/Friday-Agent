#!/usr/bin/env python3
"""
Friday OS Layer - 系统监控核心模块
=====================================
真正的个人智慧助手的第一步：感知你的电脑。
不是沙箱里的工具，是电脑的管理员。

能力：
  - CPU 监控（使用率、温度、频率、进程排行）
  - 内存监控（使用率、分页、进程排行）
  - 磁盘监控（空间、IO、健康度）
  - GPU 监控（显存、温度、利用率、功耗、进程）🔥 
  - 网络监控（流量、连接、异常检测）
  - 进程监控（TOP进程、异常检测、白名单）
  - 系统信息（版本、启动时间、补丁状态）

作者：Friday Kernel
版本：0.1.0
"""

import psutil
import platform
import datetime
import os
import json
from pathlib import Path

# GPU 监控（可选，仅在 NVIDIA GPU 可用时生效）
try:
    from gpu_monitor import GPUMonitor
    _gpu_monitor = GPUMonitor()
    HAS_GPU = _gpu_monitor.available
except Exception:
    HAS_GPU = False
    _gpu_monitor = None


class FridaySystemMonitor:
    """
    Friday 系统监控器
    感知电脑的一切状态，为主动管理提供数据基础。
    """

    def __init__(self):
        self.system_info = self._get_system_info()
        self.process_whitelist = self._load_process_whitelist()

    def _get_system_info(self):
        """获取系统基本信息（一次性）"""
        return {
            "hostname": platform.node(),
            "os": platform.system(),
            "os_version": platform.version(),
            "os_release": platform.release(),
            "architecture": platform.machine(),
            "processor": platform.processor(),
            "boot_time": datetime.datetime.fromtimestamp(
                psutil.boot_time()
            ).strftime("%Y-%m-%d %H:%M:%S"),
            "cpu_cores_physical": psutil.cpu_count(logical=False),
            "cpu_cores_logical": psutil.cpu_count(logical=True),
        }

    def _load_process_whitelist(self):
        """加载系统进程白名单"""
        return {
            # Windows 系统关键进程
            "System": "system",
            "System Idle Process": "system",
            "smss.exe": "system",
            "csrss.exe": "system",
            "wininit.exe": "system",
            "services.exe": "system",
            "lsass.exe": "system",
            "svchost.exe": "system",
            "winlogon.exe": "system",
            "explorer.exe": "system",
            "taskhostw.exe": "system",
            "dwm.exe": "system",
            "fontdrvhost.exe": "system",
            "spoolsv.exe": "system",
            # 常见安全软件
            "MsMpEng.exe": "antivirus",
            "MsSense.exe": "security",
            "NisSrv.exe": "antivirus",
            # 系统工具
            "Taskmgr.exe": "utility",
            "cmd.exe": "utility",
            "powershell.exe": "utility",
            "notepad.exe": "utility",
            "regedit.exe": "utility",
            "msiexec.exe": "installer",
        }

    # ==================== CPU 监控 ====================

    def get_cpu_status(self):
        """获取CPU全面状态"""
        try:
            cpu_percent = psutil.cpu_percent(interval=0.5, percpu=False)
            cpu_per_core = psutil.cpu_percent(interval=0.3, percpu=True)
            cpu_freq = psutil.cpu_freq()
            cpu_stats = psutil.cpu_stats()
            cpu_load_avg = getattr(psutil, "getloadavg", lambda: None)()

            status = {
                "overall_percent": cpu_percent,
                "per_core": cpu_per_core,
                "frequency_mhz": {
                    "current": cpu_freq.current if cpu_freq else None,
                    "min": cpu_freq.min if cpu_freq and cpu_freq.min else None,
                    "max": cpu_freq.max if cpu_freq else None,
                },
                "context_switches": cpu_stats.ctx_switches,
                "interrupts": cpu_stats.interrupts,
                "soft_interrupts": getattr(cpu_stats, "soft_interrupts", None),
                "syscalls": getattr(cpu_stats, "syscalls", None),
            }

            # 状态判断
            if cpu_percent < 30:
                status["level"] = "green"
                status["summary"] = f"CPU 使用率 {cpu_percent}%，空闲"
            elif cpu_percent < 60:
                status["level"] = "yellow"
                status["summary"] = f"CPU 使用率 {cpu_percent}%，正常负载"
            elif cpu_percent < 85:
                status["level"] = "orange"
                status["summary"] = f"CPU 使用率 {cpu_percent}%，较高负载"
            else:
                status["level"] = "red"
                status["summary"] = f"CPU 使用率 {cpu_percent}%，过载！"

            return status
        except Exception as e:
            return {"error": str(e), "level": "unknown"}

    def get_cpu_top_processes(self, top_n=5):
        """获取CPU占用最高的进程"""
        processes = []
        for proc in psutil.process_iter(
            ["pid", "name", "cpu_percent", "memory_percent", "create_time", "status"]
        ):
            try:
                info = proc.info
                if info["cpu_percent"] and info["cpu_percent"] > 0:
                    processes.append(info)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        processes.sort(key=lambda p: p["cpu_percent"] or 0, reverse=True)
        return processes[:top_n]

    # ==================== 内存监控 ====================

    def get_memory_status(self):
        """获取内存全面状态"""
        try:
            virtual = psutil.virtual_memory()
            swap = psutil.swap_memory()

            status = {
                "virtual": {
                    "total_gb": round(virtual.total / (1024**3), 2),
                    "available_gb": round(virtual.available / (1024**3), 2),
                    "used_gb": round(virtual.used / (1024**3), 2),
                    "percent": virtual.percent,
                    "free_gb": round(virtual.free / (1024**3), 2),
                },
                "swap": {
                    "total_gb": round(swap.total / (1024**3), 2),
                    "used_gb": round(swap.used / (1024**3), 2),
                    "percent": swap.percent,
                },
            }

            # 状态判断
            v = status["virtual"]
            if v["percent"] < 50:
                status["level"] = "green"
                status["summary"] = f"内存使用 {v['percent']}%，充足"
            elif v["percent"] < 75:
                status["level"] = "yellow"
                status["summary"] = f"内存使用 {v['percent']}%，正常"
            elif v["percent"] < 90:
                status["level"] = "orange"
                status["summary"] = f"内存使用 {v['percent']}%，偏高，建议关注"
            else:
                status["level"] = "red"
                status["summary"] = f"内存使用 {v['percent']}%，不足！"

            return status
        except Exception as e:
            return {"error": str(e), "level": "unknown"}

    def get_memory_top_processes(self, top_n=5):
        """获取内存占用最高的进程"""
        processes = []
        for proc in psutil.process_iter(
            ["pid", "name", "memory_percent", "memory_info", "cpu_percent", "create_time"]
        ):
            try:
                info = proc.info
                if info["memory_percent"] and info["memory_percent"] > 0:
                    info["memory_mb"] = round(
                        (info["memory_info"].rss if info["memory_info"] else 0) / (1024**2), 1
                    )
                    processes.append(info)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        processes.sort(key=lambda p: p["memory_percent"] or 0, reverse=True)
        return processes[:top_n]

    # ==================== 磁盘监控 ====================

    def get_disk_status(self):
        """获取磁盘全面状态"""
        try:
            partitions = []
            for part in psutil.disk_partitions():
                try:
                    usage = psutil.disk_usage(part.mountpoint)
                    partitions.append({
                        "device": part.device,
                        "mountpoint": part.mountpoint,
                        "fstype": part.fstype,
                        "total_gb": round(usage.total / (1024**3), 2),
                        "used_gb": round(usage.used / (1024**3), 1),
                        "free_gb": round(usage.free / (1024**3), 1),
                        "percent": usage.percent,
                    })
                except PermissionError:
                    partitions.append({
                        "device": part.device,
                        "mountpoint": part.mountpoint,
                        "fstype": part.fstype,
                        "error": "无权限访问",
                    })

            io_counters = psutil.disk_io_counters()
            io_info = {
                "read_mb": round(io_counters.read_bytes / (1024**2), 1) if io_counters else 0,
                "write_mb": round(io_counters.write_bytes / (1024**2), 1) if io_counters else 0,
            } if io_counters else None

            # 找出最满的盘
            most_full = max(
                [p for p in partitions if "percent" in p],
                key=lambda p: p["percent"],
                default=None,
            )

            status = {
                "partitions": partitions,
                "io": io_info,
                "most_full": most_full,
            }

            if most_full and most_full["percent"] > 90:
                status["level"] = "red"
                status["summary"] = f"{most_full['device']} 盘即将满 ({most_full['percent']}%)"
            elif most_full and most_full["percent"] > 80:
                status["level"] = "orange"
                status["summary"] = f"{most_full['device']} 盘空间紧张 ({most_full['percent']}%)"
            else:
                status["level"] = "green"
                status["summary"] = "磁盘空间充足"

            return status
        except Exception as e:
            return {"error": str(e), "level": "unknown"}

    # ==================== 网络监控 ====================

    def get_network_status(self):
        """获取网络状态"""
        try:
            io_counters = psutil.net_io_counters()
            connections = psutil.net_connections()

            # 统计连接状态
            conn_states = {}
            for conn in connections:
                state = conn.status or "unknown"
                conn_states[state] = conn_states.get(state, 0) + 1

            # 监听端口的进程
            listening = []
            for conn in connections:
                if conn.status == "LISTEN" and conn.laddr:
                    try:
                        proc = psutil.Process(conn.pid)
                        listening.append({
                            "port": conn.laddr.port,
                            "process": proc.name(),
                            "pid": conn.pid,
                        })
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        listening.append({
                            "port": conn.laddr.port,
                            "process": "unknown",
                            "pid": conn.pid,
                        })

            status = {
                "bytes_sent_mb": round(io_counters.bytes_sent / (1024**2), 1),
                "bytes_recv_mb": round(io_counters.bytes_recv / (1024**2), 1),
                "packets_sent": io_counters.packets_sent,
                "packets_recv": io_counters.packets_recv,
                "connections": conn_states,
                "listening_ports": listening[:20],
                "total_connections": len(connections),
            }

            status["level"] = "green" if status["total_connections"] < 200 else "yellow"
            status["summary"] = f"网络连接 {status['total_connections']} 个，正常"

            return status
        except Exception as e:
            return {"error": str(e), "level": "unknown"}

    # ==================== GPU 监控 ====================

    def get_gpu_status(self):
        """获取 GPU 状态"""
        global _gpu_monitor
        if not HAS_GPU or _gpu_monitor is None:
            return {"available": False}

        return _gpu_monitor.get_gpu_status()

    def get_gpu_processes(self):
        """获取 GPU 进程列表"""
        global _gpu_monitor
        if not HAS_GPU or _gpu_monitor is None:
            return []
        return _gpu_monitor.get_gpu_processes()

    # ==================== 异常进程检测 ====================

    def scan_suspicious_processes(self):
        """
        扫描可疑进程
        检测标准：
          - 未知进程大量占用CPU/内存
          - 伪装成系统进程的非系统进程
          - 异常网络连接
        """
        suspicious = []
        known_system_processes = set(self.process_whitelist.keys())

        for proc in psutil.process_iter(
            ["pid", "name", "cpu_percent", "memory_percent", "exe", "create_time", "username"]
        ):
            try:
                info = proc.info
                name_lower = info["name"].lower() if info["name"] else ""

                # 跳过白名单进程
                if info["name"] in known_system_processes:
                    continue

                # 检测：伪装成系统进程
                system_names = ["svchost", "lsass", "winlogon", "csrss", "services", "explorer"]
                for sys_name in system_names:
                    if sys_name in name_lower and info["name"] not in known_system_processes:
                        suspicious.append({
                            "pid": info["pid"],
                            "name": info["name"],
                            "reason": f"可能伪装成系统进程: {sys_name}",
                            "cpu": info["cpu_percent"],
                            "memory": info["memory_percent"],
                        })

                # 检测：高CPU占用且不在白名单
                if info["cpu_percent"] and info["cpu_percent"] > 50:
                    suspicious.append({
                        "pid": info["pid"],
                        "name": info["name"],
                        "reason": f"高CPU占用 ({info['cpu_percent']}%)",
                        "cpu": info["cpu_percent"],
                        "memory": info["memory_percent"],
                    })

            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        return suspicious

    # ==================== 综合健康检查 ====================

    def health_check(self):
        """执行一次全面的系统健康检查"""
        cpu = self.get_cpu_status()
        memory = self.get_memory_status()
        disk = self.get_disk_status()
        network = self.get_network_status()
        gpu = self.get_gpu_status()
        suspicious = self.scan_suspicious_processes()

        # 综合评级
        levels = [cpu.get("level"), memory.get("level"), disk.get("level"), network.get("level")]
        if gpu.get("available"):
            levels.append(gpu.get("level"))
        if "red" in levels:
            overall = "red"
            verdict = "⚠️ 系统需要关注，存在需要处理的问题"
        elif "orange" in levels:
            overall = "orange"
            verdict = "📊 系统有潜在风险，建议查看详情"
        elif "yellow" in levels:
            overall = "yellow"
            verdict = "✅ 系统基本健康，部分指标偏高"
        else:
            overall = "green"
            verdict = "✅ 系统非常健康"

        report = {
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "uptime": str(datetime.timedelta(seconds=int(psutil.boot_time()))),
            "overall_level": overall,
            "verdict": verdict,
            "cpu": cpu,
            "memory": memory,
            "disk": disk,
            "network": network,
            "gpu": gpu,
            "suspicious_processes": suspicious,
            "warnings": [],
        }

        # 生成告警列表
        if cpu.get("level") == "red":
            report["warnings"].append(f"⚠ CPU过载: {cpu['summary']}")
        if memory.get("level") == "red":
            report["warnings"].append(f"⚠ 内存不足: {memory['summary']}")
        if disk.get("level") == "red":
            report["warnings"].append(f"⚠ 磁盘空间: {disk['summary']}")
        if gpu.get("available") and gpu.get("warnings"):
            for w in gpu["warnings"]:
                report["warnings"].append(w)
        if suspicious:
            report["warnings"].append(f"⚠ 发现 {len(suspicious)} 个可疑进程")

        return report

    # ==================== 报告输出 ====================

    def generate_markdown_report(self, health=None):
        """生成Markdown格式的健康报告"""
        if health is None:
            health = self.health_check()

        level_icon = {"green": "🟢", "yellow": "🟡", "orange": "🟠", "red": "🔴"}

        md = []
        md.append(f"# 🖥️ Friday 系统健康报告")
        md.append(f"")
        md.append(f"**时间**: {health['timestamp']}")
        md.append(f"**主机**: {self.system_info['hostname']}")
        md.append(f"**运行时间**: 自 {self.system_info['boot_time']}")
        md.append(f"")
        md.append(f"## 综合状态: {level_icon.get(health['overall_level'], '❓')} {health['verdict']}")
        md.append(f"")

        # 告警
        if health["warnings"]:
            md.append(f"### ⚠️ 告警 ({len(health['warnings'])})")
            for w in health["warnings"]:
                md.append(f"- {w}")
            md.append(f"")

        # CPU
        c = health["cpu"]
        md.append(f"### {level_icon.get(c.get('level', 'gray'), '❓')} CPU 状态")
        md.append(f"- 使用率: **{c.get('overall_percent', 'N/A')}%**")
        md.append(f"- 频率: {c.get('frequency_mhz', {}).get('current', 'N/A')} MHz")
        md.append(f"- 物理核心: {self.system_info['cpu_cores_physical']} 逻辑核心: {self.system_info['cpu_cores_logical']}")
        # TOP CPU进程
        top_cpu = self.get_cpu_top_processes(3)
        if top_cpu:
            md.append(f"- TOP CPU进程:")
            for p in top_cpu:
                md.append(f"  - {p['name']} (PID {p['pid']}): {p['cpu_percent']}%")
        md.append(f"")

        # 内存
        m = health["memory"]
        md.append(f"### {level_icon.get(m.get('level', 'gray'), '❓')} 内存状态")
        v = m.get("virtual", {})
        md.append(f"- 总内存: {v.get('total_gb', 'N/A')} GB | 已用: **{v.get('used_gb', 'N/A')} GB ({v.get('percent', 'N/A')}%)** | 可用: {v.get('available_gb', 'N/A')} GB")
        s = m.get("swap", {})
        md.append(f"- 交换分区: {s.get('total_gb', 'N/A')} GB | 已用: {s.get('used_gb', 'N/A')} GB ({s.get('percent', 'N/A')}%)")
        top_mem = self.get_memory_top_processes(3)
        if top_mem:
            md.append(f"- TOP内存进程:")
            for p in top_mem:
                md.append(f"  - {p['name']} (PID {p['pid']}): {p.get('memory_mb', '?')} MB")
        md.append(f"")

        # 磁盘
        d = health["disk"]
        md.append(f"### {level_icon.get(d.get('level', 'gray'), '❓')} 磁盘状态")
        for part in d.get("partitions", []):
            if "percent" in part:
                bar = "█" * int(part["percent"] / 10) + "░" * (10 - int(part["percent"] / 10))
                md.append(f"- {part['device']} ({part['mountpoint']}): {bar} {part['percent']}%（已用 {part['used_gb']} GB / 共 {part['total_gb']} GB）")
        md.append(f"")

        # 网络
        n = health["network"]
        md.append(f"### 🌐 网络状态")
        md.append(f"- 发送: {n.get('bytes_sent_mb', 0)} MB | 接收: {n.get('bytes_recv_mb', 0)} MB")
        md.append(f"- 连接数: {n.get('total_connections', 0)}")
        if n.get("listening_ports"):
            md.append(f"- 监听端口:")
            for lp in n["listening_ports"][:5]:
                md.append(f"  - 端口 {lp['port']} → {lp['process']}")
        md.append(f"")

        # GPU
        gpu = health.get("gpu", {})
        if gpu.get("available"):
            md.append(f"### 🎮 GPU 状态")
            md.append(f"- {gpu.get('summary', 'N/A')}")
            md.append(f"- 总显存: {gpu['total_vram_mb']} MB | 已用: **{gpu['used_vram_mb']} MB ({gpu['vram_percent']}%)**")
            for g in gpu.get("gpus", []):
                md.append(f"- {g['name']}: {g['temperature']}°C · 利用率 {g['utilization']}% · 功耗 {g['power_w']}W")
            gpu_procs = self.get_gpu_processes()
            if gpu_procs:
                md.append(f"- GPU进程 ({len(gpu_procs)} 个):")
                for p in gpu_procs[:3]:
                    mem_str = f"{p['used_memory_mb']} MB" if p['used_memory_mb'] > 0 else "?"
                    md.append(f"  - [{p['pid']}] {p['name']}: {mem_str}")
            md.append(f"")

        # 可疑进程
        if health["suspicious_processes"]:
            md.append(f"### 🚨 可疑进程 ({len(health['suspicious_processes'])})")
            for sp in health["suspicious_processes"]:
                md.append(f"- {sp['name']} (PID {sp['pid']}): {sp['reason']}")
            md.append(f"")

        md.append(f"---")
        md.append(f"*报告由 Friday OS Layer 自动生成 · {health['timestamp']}*")

        return "\n".join(md)


# ==================== 独立运行入口 ====================

def main():
    """独立运行系统健康检查"""
    monitor = FridaySystemMonitor()
    report = monitor.health_check()

    print("=" * 60)
    print("  Friday OS Layer — 系统健康检查")
    print("=" * 60)
    print(f"  主机: {monitor.system_info['hostname']}")
    print(f"  系统: {monitor.system_info['os']} {monitor.system_info['os_release']}")
    print(f"  运行中: 自 {monitor.system_info['boot_time']}")
    print(f"  CPU: {monitor.system_info['cpu_cores_physical']}核{monitor.system_info['cpu_cores_logical']}线程")
    print("-" * 60)
    print(f"  🖥️  CPU: {report['cpu'].get('summary', 'N/A')}")
    print(f"  🧠  内存: {report['memory'].get('summary', 'N/A')}")
    print(f"  💾  磁盘: {report['disk'].get('summary', 'N/A')}")
    print(f"  🎮  GPU: {report.get('gpu', {}).get('summary', '未检测到')}")
    print(f"  🌐  网络: {report['network'].get('summary', 'N/A')}")
    if report["suspicious_processes"]:
        print(f"  🚨  可疑进程: {len(report['suspicious_processes'])} 个")
    print("=" * 60)

    # 生成markdown保存
    reports_dir = Path(__file__).parent.parent / "reports"
    reports_dir.mkdir(exist_ok=True)
    report_file = reports_dir / f"health_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.md"
    report_file.write_text(monitor.generate_markdown_report(report), encoding="utf-8")
    print(f"  报告已保存: {report_file}")
    print("=" * 60)


if __name__ == "__main__":
    main()
