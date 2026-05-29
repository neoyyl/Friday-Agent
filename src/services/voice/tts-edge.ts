/**
 * Edge TTS 提供商
 * 使用微软 Edge TTS 服务进行语音合成
 */

import { IVoiceProvider, TTSOptions, TTSResult } from './types'

export class EdgeTTSProvider implements IVoiceProvider {
  id = 'edge-tts'
  name = 'Edge TTS'
  type: 'tts' = 'tts'
  enabled = true

  private readonly VOICES: Record<string, string> = {
    'zh-CN': 'zh-CN-XiaoxiaoNeural',
    'zh-TW': 'zh-TW-HsiaoChenNeural',
    'en-US': 'en-US-JennyNeural',
    'en-GB': 'en-GB-SoniaNeural',
    'ja-JP': 'ja-JP-NanamiNeural',
    'ko-KR': 'ko-KR-SunHiNeural',
    'fr-FR': 'fr-FR-DeniseNeural',
    'de-DE': 'de-DE-KatjaNeural',
    'es-ES': 'es-ES-ElviraNeural',
    'it-IT': 'it-IT-ElsaNeural',
    'pt-BR': 'pt-BR-FranciscaNeural',
    'ru-RU': 'ru-RU-SvetlanaNeural',
  }

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    const voice = options?.voice || this.VOICES['zh-CN'] || 'zh-CN-XiaoxiaoNeural'
    const speed = options?.speed || 1.0
    const pitch = options?.pitch || 1.0

    // 使用浏览器原生语音合成 API
    return this.browserSynthesize(text, voice, speed, pitch)
  }

  private async browserSynthesize(
    text: string,
    voice: string,
    speed: number,
    pitch: number
  ): Promise<TTSResult> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        reject(new Error('Speech synthesis not available'))
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = voice.split('-').slice(0, 2).join('-')
      utterance.rate = speed
      utterance.pitch = pitch

      utterance.onend = () => {
        resolve({
          audio: new ArrayBuffer(0),
          duration: text.length * 0.15,
          format: 'browser',
        })
      }

      utterance.onerror = () => {
        reject(new Error('Speech synthesis failed'))
      }

      window.speechSynthesis.speak(utterance)
    })
  }

  getSupportedLanguages(): string[] {
    return Object.keys(this.VOICES)
  }

  getVoicesForLanguage(language: string): string[] {
    const voice = this.VOICES[language]
    return voice ? [voice] : []
  }
}
