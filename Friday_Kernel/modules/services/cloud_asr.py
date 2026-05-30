#!/usr/bin/env python3
"""
Friday Cloud ASR — 云端语音识别模块
=====================================
支持三家云端 ASR 服务商：
  - 阿里云百炼 Paraformer（首选，实时流式）
  - 腾讯云 ASR（实时流式）
  - 科大讯飞 RTASR（实时流式）

借鉴自 Bailongma 的 cloud-asr.js，移植为 Python 实现。

作者：Friday Kernel
版本：0.1.0
"""

import asyncio
import json
import base64
import hashlib
import hmac
import time
import uuid
import struct
from typing import Optional, Callable, Dict, Any

try:
    import websockets
    HAS_WEBSOCKETS = True
except ImportError:
    HAS_WEBSOCKETS = False


class CloudASRSession:
    """
    云端 ASR 会话管理器
    
    支持三种模式：
    - aliyun: 阿里云百炼 Paraformer
    - tencent: 腾讯云 ASR
    - xunfei: 科大讯飞 RTASR
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化云端 ASR 会话
        
        参数:
            config: 配置字典，包含:
                - provider: 服务商 ('aliyun' | 'tencent' | 'xunfei')
                - lang: 语言 ('zh' | 'en')
                - aliyun_api_key: 阿里云 API Key
                - tencent_secret_id: 腾讯云 SecretId
                - tencent_secret_key: 腾讯云 SecretKey
                - tencent_app_id: 腾讯云 AppId
                - xunfei_app_id: 讯飞 AppId
                - xunfei_api_key: 讯飞 API Key
        """
        self.config = config
        self.provider = config.get('provider', 'aliyun')
        self.lang = config.get('lang', 'zh')
        
        # 回调函数
        self.on_transcript: Optional[Callable[[str, bool], None]] = None  # (text, is_final)
        self.on_error: Optional[Callable[[str], None]] = None
        self.on_close: Optional[Callable[[], None]] = None
        
        # 会话状态
        self.ws = None
        self.task_id = None
        self.accumulated_text = ""
        self.is_connected = False
        
        # 阿里云 Paraformer 配置
        self.WS_URL_ALIYUN = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/'
        
        # 腾讯云 ASR 配置
        self.HOST_TENCENT = 'asr.cloud.tencent.com'
        self.PATH_TENCENT = '/asr/v2/'
        
        # 科大讯飞 RTASR 配置
        self.WS_URL_XUNFEI = 'wss://rtasr.xfyun.cn/v1/ws'
        
    def set_callbacks(self, on_transcript=None, on_error=None, on_close=None):
        """设置回调函数"""
        if on_transcript:
            self.on_transcript = on_transcript
        if on_error:
            self.on_error = on_error
        if on_close:
            self.on_close = on_close
    
    async def connect(self):
        """连接到云端 ASR 服务"""
        if not HAS_WEBSOCKETS:
            if self.on_error:
                self.on_error("缺少 websockets 库，请运行: pip install websockets")
            return False
        
        try:
            if self.provider == 'aliyun':
                await self._connect_aliyun()
            elif self.provider == 'tencent':
                await self._connect_tencent()
            elif self.provider == 'xunfei':
                await self._connect_xunfei()
            else:
                if self.on_error:
                    self.on_error(f"未知云端 ASR 服务商: {self.provider}")
                return False
            
            return True
        except Exception as e:
            if self.on_error:
                self.on_error(f"连接失败: {str(e)}")
            return False
    
    async def _connect_aliyun(self):
        """连接阿里云 Paraformer"""
        api_key = self.config.get('aliyun_api_key')
        if not api_key:
            if self.on_error:
                self.on_error("未配置阿里云 API Key")
            return
        
        self.task_id = str(uuid.uuid4())
        
        headers = {
            'Authorization': f'bearer {api_key}',
            'X-DashScope-DataInspection': 'enable'
        }
        
        self.ws = await websockets.connect(self.WS_URL_ALIYUN, extra_headers=headers)
        
        # 发送任务启动消息
        lang_code = 'zh' if self.lang == 'zh' else 'en'
        start_msg = {
            'header': {
                'action': 'run-task',
                'task_id': self.task_id,
                'streaming': 'duplex'
            },
            'payload': {
                'task_group': 'audio',
                'task': 'asr',
                'function': 'recognition',
                'model': 'paraformer-realtime-v2',
                'parameters': {
                    'sample_rate': 16000,
                    'format': 'pcm',
                    'language_hints': [lang_code],
                    'punctuation_prediction': True,
                    'inverse_text_normalization': True,
                },
                'input': {},
            }
        }
        
        await self.ws.send(json.dumps(start_msg))
        self.is_connected = True
        
        # 启动消息接收循环
        asyncio.create_task(self._aliyun_receive_loop())
    
    async def _aliyun_receive_loop(self):
        """阿里云消息接收循环"""
        try:
            async for message in self.ws:
                try:
                    msg = json.loads(message)
                    event = msg.get('header', {}).get('event')
                    
                    if event == 'result-generated':
                        sentence = msg.get('payload', {}).get('output', {}).get('sentence', {})
                        text = sentence.get('text', '')
                        status = sentence.get('status', '')
                        
                        if text:
                            is_final = (status == 'sentence_end')
                            if self.on_transcript:
                                self.on_transcript(text, is_final)
                    
                    elif event == 'task-failed':
                        error_msg = msg.get('header', {}).get('error_message', '阿里云 ASR 错误')
                        if self.on_error:
                            self.on_error(error_msg)
                    
                except json.JSONDecodeError:
                    pass
        except websockets.exceptions.ConnectionClosed:
            if self.on_close:
                self.on_close()
            self.is_connected = False
    
    async def _connect_tencent(self):
        """连接腾讯云 ASR"""
        secret_id = self.config.get('tencent_secret_id')
        secret_key = self.config.get('tencent_secret_key')
        app_id = self.config.get('tencent_app_id', '')
        
        if not secret_id or not secret_key:
            if self.on_error:
                self.on_error("未配置腾讯云 SecretId/SecretKey")
            return
        
        # 生成签名
        ts = int(time.time())
        nonce = int(time.time() * 1000) % 1000000
        
        params = {
            'secretid': secret_id,
            'timestamp': ts,
            'expired': ts + 86400,
            'nonce': nonce,
            'engine_model_type': '16k_zh' if self.lang == 'zh' else '16k_en',
            'voice_format': 1,
            'needvad': 1,
        }
        
        sorted_query = '&'.join(f'{k}={params[k]}' for k in sorted(params.keys()))
        sign_str = f'{self.HOST_TENCENT}{self.PATH_TENCENT}{app_id}?{sorted_query}'
        signature = base64.b64encode(
            hmac.new(secret_key.encode(), sign_str.encode(), hashlib.sha256).digest()
        ).decode()
        
        url = f'wss://{self.HOST_TENCENT}{self.PATH_TENCENT}{app_id}?{sorted_query}&signature={signature}'
        
        self.ws = await websockets.connect(url)
        self.is_connected = True
        
        # 启动消息接收循环
        asyncio.create_task(self._tencent_receive_loop())
    
    async def _tencent_receive_loop(self):
        """腾讯云消息接收循环"""
        try:
            async for message in self.ws:
                try:
                    msg = json.loads(message)
                    if msg.get('code') != 0:
                        if self.on_error:
                            self.on_error(f"腾讯云 ASR 错误: {msg.get('message', '未知错误')}")
                        continue
                    
                    result = msg.get('result', {})
                    text = result.get('voice_text_str', '')
                    
                    if text:
                        is_final = (result.get('slice_type') == 2)
                        if self.on_transcript:
                            self.on_transcript(text, is_final)
                
                except json.JSONDecodeError:
                    pass
        except websockets.exceptions.ConnectionClosed:
            if self.on_close:
                self.on_close()
            self.is_connected = False
    
    async def _connect_xunfei(self):
        """连接科大讯飞 RTASR"""
        app_id = self.config.get('xunfei_app_id')
        api_key = self.config.get('xunfei_api_key')
        
        if not app_id or not api_key:
            if self.on_error:
                self.on_error("未配置讯飞 AppId/ApiKey")
            return
        
        # 生成签名
        ts = str(int(time.time()))
        md5_base = hashlib.md5((app_id + ts).encode()).hexdigest()
        signa = base64.b64encode(
            hmac.new(api_key.encode(), md5_base.encode(), hashlib.sha1).digest()
        ).decode()
        
        lang_param = 'en_us' if self.lang == 'en' else 'cn'
        url = f'{self.WS_URL_XUNFEI}?appid={app_id}&ts={ts}&signa={signa}&lang={lang_param}'
        
        self.ws = await websockets.connect(url)
        self.is_connected = True
        
        # 启动消息接收循环
        asyncio.create_task(self._xunfei_receive_loop())
    
    async def _xunfei_receive_loop(self):
        """讯飞消息接收循环"""
        try:
            async for message in self.ws:
                try:
                    msg = json.loads(message)
                    action = msg.get('action', '')
                    
                    if action == 'error':
                        if self.on_error:
                            self.on_error(f"讯飞 RTASR 错误: {msg.get('desc', '未知错误')}")
                    
                    elif action == 'result':
                        data = json.loads(msg.get('data', '{}'))
                        is_final = (data.get('type') == '1')
                        
                        # 解析 ws 数组
                        text_parts = []
                        for ws_item in data.get('ws', []):
                            for cw_item in ws_item.get('cw', []):
                                text_parts.append(cw_item.get('w', ''))
                        
                        text = ''.join(text_parts)
                        if text and self.on_transcript:
                            self.on_transcript(text, is_final)
                
                except (json.JSONDecodeError, KeyError):
                    pass
        except websockets.exceptions.ConnectionClosed:
            if self.on_close:
                self.on_close()
            self.is_connected = False
    
    async def send_audio(self, pcm_data: bytes):
        """发送音频数据（PCM 16bit 16kHz 单声道）"""
        if not self.ws or not self.is_connected:
            return
        
        try:
            if self.provider == 'aliyun':
                # 阿里云直接发送二进制音频数据
                await self.ws.send(pcm_data)
            elif self.provider == 'tencent':
                # 腾讯云直接发送二进制音频数据
                await self.ws.send(pcm_data)
            elif self.provider == 'xunfei':
                # 讯飞需要 base64 编码
                audio_base64 = base64.b64encode(pcm_data).decode()
                msg = {
                    'action': 'write',
                    'data': audio_base64
                }
                await self.ws.send(json.dumps(msg))
        except Exception as e:
            if self.on_error:
                self.on_error(f"发送音频失败: {str(e)}")
    
    async def flush(self):
        """结束当前识别会话"""
        if not self.ws or not self.is_connected:
            return
        
        try:
            if self.provider == 'aliyun':
                # 发送结束任务消息
                end_msg = {
                    'header': {
                        'action': 'finish-task',
                        'task_id': self.task_id,
                        'streaming': 'duplex'
                    },
                    'payload': {'input': {}}
                }
                await self.ws.send(json.dumps(end_msg))
            
            elif self.provider == 'tencent':
                # 腾讯云通过关闭连接结束
                await self.ws.close()
                self.is_connected = False
            
            elif self.provider == 'xunfei':
                # 讯飞发送结束帧
                end_msg = {'end': True}
                await self.ws.send(json.dumps(end_msg))
        
        except Exception as e:
            if self.on_error:
                self.on_error(f"结束会话失败: {str(e)}")
    
    async def close(self):
        """关闭连接"""
        if self.ws:
            try:
                await self.ws.close()
            except Exception:
                pass
            self.ws = None
            self.is_connected = False
    
    def get_accumulated_text(self) -> str:
        """获取累积的识别文本"""
        return self.accumulated_text
    
    def reset_accumulated_text(self):
        """重置累积文本"""
        self.accumulated_text = ""


