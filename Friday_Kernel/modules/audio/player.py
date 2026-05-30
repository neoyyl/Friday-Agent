"""
TTS Player — 语音合成与播放原语
====================================
独立模块，零依赖其他 Friday 模块。
只依赖外部包：edge-tts, pygame, winsound。

用法：
  player = TTSPlayer()
  player.play("你好，世界！")
  player.stop()          # barge-in
  print(player.is_playing)  # bool
"""

import os
import sys
import tempfile
import asyncio
import threading
import subprocess


class TTSPlayer:
    """
    TTS 语音合成 + 播放器
    非阻塞播放 + barge-in 打断 + 临时文件清理。
    """

    def __init__(self, on_state_change=None):
        self.on_state_change = on_state_change
        self._pygame_inited = False
        self._speaking = False
        self.tts_available = self._check_tts()

    def _ensure_pygame(self):
        """惰性初始化 pygame mixer"""
        if not self._pygame_inited:
            try:
                import pygame
                pygame.mixer.init(frequency=24000, size=-16, channels=1, buffer=1024)
                self._pygame_inited = True
                return True
            except Exception as e:
                print(f"  ⚠️ pygame 初始化失败: {e}")
                return False
        return True

    def _check_tts(self):
        """检查 TTS 是否可用"""
        try:
            import edge_tts
            return True
        except ImportError:
            try:
                subprocess.run(["edge-tts", "--help"], capture_output=True, timeout=3)
                return True
            except (FileNotFoundError, subprocess.TimeoutExpired):
                return False

    def _notify_state(self, state):
        """通知状态变化"""
        self._speaking = (state == "speaking")
        if self.on_state_change:
            self.on_state_change(state)

    @property
    def is_playing(self):
        """是否正在播放语音"""
        if not self._pygame_inited:
            return False
        try:
            import pygame
            return pygame.mixer.music.get_busy()
        except Exception:
            return self._speaking

    # ==================== 播放控制 ====================

    def play(self, text, voice="zh-CN-XiaoyiNeural", wait=False):
        """
        合成并播放语音（非阻塞，除非 wait=True）

        参数:
          text: 要说的文字
          voice: 声音（默认中文女声 Xiaoyi）
          wait: 是否等待播放完成
        """
        if not text or not self.tts_available:
            return

        self._notify_state("speaking")

        # 生成音频文件
        mp3_file = self._synthesize(text, voice)
        if not mp3_file:
            self._notify_state("idle")
            return

        # 播放
        if self._ensure_pygame():
            try:
                import pygame
                # 如果正在播放，先停止（支持打断）
                if pygame.mixer.music.get_busy():
                    pygame.mixer.music.stop()
                pygame.mixer.music.load(mp3_file)
                pygame.mixer.music.play()

                if wait:
                    while pygame.mixer.music.get_busy():
                        import time
                        time.sleep(0.1)
                    self._notify_state("idle")
                else:
                    # 非阻塞：启动线程等待播放结束
                    def _wait_playback():
                        import time as _t
                        try:
                            import pygame as _pg
                            while _pg.mixer.music.get_busy():
                                _t.sleep(0.1)
                        except Exception:
                            pass
                        self._notify_state("idle")
                    threading.Thread(target=_wait_playback, daemon=True).start()

            except Exception as e:
                print(f"  ⚠️ 播放失败: {e}")
                self._notify_state("idle")
        else:
            # 降级：用 winsound 播放
            try:
                import winsound
                winsound.PlaySound(mp3_file, winsound.SND_FILENAME | winsound.SND_ASYNC)
                self._notify_state("idle")
            except Exception as e2:
                print(f"  ⚠️ 降级播放失败: {e2}")
                self._notify_state("idle")

        # 清理临时文件
        def _cleanup():
            import time as _t
            _t.sleep(3)
            try:
                if os.path.exists(mp3_file):
                    os.remove(mp3_file)
            except Exception:
                pass
        threading.Thread(target=_cleanup, daemon=True).start()

    def stop(self):
        """打断当前语音输出（barge-in）"""
        if not self._pygame_inited:
            return
        try:
            import pygame
            if pygame.mixer.music.get_busy():
                pygame.mixer.music.stop()
            self._notify_state("idle")
        except Exception:
            self._notify_state("idle")

    # ==================== TTS 合成 ====================

    def _synthesize(self, text, voice="zh-CN-XiaoyiNeural"):
        """
        调用 edge-tts 合成语音，返回临时 MP3 文件路径
        """
        import edge_tts
        import asyncio

        output_file = tempfile.mktemp(suffix=".mp3")
        try:
            async def _do_tts():
                communicate = edge_tts.Communicate(text, voice)
                await communicate.save(output_file)
                return True

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            success = loop.run_until_complete(_do_tts())
            loop.close()

            if success and os.path.exists(output_file) and os.path.getsize(output_file) > 0:
                return output_file
            else:
                print(f"  ⚠️ TTS 生成文件为空")
                return None
        except Exception as e:
            print(f"  ⚠️ TTS 合成失败: {e}")
            # 降级到命令行
            try:
                subprocess.run(
                    ["edge-tts", "--voice", voice, "--text", text, "--write-media", output_file],
                    capture_output=True, timeout=30,
                )
                if os.path.exists(output_file) and os.path.getsize(output_file) > 0:
                    return output_file
            except Exception as e2:
                print(f"  ⚠️ 命令行 TTS 也失败: {e2}")
            return None


# ==================== 快速测试 ====================
if __name__ == "__main__":
    def state_cb(s):
        print(f"[状态] → {s}")

    p = TTSPlayer(on_state_change=state_cb)
    print(f"TTS 可用: {p.tts_available}")
    if p.tts_available:
        print("播放测试...")
        p.play("你好，我是 Friday。", wait=True)
        print("完成")
