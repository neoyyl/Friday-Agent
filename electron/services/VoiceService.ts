import { ServiceBase } from './ServiceBase'

interface SpeakerRecord {
  name: string
  alias?: string
  tone?: string
  similarity?: number
}

interface TTSState {
  playing: boolean
  current?: string
  queue: string[]
}

export class VoiceService extends ServiceBase {
  private speakers: SpeakerRecord[] = []
  private currentSpeaker: SpeakerRecord | null = null
  private tts: TTSState = { playing: false, queue: [] }

  constructor() {
    super({
      name: 'voice',
      version: '1.0.0',
      description: 'TTS & speaker management',
    })
  }

  async init(): Promise<void> {
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.tts.playing = false
    this.tts.queue = []
    this.ready = false
  }

  speak(text: string, _tone?: string): { success: boolean } {
    this.tts.queue.push(text)
    this.tts.playing = true
    this.tts.current = text.slice(0, 50)
    this.emit('tts.state', { playing: true, text: this.tts.current })
    setTimeout(() => {
      this.tts.queue.shift()
      this.tts.playing = this.tts.queue.length > 0
      this.tts.current = this.tts.queue[0]?.slice(0, 50)
      this.emit('tts.state', { playing: this.tts.playing })
    }, 2000)
    return { success: true }
  }

  stop(): { success: boolean } {
    this.tts.queue = []
    this.tts.playing = false
    this.tts.current = undefined
    return { success: true }
  }

  queryStatus(): TTSState {
    return { ...this.tts, queue: [...this.tts.queue] }
  }

  getSpeakers(): { speakers: SpeakerRecord[] } {
    return { speakers: [...this.speakers] }
  }

  register(name: string, config?: Record<string, unknown>): SpeakerRecord {
    const speaker: SpeakerRecord = { name, alias: config?.alias as string, tone: config?.tone as string }
    this.speakers.push(speaker)
    this.currentSpeaker = speaker
    this.emit('voice.speaker_registered', { name })
    return speaker
  }

  deleteSpeaker(name: string): { success: boolean } {
    const idx = this.speakers.findIndex((s) => s.name === name)
    if (idx === -1) return { success: false }
    this.speakers.splice(idx, 1)
    if (this.currentSpeaker?.name === name) this.currentSpeaker = null
    return { success: true }
  }

  getCurrentSpeaker(): SpeakerRecord | null {
    return this.currentSpeaker
  }

  identify(_data: unknown): { speaker: string; confidence: number } {
    return { speaker: this.currentSpeaker?.name || 'unknown', confidence: 0.5 }
  }

  transcribe(_audioBase64: string, lang = 'zh'): { text: string; lang: string } {
    return { text: '', lang }
  }
}