# ─── 便捷函数 ───

def create_cloud_asr_session(config: Dict[str, Any]) -> CloudASRSession:
    """
    创建云端 ASR 会话
    
    参数:
        config: 配置字典，见 CloudASRSession.__init__
    
    返回:
        CloudASRSession 实例
    """
    return CloudASRSession(config)


# ─── 使用示例 ───

async def example_usage():
    """使用示例"""
    # 阿里云配置示例
    config = {
        'provider': 'aliyun',
        'lang': 'zh',
        'aliyun_api_key': 'your-aliyun-api-key',
    }
    
    session = create_cloud_asr_session(config)
    
    def on_transcript(text, is_final):
        print(f"识别结果: {text} (最终: {is_final})")
    
    def on_error(error):
        print(f"错误: {error}")
    
    def on_close():
        print("连接已关闭")
    
    session.set_callbacks(on_transcript, on_error, on_close)
    
    # 连接
    connected = await session.connect()
    if not connected:
        return
    
    # 模拟发送音频数据（实际使用时从麦克风获取）
    # audio_data = ...  # PCM 16bit 16kHz 单声道
    # await session.send_audio(audio_data)
    
    # 结束识别
    await session.flush()
    
    # 关闭连接
    await session.close()


if __name__ == '__main__':
    print("Friday Cloud ASR 模块")
    print("支持服务商: 阿里云 Paraformer, 腾讯云 ASR, 科大讯飞 RTASR")
    print("\n使用方法:")
    print("  1. 安装依赖: pip install websockets")
    print("  2. 配置 API Key")
    print("  3. 调用 create_cloud_asr_session() 创建会话")
    print("  4. 连接并发送音频数据")
