#!/usr/bin/env python3
"""
Friday OS Layer - GPU 监控模块
================================
通过 nvidia-smi 监控 NVIDIA GPU 状态。

能力：
  - GPU 基本信息（型号/驱动/显存总量）
  - 实时状态（利用率/温度/功耗/时钟频率）
  - 显存使用（总量/已用/进程占用）
  - GPU 进程列表（哪个程序在吃显存）
  - 综合健康评估

作者：Friday Kernel
版本：0.1.0
"""

import subprocess
import json
import re
import datetime


class GPUMonitor:
    """
    NVIDIA GPU 监控器
    基于 nvidia-smi，无需额外依赖。
    """

    def __init__(self):
        self.available = self._check_available()
        if self.available:
            self.gpu_count = self._get_gpu_count()
            self.gpu_info = self._get_gpu_info()
        else:
            self.gpu_count = 0
            self.gpu_info = []

    def _check_available(self):
        """检查 nvidia-smi 是否可用"""
        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                capture_output=True, text=True, timeout=5
            )
            return result.returncode == 0 and "NVIDIA" in result.stdout
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def _run_query(self, query, suffix=""):
        """执行 nvidia-smi 查询"""
        try:
            cmd = ["nvidia-smi", f"--query-gpu={query}", "--format=csv,noheader,nounits"]
            if suffix:
                cmd.append(suffix)
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]
            return []
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return []

    def _get_gpu_count(self):
        """获取 GPU 数量"""
        names = self._run_query("index")
        return len(names)

    def _get_gpu_info(self):
        """获取所有 GPU 的基本信息"""
        if not self.available:
            return []

        names = self._run_query("name")
        drivers = self._run_query("driver_version")
        serials = self._run_query("serial")

        info = []
        for i in range(self.gpu_count):
            info.append({
                "index": i,
                "name": names[i] if i < len(names) else "Unknown",
                "driver": drivers[i] if i < len(drivers) else "Unknown",
                "serial": serials[i] if i < len(serials) else "N/A",
            })
        return info

    # ==================== 实时状态 ====================

    def get_gpu_status(self):
        """获取所有 GPU 的全面状态"""
        if not self.available:
            return {"available": False, "error": "nvidia-smi 不可用，未检测到 NVIDIA GPU"}

        gpus = []
        for i in range(self.gpu_count):
            gpu = self._query_single_gpu(i)
            if gpu:
                gpus.append(gpu)

        # 综合评估
        total_vram = sum(g.get("memory", {}).get("total_mb", 0) for g in gpus)
        used_vram = sum(g.get("memory", {}).get("used_mb", 0) for g in gpus)
        avg_temp = sum(g.get("temperature", 0) for g in gpus) / max(len(gpus), 1)
        max_util = max((g.get("utilization", 0) for g in gpus), default=0)

        # 告警判断
        warnings = []
        if avg_temp > 80:
            warnings.append(f"⚠ GPU 温度过高 ({avg_temp:.0f}°C)")
        if used_vram / max(total_vram, 1) > 0.9:
            warnings.append(f"⚠ 显存不足 ({used_vram}/{total_vram} MB)")
        if max_util > 95:
            warnings.append(f"⚠ GPU 利用率接近满载 ({max_util}%)")

        if avg_temp > 75:
            level = "orange"
            summary = f"GPU 温度 {avg_temp:.0f}°C，偏高"
        elif max_util > 80:
            level = "yellow"
            summary = f"GPU 利用率 {max_util}%，较高负载"
        else:
            level = "green"
            summary = f"GPU 正常 · 温度 {avg_temp:.0f}°C · 利用率 {max_util}%"

        if used_vram / max(total_vram, 1) > 0.85:
            level = "orange" if level == "green" else level

        return {
            "available": True,
            "gpu_count": self.gpu_count,
            "gpus": gpus,
            "summary": summary,
            "level": level,
            "warnings": warnings,
            "total_vram_mb": total_vram,
            "used_vram_mb": used_vram,
            "vram_percent": round(used_vram / max(total_vram, 1) * 100, 1),
        }

    def _query_single_gpu(self, index):
        """查询单个 GPU 的详细状态"""
        try:
            # 批量查询
            raw = subprocess.run(
                [
                    "nvidia-smi",
                    f"--id={index}",
                    "--query-gpu=index,name,temperature.gpu,utilization.gpu,utilization.memory,memory.total,memory.used,memory.free,power.draw,clocks.current.graphics,clocks.current.memory,clocks.current.video,clocks_throttle_reasons.active,pstate",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True, text=True, timeout=5
            )
            if raw.returncode != 0:
                return None

            parts = [p.strip() for p in raw.stdout.strip().split(", ")]

            if len(parts) >= 14:
                return {
                    "index": int(parts[0]) if parts[0].isdigit() else 0,
                    "name": parts[1],
                    "temperature": int(parts[2]) if parts[2].isdigit() else 0,
                    "utilization": int(parts[3].replace("%", "")) if "%" in parts[3] else int(float(parts[3])) if parts[3] else 0,
                    "memory_util": int(parts[4].replace("%", "")) if "%" in parts[4] else int(float(parts[4])) if parts[4] else 0,
                    "memory": {
                        "total_mb": self._parse_mb(parts[5]),
                        "used_mb": self._parse_mb(parts[6]),
                        "free_mb": self._parse_mb(parts[7]),
                    },
                    "power_w": float(parts[8]) if parts[8] and parts[8] != "[N/A]" else 0,
                    "clocks": {
                        "graphics_mhz": int(float(parts[9])) if parts[9] and parts[9] != "[N/A]" else 0,
                        "memory_mhz": int(float(parts[10])) if parts[10] and parts[10] != "[N/A]" else 0,
                        "video_mhz": int(float(parts[11])) if parts[11] and parts[11] != "[N/A]" else 0,
                    },
                    "throttle_reasons": parts[12] if len(parts) > 12 else "",
                    "pstate": parts[13] if len(parts) > 13 else "",
                }
        except Exception:
            pass

        # 备选：逐项查询
        return self._query_single_gpu_fallback(index)

    def _query_single_gpu_fallback(self, index):
        """逐项查询的备选方案"""
        try:
            def q(field):
                r = subprocess.run(
                    ["nvidia-smi", f"--id={index}", f"--query-gpu={field}", "--format=csv,noheader,nounits"],
                    capture_output=True, text=True, timeout=3
                )
                return r.stdout.strip() if r.returncode == 0 else "N/A"

            temp = q("temperature.gpu")
            util = q("utilization.gpu")
            mem_total = q("memory.total")
            mem_used = q("memory.used")
            mem_free = q("memory.free")
            power = q("power.draw")
            gpu_clock = q("clocks.current.graphics")
            mem_clock = q("clocks.current.memory")
            name = q("name")

            return {
                "index": index,
                "name": name,
                "temperature": int(temp) if temp.isdigit() else 0,
                "utilization": int(util.replace("%", "")) if "%" in util else (int(float(util)) if util.replace(".", "").isdigit() else 0),
                "memory_util": 0,
                "memory": {
                    "total_mb": self._parse_mb(mem_total),
                    "used_mb": self._parse_mb(mem_used),
                    "free_mb": self._parse_mb(mem_free),
                },
                "power_w": float(power) if power and power != "[N/A]" else 0,
                "clocks": {
                    "graphics_mhz": int(float(gpu_clock)) if gpu_clock and gpu_clock != "[N/A]" else 0,
                    "memory_mhz": int(float(mem_clock)) if mem_clock and mem_clock != "[N/A]" else 0,
                    "video_mhz": 0,
                },
                "throttle_reasons": "",
                "pstate": "",
            }
        except Exception:
            return None

    def _parse_mb(self, value):
        """解析显存值到 MB"""
        if not value or value == "[N/A]" or value == "N/A":
            return 0
        value = value.strip().upper()
        if "MIB" in value:
            return int(float(value.replace("MIB", "").strip()))
        elif "GIB" in value:
            return int(float(value.replace("GIB", "").strip()) * 1024)
        else:
            try:
                return int(float(value))
            except ValueError:
                return 0

    # ==================== GPU 进程查询 ====================

    def get_gpu_processes(self):
        """获取 GPU 占用进程列表"""
        if not self.available:
            return []

        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-compute-apps=pid,process_name,used_memory", "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode != 0:
                return []

            processes = []
            for line in result.stdout.strip().split("\n"):
                line = line.strip()
                if not line:
                    continue
                parts = [p.strip() for p in line.split(", ")]
                if len(parts) >= 2:
                    pid = parts[0]
                    name = parts[1]
                    mem = parts[2] if len(parts) > 2 and parts[2] != "[N/A]" else "0"
                    try:
                        mem_mb = int(mem.replace("MiB", "").strip()) if "MiB" in mem else (int(float(mem)) if mem else 0)
                    except ValueError:
                        mem_mb = 0
                    processes.append({
                        "pid": pid,
                        "name": os.path.basename(name) if "\\" in name else name,
                        "full_path": name,
                        "used_memory_mb": mem_mb,
                    })

            # 按显存占用排序
            processes.sort(key=lambda p: p["used_memory_mb"], reverse=True)
            return processes
        except Exception as e:
            return []

    # ==================== 功耗与供电 ====================

    def get_power_status(self):
        """获取 GPU 供电状态"""
        if not self.available:
            return {"available": False}

        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=index,name,power.draw,power.limit,enforced.power.limit,power.management", "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode != 0:
                return {"available": False}

            gpus = []
            for line in result.stdout.strip().split("\n"):
                parts = [p.strip() for p in line.split(", ")]
                if len(parts) >= 4:
                    gpus.append({
                        "index": int(parts[0]) if parts[0].isdigit() else 0,
                        "name": parts[1],
                        "current_w": float(parts[2]) if parts[2] and parts[2] != "[N/A]" else 0,
                        "limit_w": float(parts[3]) if parts[3] and parts[3] != "[N/A]" else 0,
                        "enforced_limit_w": float(parts[4]) if parts[4] and parts[4] != "[N/A]" else 0,
                        "power_management": parts[5] if len(parts) > 5 else "N/A",
                    })

            return {"available": True, "gpus": gpus}
        except Exception:
            return {"available": False}

    # ==================== 报告生成 ====================

    def generate_gpu_section(self, status=None):
        """生成 GPU 状态 Markdown 片段"""
        if status is None:
            status = self.get_gpu_status()

        if not status.get("available"):
            return "### 🎮 GPU\n- 未检测到 NVIDIA GPU\n"

        level_icon = {"green": "🟢", "yellow": "🟡", "orange": "🟠", "red": "🔴"}

        lines = []
        lines.append(f"### {level_icon.get(status['level'], '❓')} GPU 状态")
        lines.append(f"- {status['summary']}")
        lines.append(f"- 总显存: {status['total_vram_mb']} MB | 已用: **{status['used_vram_mb']} MB ({status['vram_percent']}%)**")

        for gpu in status.get("gpus", []):
            g = gpu
            lines.append(f"")
            lines.append(f"  **{g['name']}**")
            lines.append(f"  - 温度: {g['temperature']}°C | 利用率: {g['utilization']}% | 功耗: {g['power_w']}W")
            lines.append(f"  - 显存: {g['memory']['used_mb']} / {g['memory']['total_mb']} MB")
            lines.append(f"  - 频率: GPU {g['clocks']['graphics_mhz']} MHz / 显存 {g['clocks']['memory_mhz']} MHz")

        # 进程列表
        processes = self.get_gpu_processes()
        if processes:
            lines.append(f"")
            lines.append(f"  **GPU 进程 (前5):**")
            for p in processes[:5]:
                mem_str = f"{p['used_memory_mb']} MB" if p['used_memory_mb'] > 0 else "N/A"
                lines.append(f"  - [{p['pid']}] {p['name']}: {mem_str}")

        if status.get("warnings"):
            lines.append(f"")
            for w in status["warnings"]:
                lines.append(f"  {w}")

        return "\n".join(lines)

    def print_status(self):
        """打印 GPU 状态到控制台"""
        if not self.available:
            print("  🎮 GPU: nvidia-smi 不可用")
            return

        status = self.get_gpu_status()
        level_icon = {"green": "🟢", "yellow": "🟡", "orange": "🟠", "red": "🔴"}

        for gpu in status["gpus"]:
            g = gpu
            vram_pct = round(g["memory"]["used_mb"] / max(g["memory"]["total_mb"], 1) * 100, 1)
            print(f"  🎮 {g['name']}")
            print(f"     温度: {g['temperature']}°C · 利用率: {g['utilization']}% · 功耗: {g['power_w']}W")
            bar = "█" * int(vram_pct / 10) + "░" * (10 - int(vram_pct / 10))
            print(f"     显存: {bar} {vram_pct}% ({g['memory']['used_mb']}/{g['memory']['total_mb']} MB)")
            print(f"     频率: GPU {g['clocks']['graphics_mhz']} MHz / 显存 {g['clocks']['memory_mhz']} MHz")

        processes = self.get_gpu_processes()
        if processes:
            print(f"     进程: {len(processes)} 个")
            for p in processes[:3]:
                mem_str = f"{p['used_memory_mb']} MB" if p['used_memory_mb'] > 0 else "?"
                print(f"       [{p['pid']}] {p['name']}: {mem_str}")

        if status.get("warnings"):
            for w in status["warnings"]:
                print(f"      {w}")


# ==================== 独立运行 ====================

def main():
    import os as _os
    # 补丁：让 os 在局部可用
    global os
    os = _os

    monitor = GPUMonitor()

    print("=" * 60)
    print("  Friday OS Layer — GPU 监控")
    print("=" * 60)

    if not monitor.available:
        print("  ❌ nvidia-smi 不可用")
        print("  可能原因：未安装 NVIDIA 驱动或不支持")
    else:
        for gpu in monitor.gpu_info:
            print(f"  GPU #{gpu['index']}: {gpu['name']} | 驱动: {gpu['driver']}")

        print("")
        print("-" * 60)
        print("  实时状态:")
        monitor.print_status()

        print("")
        print("-" * 60)
        power = monitor.get_power_status()
        if power.get("available"):
            for pg in power["gpus"]:
                print(f"  供电: {pg['current_w']}W / {pg['limit_w']}W (限制)")
        print("=" * 60)

    # 生成报告
    status = monitor.get_gpu_status()
    if status.get("available"):
        report = monitor.generate_gpu_section(status)
        # 也可以保存到文件
        from pathlib import Path
        reports_dir = Path(__file__).parent.parent / "reports"
        reports_dir.mkdir(exist_ok=True)
        report_file = reports_dir / f"gpu_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.md"
        report_file.write_text(f"# 🎮 GPU 状态报告\n\n{report}\n\n*由 Friday OS Layer 自动生成*", encoding="utf-8")
        print(f"\n  报告已保存: {report_file}")


if __name__ == "__main__":
    main()
