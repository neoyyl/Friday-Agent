#!/usr/bin/env python3
"""
Friday Voice Manager — 统一语音管理器
=======================================
核心策略：本地优先，云端备选
   1. 默认使用本地 sherpa-onnx SenseVoice 服务（离线、隐私、免费）
   2. 本地不可用时自动降级到云端 ASR
   3. 支持运行时切换模式

架构：
  ┌─────────────────────────────────────────┐
  │         Voice Manager                   │
  ├─────────────────────────────────────────┤
  │  Local Mode (默认)                      │
  │  └─ Sherpa Server (ws://127.0.0.1:3723) │
  │         (sherpa-onnx SenseVoice)        │
  │                                         │
  │  Cloud Mode (备选)                      │
  │  ├─ 阿里云 Paraformer                   │
  │  ├─ 腾讯云 ASR                          │
  │  └─ 科大讯飞 RTASR                      │
  └─────────────────────────────────────────┘

作者：Friday Kernel
版本：1.0.0 (sherpa-onnx)
"""

import asyncio
import json
import time
import threading
import subprocess
import sys
from pathlib import Path
from typing import Optional, Callable, Dict, Any, List
from enum import Enum

import numpy as np
import sounddevice as sd

# 导入云端 ASR（可选）
try:
    from cloud_asr import CloudASRSession, create_cloud_asr_session
    HAS_CLOUD_ASR = True
except ImportError:
    HAS_CLOUD_ASR = False


class ASRMode(Enum):
    """语音识别模式"""
    LOCAL = "local"      # 本地 sherpa-onnx SenseVoice（默认）
    CLOUD = "cloud"      # 云端 ASR
    HYBRID = "hybrid"    # 混合模式（本地优先，失败时云端）


class VoiceState(Enum):
    """语音状态"""
    IDLE = "idle"
    LISTENING = "listening"
    RECOGNIZING = "recognizing"
    SPEAKING = "speaking"
    DONE = "done"
    ERROR = "error"
    DUCKING = "ducking"


