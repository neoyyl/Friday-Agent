/**
 * 语音管理器
 * 管理语音识别和语音合成服务
 */

import { EventEmitter } from 'events'
import {
  ASROptions,
  ASRResult,
  TTSOptions,
  TTSResult,
  VoiceProvider,
  VoiceConfig,
  VoiceEvent,
  VoiceEventType,
  IVoiceProvider,
} from './types'

export class VoiceManager extends EventEmitter {
  private providers: Map<string, IVoiceProvider> = new Map()
  private config: VoiceConfig
  private isRecording: boolean = false
  private isSpeaking: boolean = false

  constructor(config?: Partial<VoiceConfig>) {
    super()
    this.config = {
      asrProvider: 'whisper-local',
      ttsProvider: 'edge-tts',
      defaultLanguage: 'zh-CN',
      defaultVoice: 'zh-CN-XiaoxiaoNeural',
      autoSpeak: true,
      ...config,
    }
  }

  // 注册语音提供商
  registerProvider(provider: IVoiceProvider): void {
    this.providers.set(provider.id, provider)
  }

  // 获取提供商
  getProvider(id: string): IVoiceProvider | undefined {
    return this.providers.get(id)
  }

  // 获取所有提供商
  getAllProviders(): VoiceProvider[] {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      enabled: p.enabled,
    }))
  }

  // 获取 ASR 提供商
  private getASRProvider(_providerId?: string): IVoiceProvider | undefined {
    const id = _providerId || this.config.asrProvider
    const provider = this.providers.get(id)
    if (provider && provider.type === 'asr' && provider.enabled) {
      return provider
    }
    return Array.from(this.providers.values()).find(
      (p) => p.type === 'asr' && p.enabled
    )
  }

  // 获取 TTS 提供商
  private getTTSProvider(_providerId?: string): IVoiceProvider | undefined {
    const id = _providerId || this.config.ttsProvider
    const provider = this.providers.get(id)
    if (provider && provider.type === 'tts' && provider.enabled) {
      return provider
    }
    return Array.from(this.providers.values()).find(
      (p) => p.type === 'tts' && p.enabled
    )
  }

  // 语音识别
  async transcribe(audio: ArrayBuffer, options?: ASROptions): Promise<ASRResult> {
    const provider = this.getASRProvider(options?.useCloud ? 'whisper-cloud' : undefined)

    if (!provider || !provider.transcribe) {
      throw new Error('No ASR provider available')
    }

    this.emitEvent('transcribing')

    try {
      const result = await provider.transcribe(audio, {
        language: options?.language || this.config.defaultLanguage,
        model: options?.model,
      })

      this.emitEvent('transcribe-complete', result)
      return result
    } catch (error) {
      this.emitEvent('error', undefined, error instanceof Error ? error.message : 'Transcription failed')
      throw error
    }
  }

  // 语音合成
  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    const provider = this.getTTSProvider()

    if (!provider || !provider.synthesize) {
      throw new Error('No TTS provider available')
    }

    this.emitEvent('speaking-start')

    try {
      const result = await provider.synthesize(text, {
        voice: options?.voice || this.config.defaultVoice,
        speed: options?.speed,
        pitch: options?.pitch,
        format: options?.format || 'mp3',
      })

      this.emitEvent('speaking-stop')
      return result
    } catch (error) {
      this.emitEvent('error', undefined, error instanceof Error ? error.message : 'Synthesis failed')
      throw error
    }
  }

  // 开始录音（浏览器环境）
  async startRecording(_options?: any): Promise<MediaRecorder> {
    if (this.isRecording) {
      throw new Error('Already recording')
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      this.isRecording = true
      this.emitEvent('recording-start')

      mediaRecorder.onstop = () => {
        this.isRecording = false
        this.emitEvent('recording-stop')
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      return mediaRecorder
    } catch (error) {
      this.emitEvent('error', undefined, 'Failed to start recording')
      throw error
    }
  }

  // 停止录音
  stopRecording(mediaRecorder: MediaRecorder): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' })
          const buffer = await blob.arrayBuffer()
          resolve(buffer)
        } catch (error) {
          reject(error)
        }
      }

      mediaRecorder.onerror = () => {
        reject(new Error('Recording failed'))
      }

      mediaRecorder.stop()
    })
  }

  // 播放音频（浏览器环境）
  async playAudio(audio: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([audio], { type: 'audio/mp3' })
      const url = URL.createObjectURL(blob)
      const audioElement = new Audio(url)

      audioElement.onended = () => {
        URL.revokeObjectURL(url)
        this.isSpeaking = false
        this.emitEvent('speaking-stop')
        resolve()
      }

      audioElement.onerror = () => {
        URL.revokeObjectURL(url)
        this.isSpeaking = false
        this.emitEvent('error', undefined, 'Audio playback failed')
        reject(new Error('Audio playback failed'))
      }

      this.isSpeaking = true
      audioElement.play()
    })
  }

  // 快捷方法：语音转文本
  async speechToText(audio: ArrayBuffer, language?: string): Promise<string> {
    const result = await this.transcribe(audio, { language })
    return result.text
  }

  // 快捷方法：文本转语音并播放
  async textToSpeech(text: string, autoPlay: boolean = true): Promise<TTSResult> {
    const result = await this.synthesize(text)

    if (autoPlay) {
      await this.playAudio(result.audio)
    }

    return result
  }

  // 快捷方法：通过 Backend ASR 识别语音（Electron 环境）
  async recognizeViaBackend(audioBase64: string, lang?: string): Promise<string> {
    const voice = window.electronAPI?.backend?.voice
    if (!voice?.transcribe) throw new Error('Backend ASR not available')
    const result = await voice.transcribe(audioBase64, lang)
    if (result.error) throw new Error(result.error)
    return result.data?.text || ''
  }

  async speakViaBackend(text: string, tone?: string): Promise<void> {
    const voice = window.electronAPI?.backend?.voice
    if (!voice?.speak) throw new Error('Backend TTS not available')
    const result = await voice.speak(text, tone)
    if (result.error) throw new Error(result.error)
  }

  // 配置管理
  getConfig(): VoiceConfig {
    return { ...this.config }
  }

  updateConfig(config: Partial<VoiceConfig>): void {
    this.config = { ...this.config, ...config }
  }

  // 状态检查
  getIsRecording(): boolean {
    return this.isRecording
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking
  }

  // 事件发射
  private emitEvent(type: VoiceEventType, data?: any, error?: string): void {
    const event: VoiceEvent = { type, data, error }
    this.emit(type, event)
    this.emit('voice-event', event)
  }
}

// 单例实例
let managerInstance: VoiceManager | null = null

export function getVoiceManager(config?: Partial<VoiceConfig>): VoiceManager {
  if (!managerInstance) {
    managerInstance = new VoiceManager(config)
  } else if (config) {
    managerInstance.updateConfig(config)
  }
  return managerInstance
}
