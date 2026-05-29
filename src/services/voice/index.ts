/**
 * 语音服务入口
 */

import { VoiceManager, getVoiceManager } from './manager'
import { EdgeTTSProvider } from './tts-edge'

// 导出类型
export * from './types'

// 导出管理器
export { VoiceManager, getVoiceManager } from './manager'

// 导出提供商
export { EdgeTTSProvider } from './tts-edge'

// 初始化默认语音服务
export function initializeVoiceService(): VoiceManager {
  const manager = getVoiceManager()

  // 注册 Edge TTS 提供商
  manager.registerProvider(new EdgeTTSProvider())

  return manager
}

// 快捷方法
export async function speakText(
  text: string,
  _voice?: string
): Promise<void> {
  const manager = getVoiceManager()
  await manager.textToSpeech(text, true)
}

export async function speechToSpeech(
  audio: ArrayBuffer,
  _targetLanguage?: string
): Promise<string> {
  const manager = getVoiceManager()

  // 先识别
  const recognizedText = await manager.speechToText(audio)

  // 再合成
  await manager.textToSpeech(recognizedText)

  return recognizedText
}