class FridayVoiceManager:
    """
    Friday 统一语音管理器
    
    核心特性：
    - 本地 sherpa-onnx SenseVoice 优先（离线、隐私、轻量）
    - 云端 ASR 备选（高准确率）
    - 自动降级策略
    - 智能打断（Barge-in）
    - Duck 模式
    """
    
    # ── 默认配置 ──
    DEFAULT_CONFIG = {
        'asr_mode': ASRMode.LOCAL,
        'sherpa_model': 'sense-voice',      # 固定模型
        'sherpa_port': 3723,
        'sherpa_host': '127.0.0.1',
        'cloud_provider': 'aliyun',
        'sample_rate': 16000,
        'enable_bargein': True,
        'enable_duck': True,
        'enable_yamnet': False,  # 场景声音识别（需要 TensorFlow）
    }
    
    # ── 打断检测参数 ──
    BARGEIN_WARMUP_MS = 600
    BARGEIN_FRAMES = 8
    BARGEIN_THRESHOLD = 0.09
    BARGEIN_PRE_BUFFER_MS = 1500
    BARGEIN_MAX_CHUNKS = 6
    
    DUCK_TRIGGER_FRAMES = 3
    DUCK_SUSTAIN_FRAMES = 10
    DUCK_DECAY_FRAMES = 6
    DUCK_MAX_MS = 1500
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        初始化语音管理器
        
        参数:
            config: 配置字典，覆盖默认配置
        """
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}
        
        # 状态
        self.current_state = VoiceState.IDLE
        self.is_listening = False
        self.is_speaking = False
        self.current_mode = ASRMode.LOCAL
        
        # 回调函数
        self.on_transcript: Optional[Callable[[str, bool], None]] = None
        self.on_state_change: Optional[Callable[[VoiceState], None]] = None
        self.on_error: Optional[Callable[[str], None]] = None
        self.on_bargein: Optional[Callable[[], None]] = None
        self.on_mode_switch: Optional[Callable[[ASRMode], None]] = None
        
        # 本地 sherpa-onnx 服务
        self.sherpa_proc: Optional[subprocess.Popen] = None
        self.sherpa_ws = None
        self.sherpa_connected = False
        
        # 云端 ASR 会话
        self.cloud_session: Optional[CloudASRSession] = None
        self.cloud_connected = False
        
        # 音频流
        self.audio_stream = None
        self.audio_queue = None
        self._running = False
        self._thread = None
        
        # 音量分析
        self.current_volume = 0.0
        self.analyser_data = np.zeros(256, dtype=np.uint8)
        
        # 打断状态
        self.suspended_by_media = False
        self.tts_start_time = 0
        self.bargein_frames = 0
        self.duck_active = False
        self.duck_high_frames = 0
        self.duck_low_frames = 0
        self.duck_start_time = 0
        self.bargein_buffer = []
        self.bargein_buffering = False
        
        # 文本累积
        self.accumulated_text = ""
        
        # 事件循环（用于异步操作）
        self._loop = None
        self._loop_thread = None
    
    def set_callbacks(self, on_transcript=None, on_state_change=None, on_error=None, on_bargein=None, on_mode_switch=None):
        """设置回调函数"""
        if on_transcript:
            self.on_transcript = on_transcript
        if on_state_change:
            self.on_state_change = on_state_change
        if on_error:
            self.on_error = on_error
        if on_bargein:
            self.on_bargein = on_bargein
        if on_mode_switch:
            self.on_mode_switch = on_mode_switch
    
    def set_state(self, state: VoiceState):
        """设置当前状态"""
        old_state = self.current_state
        self.current_state = state
        
        if self.on_state_change and old_state != state:
            self.on_state_change(state)
    
    # ── 本地 sherpa-onnx 服务管理 ──
    
    def start_local_server(self) -> bool:
        """
        启动本地 sherpa-onnx SenseVoice 服务
        
        返回:
            True 如果启动成功，False 如果失败
        """
        if self.sherpa_proc and self.sherpa_proc.poll() is None:
            print("[语音] 本地服务已在运行")
            return True
        
        try:
            # 查找 sherpa_server.py 路径
            script_dir = Path(__file__).parent
            server_script = script_dir / "sherpa_server.py"
            
            if not server_script.exists():
                print(f"[语音] 找不到 sherpa_server.py: {server_script}")
                return False
            
            # 启动服务进程
            port = self.config.get('sherpa_port', 3723)
            host = self.config.get('sherpa_host', '127.0.0.1')
            
            cmd = [
                sys.executable, str(server_script),
                "--port", str(port),
                "--host", host,
            ]
            
            print(f"[语音] 启动本地识别服务: {' '.join(cmd)}")
            self.sherpa_proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding='utf-8',
                errors='replace',
            )
            
            # 等待服务启动（最多 60 秒，sense-voice 约 5-15 秒）
            import time
            start_time = time.time()
            while time.time() - start_time < 60:
                if self.sherpa_proc.poll() is not None:
                    # 进程已退出，读取错误信息
                    stderr = self.sherpa_proc.stderr.read()
                    print(f"[语音] 本地服务启动失败: {stderr}")
                    return False
                
                # 尝试连接 WebSocket
                try:
                    import websockets
                    # Python 3.14+ 需要用 new_event_loop
                    _test_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(_test_loop)
                    _test_loop.run_until_complete(
                        self._test_local_connection()
                    )
                    _test_loop.close()
                    print("[语音] 本地识别服务启动成功")
                    self.sherpa_connected = True
                    return True
                except Exception:
                    time.sleep(0.5)
            
            print("[语音] 本地服务启动超时")
            return False
            
        except Exception as e:
            print(f"[语音] 启动本地服务失败: {e}")
            return False
    
    # 向后兼容别名
    start_whisper_server = start_local_server
    
    async def _test_local_connection(self):
        """测试本地识别服务连接"""
        import websockets
        port = self.config.get('sherpa_port', 3723)
        uri = f"ws://127.0.0.1:{port}"
        async with websockets.connect(uri) as ws:
            await ws.send(json.dumps({"type": "config", "lang": "zh"}))
            response = await ws.recv()
            msg = json.loads(response)
            if msg.get("type") == "config_ok":
                self.sherpa_connected = True
    
    _test_whisper_connection = _test_local_connection
    
    def stop_local_server(self):
        """停止本地识别服务"""
        if self.sherpa_proc:
            try:
                self.sherpa_proc.terminate()
                self.sherpa_proc.wait(timeout=5)
            except Exception:
                self.sherpa_proc.kill()
            self.sherpa_proc = None
            self.sherpa_connected = False
            print("[语音] 本地识别服务已停止")
    
    # 向后兼容别名
    stop_whisper_server = stop_local_server
    
    # ── 云端 ASR 管理 ──
    
    async def init_cloud_asr(self) -> bool:
        """
        初始化云端 ASR
        
        返回:
            True 如果连接成功，False 如果失败
        """
        if not HAS_CLOUD_ASR:
            print("[语音] 云端 ASR 模块未安装")
            return False
        
        try:
            config = {
                'provider': self.config.get('cloud_provider', 'aliyun'),
                'lang': 'zh',
            }
            
            # 添加 API Key
            provider = config['provider']
            if provider == 'aliyun':
                config['aliyun_api_key'] = self.config.get('aliyun_api_key', '')
            elif provider == 'tencent':
                config['tencent_secret_id'] = self.config.get('tencent_secret_id', '')
                config['tencent_secret_key'] = self.config.get('tencent_secret_key', '')
                config['tencent_app_id'] = self.config.get('tencent_app_id', '')
            elif provider == 'xunfei':
                config['xunfei_app_id'] = self.config.get('xunfei_app_id', '')
                config['xunfei_api_key'] = self.config.get('xunfei_api_key', '')
            
            self.cloud_session = create_cloud_asr_session(config)
            self.cloud_session.set_callbacks(
                on_transcript=self._on_cloud_transcript,
                on_error=self._on_cloud_error,
                on_close=self._on_cloud_close,
            )
            
            connected = await self.cloud_session.connect()
            self.cloud_connected = connected
            return connected
            
        except Exception as e:
            print(f"[语音] 初始化云端 ASR 失败: {e}")
            return False
    
    async def _on_cloud_transcript(self, text: str, is_final: bool):
        """云端 ASR 识别结果回调"""
        if is_final:
            self.accumulated_text = text
        else:
            self.accumulated_text = text
        
        if self.on_transcript:
            self.on_transcript(text, is_final)
    
    def _on_cloud_error(self, error: str):
        """云端 ASR 错误回调"""
        if self.on_error:
            self.on_error(f"云端 ASR 错误: {error}")
    
    def _on_cloud_close(self):
        """云端 ASR 连接关闭回调"""
        self.cloud_connected = False
    
    async def close_cloud_asr(self):
        """关闭云端 ASR 连接"""
        if self.cloud_session:
            await self.cloud_session.close()
            self.cloud_session = None
            self.cloud_connected = False
    
    # ── 模式切换 ──
    
    def switch_mode(self, mode: ASRMode):
        """
        切换语音识别模式
        
        参数:
            mode: 目标模式 (LOCAL / CLOUD / HYBRID)
        """
        old_mode = self.current_mode
        self.current_mode = mode
        
        if self.on_mode_switch:
            self.on_mode_switch(mode)
        
        print(f"[语音] 切换模式: {old_mode.value} → {mode.value}")
        
        # 如果从本地切换到云端，启动云端服务
        if mode == ASRMode.CLOUD and not self.cloud_connected:
            asyncio.get_event_loop().run_until_complete(self.init_cloud_asr())
    
    def auto_fallback(self):
        """自动降级：本地失败时切换到云端"""
        if self.current_mode == ASRMode.LOCAL and HAS_CLOUD_ASR:
            print("[语音] 本地服务不可用，自动降级到云端 ASR")
            self.switch_mode(ASRMode.CLOUD)
    
    # ── 音频捕获 ──
    
    def start_listening(self):
        """开始监听麦克风"""
        if self.is_listening:
            return
        
        # 确保服务已启动
        if self.current_mode == ASRMode.LOCAL:
            if not self.sherpa_connected:
                if not self.start_local_server():
                    # 本地启动失败，尝试云端
                    self.auto_fallback()
        
        self.is_listening = True
        self.set_state(VoiceState.LISTENING)
        
        # 启动音频流
        try:
            self.audio_queue = asyncio.Queue()
            self.audio_stream = sd.InputStream(
                samplerate=self.config.get('sample_rate', 16000),
                channels=1,
                dtype='float32',
                callback=self._audio_callback,
                blocksize=4096,
            )
            self.audio_stream.start()
            self._running = True
            
            # 启动音频处理线程
            self._thread = threading.Thread(target=self._process_audio_loop, daemon=True)
            self._thread.start()
            
            print("[语音] 开始监听")
            
        except Exception as e:
            if self.on_error:
                self.on_error(f"启动麦克风失败: {str(e)}")
            self.is_listening = False
            self.set_state(VoiceState.ERROR)
    
    def stop_listening(self):
        """停止监听麦克风"""
        if not self.is_listening:
            return
        
        self._running = False
        self.is_listening = False
        
        if self.audio_stream:
            self.audio_stream.stop()
            self.audio_stream.close()
            self.audio_stream = None
        
        self.set_state(VoiceState.IDLE)
        print("[语音] 停止监听")
    
    def _audio_callback(self, indata, frames, time_info, status):
        """音频回调"""
        if status:
            print(f"Audio status: {status}")
        
        if self.audio_queue:
            try:
                self.audio_queue.put_nowait(indata.copy())
            except asyncio.QueueFull:
                pass
    
    def _process_audio_loop(self):
        """音频处理循环"""
        while self._running:
            try:
                if self.audio_queue:
                    indata = self.audio_queue.get_nowait()
                    
                    # 计算音量
                    self.current_volume = float(np.sqrt(np.mean(indata ** 2)))
                    
                    # 更新分析器数据
                    self.analyser_data = np.clip(indata.flatten() * 128 + 128, 0, 255).astype(np.uint8)[:256]
                    
                    # 打断检测
                    if self.config.get('enable_bargein', True) and self.is_speaking:
                        self._check_bargein()
                    
                    # 发送音频到识别服务
                    if self.current_mode == ASRMode.LOCAL and self.sherpa_connected:
                        self._send_to_sherpa(indata)
                    elif self.current_mode == ASRMode.CLOUD and self.cloud_connected:
                        asyncio.run_coroutine_threadsafe(
                            self._send_to_cloud(indata),
                            asyncio.get_event_loop()
                        )
                
            except asyncio.QueueEmpty:
                time.sleep(0.01)
            except Exception as e:
                if self.on_error:
                    self.on_error(f"音频处理错误: {str(e)}")
    
    async def _send_to_cloud(self, indata):
        """发送音频到云端 ASR"""
        pcm_data = (indata * 32767).astype(np.int16).tobytes()
        
        if self.bargein_buffering:
            self.bargein_buffer.append(pcm_data)
            if len(self.bargein_buffer) > self.BARGEIN_MAX_CHUNKS:
                self.bargein_buffer.pop(0)
        else:
            await self.cloud_session.send_audio(pcm_data)
    
    def _send_to_sherpa(self, indata):
        """发送音频到本地 sherpa-onnx 服务（通过 WebSocket）"""
        try:
            import websockets
            import asyncio
            
            pcm_data = (indata * 32767).astype(np.int16).tobytes()
            
            # 异步发送
            async def send():
                port = self.config.get('sherpa_port', 3723)
                uri = f"ws://127.0.0.1:{port}"
                async with websockets.connect(uri) as ws:
                    await ws.send(pcm_data)
            
            asyncio.get_event_loop().run_until_complete(send())
            
        except Exception as e:
            # 发送失败，尝试降级
            print(f"[语音] 发送到本地服务失败: {e}")
            self.auto_fallback()
    
    # ── 打断检测 ──
    
    def _check_bargein(self):
        """检查是否需要打断 TTS"""
        if not self.config.get('enable_bargein', True):
            return
        
        # 检查 warmup 期间
        if (time.time() * 1000 - self.tts_start_time) < self.BARGEIN_WARMUP_MS:
            return
        
        # 检查音量
        if self.current_volume > self.BARGEIN_THRESHOLD:
            if not self.duck_active:
                self.bargein_frames += 1
                if self.bargein_frames >= self.DUCK_TRIGGER_FRAMES:
                    self.bargein_frames = 0
                    self._enter_duck_mode()
            else:
                duck_elapsed = time.time() * 1000 - self.duck_start_time
                if self.current_volume > self.BARGEIN_THRESHOLD:
                    self.duck_high_frames += 1
                    self.duck_low_frames = 0
                    
                    if self.duck_high_frames >= self.DUCK_SUSTAIN_FRAMES:
                        self._trigger_bargein()
                else:
                    self.duck_low_frames += 1
                    self.duck_high_frames = 0
                    
                    if self.duck_low_frames >= self.DUCK_DECAY_FRAMES or duck_elapsed >= self.DUCK_MAX_MS:
                        self._exit_duck_mode()
        else:
            self.bargein_frames = 0
    
    def _enter_duck_mode(self):
        """进入 Duck 模式"""
        if not self.config.get('enable_duck', True):
            return
        
        self.duck_active = True
        self.duck_start_time = time.time() * 1000
        self.duck_high_frames = 0
        self.duck_low_frames = 0
        self.set_state(VoiceState.DUCKING)
    
    def _exit_duck_mode(self):
        """退出 Duck 模式"""
        self.duck_active = False
        self.duck_high_frames = 0
        self.duck_low_frames = 0
        self.set_state(VoiceState.LISTENING)
    
    def _trigger_bargein(self):
        """触发打断"""
        self.duck_active = False
        self.duck_high_frames = 0
        self.duck_low_frames = 0
        
        if self.on_bargein:
            self.on_bargein()
        
        self._process_bargein_buffer()
    
    def _process_bargein_buffer(self):
        """处理预缓冲音频"""
        if not self.bargein_buffer:
            return
        
        for chunk in self.bargein_buffer:
            if self.current_mode == ASRMode.CLOUD and self.cloud_connected:
                asyncio.run_coroutine_threadsafe(
                    self.cloud_session.send_audio(chunk),
                    asyncio.get_event_loop()
                )
        
        self.bargein_buffer = []
        self.bargein_buffering = False
    
    # ── TTS 播放控制 ──
    
    def start_tts_playback(self):
        """开始 TTS 播放"""
        self.is_speaking = True
        self.tts_start_time = time.time() * 1000
        self.bargein_frames = 0
        self.duck_active = False
        self.duck_high_frames = 0
        self.duck_low_frames = 0
        self.bargein_buffer = []
        self.bargein_buffering = True
        self.set_state(VoiceState.SPEAKING)
    
    def stop_tts_playback(self):
        """停止 TTS 播放"""
        self.is_speaking = False
        self.bargein_buffering = False
        self.set_state(VoiceState.LISTENING)
    
    # ── 状态查询 ──
    
    def get_status(self) -> Dict[str, Any]:
        """获取当前状态"""
        return {
            'current_mode': self.current_mode.value,
            'current_state': self.current_state.value,
            'is_listening': self.is_listening,
            'is_speaking': self.is_speaking,
            'current_volume': self.current_volume,
            'sherpa_connected': self.sherpa_connected,
            'cloud_connected': self.cloud_connected,
            'bargein_enabled': self.config.get('enable_bargein', True),
            'duck_enabled': self.config.get('enable_duck', True),
        }
    
    def get_volume(self) -> float:
        """获取当前音量"""
        return self.current_volume
    
    def get_analyser_data(self) -> np.ndarray:
        """获取分析器数据"""
        return self.analyser_data.copy()
    
    # ── 清理 ──
    
    def cleanup(self):
        """清理资源"""
        self.stop_listening()
        self.stop_local_server()
        if self.cloud_session:
            asyncio.get_event_loop().run_until_complete(self.close_cloud_asr())


# ── 使用示例 ──

def example_usage():
    """使用示例"""
    print("Friday Voice Manager")
    print("=" * 50)
    print("核心策略：本地优先，云端备选")
    print()
    print("使用步骤:")
    print("  1. 创建管理器:")
    print("     manager = FridayVoiceManager(config)")
    print()
    print("  2. 设置回调:")
    print("     manager.set_callbacks(...)")
    print()
    print("  3. 开始监听:")
    print("     manager.start_listening()")
    print()
    print("  4. TTS 播放时通知:")
    print("     manager.start_tts_playback()")
    print("     manager.stop_tts_playback()")
    print()
    print("配置选项:")
    print("  - asr_mode: 'local' | 'cloud' | 'hybrid'")
    print("  - sherpa_model: 'sense-voice' (sherpa-onnx)")
    print("  - cloud_provider: 'aliyun' | 'tencent' | 'xunfei'")
    print("  - enable_bargein: True/False")
    print("  - enable_duck: True/False")


if __name__ == '__main__':
    example_usage()
