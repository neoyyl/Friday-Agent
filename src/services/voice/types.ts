/**
 * 语音服务类型定义
 */

export interface ASROptions {
  language?: string
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large'
  useCloud?: boolean
}

export interface ASRResult {
  text: string
  confidence: number
  language: string
  duration: number
}

export interface TTSOptions {
  voice?: string
  speed?: number
  pitch?: number
  format?: 'mp3' | 'wav' | 'ogg'
}

export interface TTSResult {
  audio: ArrayBuffer
  duration: number
  format: string
}

export interface VoiceProvider {
  id: string
  name: string
  type: 'asr' | 'tts'
  enabled: boolean
  languages?: string[]
}

export interface VoiceConfig {
  asrProvider: string
  ttsProvider: string
  defaultLanguage: string
  defaultVoice: string
  autoSpeak: boolean
}

export type VoiceEventType =
  | 'recording-start'
  | 'recording-stop'
  | 'transcribing'
  | 'transcribe-complete'
  | 'speaking-start'
  | 'speaking-stop'
  | 'error'

export interface VoiceEvent {
  type: VoiceEventType
  data?: any
  error?: string
}

export interface IVoiceProvider {
  id: string
  name: string
  type: 'asr' | 'tts'
  enabled: boolean
  transcribe?(audio: ArrayBuffer, options?: ASROptions): Promise<ASRResult>
  synthesize?(text: string, options?: TTSOptions): Promise<TTSResult>
  getSupportedLanguages?(): string[]
}

export interface RecordingOptions {
  sampleRate?: number
  channels?: number
  format?: 'pcm' | 'wav'
  maxDuration?: number
}
