#!/usr/bin/env python3
"""
Friday Awake — 屏幕右下角脉冲圆形叠加层
==========================================
当你说"星期五"，屏幕右下角会出现一个脉冲波动的圆形，
表示 Friday 正在聆听。

状态：
  - idle:    待机状态（半透明小点）
  - listening: 正在听你说话（脉冲动画）
  - thinking:  正在思考/处理（旋转光晕）
  - speaking:  正在回复你（声波动画）

作者：Friday Kernel
版本：0.1.0
"""

import tkinter as tk
import math
import time
import threading


class FridayOverlay:
    """
    屏幕右下角脉冲圆形叠加层
    
    透明、点击穿透、始终置顶显示。
    """

    # 颜色方案
    COLORS = {
        "idle": {"dot": "#1a1a2e", "glow": "#16213e", "pulse": "#0f3460"},
        "listening": {"dot": "#00d2ff", "glow": "#003d5c", "pulse": "#0088cc"},
        "thinking": {"dot": "#7c3aed", "glow": "#2d1b69", "pulse": "#5b21b6"},
        "speaking": {"dot": "#10b981", "glow": "#064e3b", "pulse": "#059669"},
    }

    def __init__(self):
        self.window = None
        self.canvas = None
        self.state = "idle"
        self.animation_running = False
        self.size = 80  # 圆形直径
        self.pulse_value = 0
        self.angle = 0

    def create_window(self):
        """创建透明叠加窗口"""
        self.window = tk.Tk()
        self.window.title("Friday Awake")
        self.window.overrideredirect(True)  # 无边框
        self.window.attributes("-topmost", True)  # 始终置顶
        self.window.attributes("-transparentcolor", "#000001")  # 透明色
        self.window.configure(bg="#000001")

        # 定位到屏幕右下角
        screen_width = self.window.winfo_screenwidth()
        screen_height = self.window.winfo_screenheight()
        margin = 20
        x = screen_width - self.size - margin
        y = screen_height - self.size - margin
        self.window.geometry(f"{self.size}x{self.size}+{x}+{y}")

        # 点击穿透
        self.window.wm_attributes("-disabled", True)

        # 画布
        self.canvas = tk.Canvas(
            self.window,
            width=self.size,
            height=self.size,
            bg="#000001",
            highlightthickness=0,
        )
        self.canvas.pack()

        # 初始绘制
        self._draw_idle()

        # 启动动画循环
        self.animation_running = True
        self._animate()

    def _draw_idle(self):
        """绘制待机状态——半透明小点"""
        c = self.COLORS["idle"]
        self.canvas.delete("all")
        cx = cy = self.size // 2
        r = 6  # 小点半径
        # 光晕
        for i in range(3, 0, -1):
            alpha = 15 // i
            self.canvas.create_oval(
                cx - r * i * 2, cy - r * i * 2,
                cx + r * i * 2, cy + r * i * 2,
                outline="", fill=c["glow"],
                stipple="gray25" if i > 1 else "",
            )
        # 中心点
        self.canvas.create_oval(
            cx - r, cy - r, cx + r, cy + r,
            fill=c["dot"], outline="",
        )

    def _draw_listening(self):
        """绘制聆听状态——脉冲波动"""
        c = self.COLORS["listening"]
        self.canvas.delete("all")
        cx = cy = self.size // 2

        # 脉冲环
        pulse_radius = 10 + self.pulse_value * 25
        alpha = max(0, 1 - self.pulse_value * 0.8)
        self.canvas.create_oval(
            cx - pulse_radius, cy - pulse_radius,
            cx + pulse_radius, cy + pulse_radius,
            outline=c["pulse"], width=2,
            dash=(),
        )

        # 第二层脉冲
        pulse_radius2 = 10 + ((self.pulse_value + 0.3) % 1) * 25
        self.canvas.create_oval(
            cx - pulse_radius2, cy - pulse_radius2,
            cx + pulse_radius2, cy + pulse_radius2,
            outline=c["glow"], width=1,
            dash=(),
        )

        # 声纹波动（底部的弧线）
        for i in range(5):
            h = 3 + self.pulse_value * 8 * (1 - abs(i - 2) / 2)
            x1 = cx - 12 + i * 6
            y1 = cy + 10
            x2 = x1 + 4
            y2 = y1 - h
            self.canvas.create_rectangle(
                x1, y1, x2, y2,
                fill=c["dot"], outline="",
            )

        # 中心圆
        self.canvas.create_oval(
            cx - 6, cy - 6, cx + 6, cy + 6,
            fill=c["dot"], outline=c["pulse"], width=1,
        )

    def _draw_thinking(self):
        """绘制思考状态——旋转光晕"""
        c = self.COLORS["thinking"]
        self.canvas.delete("all")
        cx = cy = self.size // 2

        # 旋转弧线
        for i in range(3):
            angle_offset = self.angle + i * 120
            start_angle = angle_offset
            extent = 60 + 20 * math.sin(self.pulse_value * math.pi)
            r = 25 + 5 * math.sin(self.pulse_value * math.pi + i)
            self.canvas.create_arc(
                cx - r, cy - r, cx + r, cy + r,
                start=start_angle, extent=extent,
                outline=c["pulse"], width=2,
                style="arc",
            )

        # 中心点
        self.canvas.create_oval(
            cx - 5, cy - 5, cx + 5, cy + 5,
            fill=c["dot"], outline="",
        )

    def _draw_speaking(self):
        """绘制回复状态——声波动画"""
        c = self.COLORS["speaking"]
        self.canvas.delete("all")
        cx = cy = self.size // 2

        # 声波环
        for i in range(3):
            r = 15 + i * 8 + self.pulse_value * 5
            alpha = 0.8 - i * 0.25
            width = max(1, 3 - i)
            self.canvas.create_oval(
                cx - r, cy - r, cx + r, cy + r,
                outline=c["pulse"], width=width,
                dash=None,
            )

        # 中心
        self.canvas.create_oval(
            cx - 7, cy - 7, cx + 7, cy + 7,
            fill=c["dot"], outline=c["glow"], width=2,
        )

    def _animate(self):
        """动画循环"""
        if not self.animation_running:
            return

        self.pulse_value = (self.pulse_value + 0.05) % 1
        self.angle = (self.angle + 3) % 360

        if self.state == "idle":
            self._draw_idle()
        elif self.state == "listening":
            self._draw_listening()
        elif self.state == "thinking":
            self._draw_thinking()
        elif self.state == "speaking":
            self._draw_speaking()

        self.window.after(50, self._animate)

    def set_state(self, state):
        """切换状态: idle / listening / thinking / speaking"""
        if state in self.COLORS:
            self.state = state

    def run(self):
        """运行叠加层（阻塞）"""
        self.create_window()
        self.window.mainloop()

    def stop(self):
        """停止叠加层"""
        self.animation_running = False
        if self.window:
            self.window.quit()
            self.window.destroy()


# ==================== 独立测试 ====================

def demo_cycle(overlay):
    """演示状态切换"""
    import time as _time
    states = ["idle", "listening", "thinking", "speaking"]
    while True:
        for s in states:
            overlay.set_state(s)
            _time.sleep(2)


if __name__ == "__main__":
    overlay = FridayOverlay()
    # 启动状态演示线程
    t = threading.Thread(target=demo_cycle, args=(overlay,), daemon=True)
    t.start()
    overlay.run()
