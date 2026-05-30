#!/usr/bin/env python3
"""
Friday Voice Enhanced — 增强版语音交互模块（兼容层）
=====================================================
本模块是 voice_manager.py 的兼容层，保持向后兼容。
新功能请使用 voice_manager.py。

作者：Friday Kernel
版本：0.2.0（兼容层）
"""

from modules.voice_manager import FridayVoiceManager, ASRMode, VoiceState

class FridayVoiceEnhanced(FridayVoiceManager):
    """
    增强版语音交互模块（兼容层）
    
    继承自 FridayVoiceManager，保持旧 API 兼容。
    """
    
    def __init__(self, config=None):
        """
        初始化（兼容旧 API）
        
        参数:
            config: 配置字典，支持旧格式和新格式
        """
        # 转换旧配置格式到新格式
        new_config = {}
        if config:
            # 旧格式转换
            if 'asr_mode' in config:
                mode = config['asr_mode']
                if mode == 'local':
                    new_config['asr_mode'] = ASRMode.LOCAL
                elif mode == 'cloud':
                    new_config['asr_mode'] = ASRMode.CLOUD
                elif mode == 'hybrid':
                    new_config['asr_mode'] = ASRMode.HYBRID
            
            if 'cloud_provider' in config:
                new_config['cloud_provider'] = config['cloud_provider']
            
            if 'whisper_model' in config:
                new_config['sherpa_model'] = config['whisper_model']
            elif 'sherpa_model' in config:
                new_config['sherpa_model'] = config['sherpa_model']
            
            if 'enable_bargein' in config:
                new_config['enable_bargein'] = config['enable_bargein']
            
            if 'enable_duck' in config:
                new_config['enable_duck'] = config['enable_duck']
            
            # 云端 API Key
            for key in ['aliyun_api_key', 'tencent_secret_id', 'tencent_secret_key',
                       'tencent_app_id', 'xunfei_app_id', 'xunfei_api_key']:
                if key in config:
                    new_config[key] = config[key]
        
        super().__init__(new_config)
    
    # 兼容旧 API 的方法
    def init_cloud_asr_sync(self):
        """同步初始化云端 ASR（兼容旧 API）"""
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self.init_cloud_asr())
        finally:
            loop.close()
    
    def close_cloud_asr_sync(self):
        """同步关闭云端 ASR（兼容旧 API）"""
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self.close_cloud_asr())
        finally:
            loop.close()


# 向后兼容的工厂函数
def create_voice_enhanced(config=None):
    """
    创建增强版语音模块（兼容旧 API）
    
    参数:
        config: 配置字典
    
    返回:
        FridayVoiceEnhanced 实例
    """
    return FridayVoiceEnhanced(config)


if __name__ == '__main__':
    print("Friday Voice Enhanced (兼容层)")
    print("=" * 50)
    print("本模块是 voice_manager.py 的兼容层")
    print("新功能请使用: from modules.voice_manager import FridayVoiceManager")
    print()
    print("使用示例:")
    print("  from modules.friday_voice_enhanced import FridayVoiceEnhanced")
    print("  voice = FridayVoiceEnhanced(config)")
    print("  voice.start_listening()")
