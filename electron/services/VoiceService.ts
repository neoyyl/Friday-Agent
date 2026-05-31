import { exec, execSync } from 'child_process'
import os from 'os'
import { ServiceBase } from './ServiceBase'

interface SpeakerRecord {
  name: string
  alias?: string
  tone?: string
  similarity?: number
  samples: number
  registered_at: string
}

interface SpeakerSample {
  features: number[]
  label: string
}

interface TTSState {
  playing: boolean
  current?: string
  queue: string[]
  platform: string
  engine: string
}

export class VoiceService extends ServiceBase {
  private speakers: SpeakerRecord[] = []
  private currentSpeaker: SpeakerRecord | null = null
  private speakerSamples: SpeakerSample[] = []
  private tts: TTSState = { playing: false, queue: [], platform: os.platform(), engine: 'native' }
  private activeProcess: ReturnType<typeof exec> | null = null

  constructor() {
    super({
      name: 'voice',
      version: '2.0.0',
      description: 'Platform-native TTS & speaker management',
    })
  }

  async init(): Promise<void> {
    this.tts.platform = os.platform()
    this.tts.engine = this.detectTTSEngine()
    this.setReady()
  }

  async shutdown(): Promise<void> {
    if (this.activeProcess) {
      this.activeProcess.kill()
      this.activeProcess = null
    }
    this.tts.playing = false
    this.tts.queue = []
    this.ready = false
  }

  private detectTTSEngine(): string {
    const platform = os.platform()
    if (platform === 'darwin') return 'say'
    if (platform === 'win32') try {
      execSync('powershell -Command "Get-Command Add-Type"', { stdio: 'ignore', timeout: 3000 })
      return 'powershell-sapi'
    } catch { return 'none' }
    try {
      execSync('which espeak', { stdio: 'ignore', timeout: 3000 })
      return 'espeak'
    } catch { return 'none' }
  }

  speak(text: string, tone?: string): { success: boolean; engine: string } {
    if (!text.trim()) return { success: false, engine: this.tts.engine }

    if (this.tts.playing && this.activeProcess) {
      this.tts.queue.push(text)
      return { success: true, engine: this.tts.engine }
    }

    this.tts.playing = true
    this.tts.current = text.slice(0, 100)
    this.emit('tts.state', { playing: true, text: this.tts.current })

    const rate = tone === 'slow' ? 2 : tone === 'fast' ? 6 : 4

    try {
      if (this.tts.engine === 'say') {
        this.execTTS(`say "${this.escapeText(text)}"`)
      } else if (this.tts.engine === 'powershell-sapi') {
        const psScript = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = ${rate - 2}; $s.Speak('${this.escapeText(text)}')`
        this.execTTS(`powershell -NoProfile -Command "${psScript}"`)
      } else if (this.tts.engine === 'espeak') {
        this.execTTS(`espeak "${this.escapeText(text)}"`)
      } else {
        this.finishSpeak()
      }
    } catch {
      this.finishSpeak()
    }

    return { success: true, engine: this.tts.engine }
  }

  private execTTS(command: string): void {
    this.activeProcess = exec(command, { timeout: 30000 }, (err) => {
      if (err && err.killed !== true) {
        console.error('[VoiceService] TTS error:', err.message)
      }
      this.finishSpeak()
    })
  }

  private escapeText(text: string): string {
    return text.replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/\n/g, ' ')
  }

  private finishSpeak(): void {
    this.activeProcess = null
    this.tts.queue.shift()
    if (this.tts.queue.length > 0) {
      const next = this.tts.queue[0]
      this.tts.current = next.slice(0, 100)
      this.speak(next)
    } else {
      this.tts.playing = false
      this.tts.current = undefined
      this.emit('tts.state', { playing: false })
    }
  }

  stop(): { success: boolean } {
    if (this.activeProcess) {
      this.activeProcess.kill()
      this.activeProcess = null
    }
    this.tts.queue = []
    this.tts.playing = false
    this.tts.current = undefined
    this.emit('tts.state', { playing: false })
    return { success: true }
  }

  queryStatus(): TTSState {
    return { ...this.tts, queue: [...this.tts.queue] }
  }

  getSpeakers(): { speakers: SpeakerRecord[] } {
    return { speakers: [...this.speakers] }
  }

  register(name: string, config?: Record<string, unknown>): SpeakerRecord {
    const speaker: SpeakerRecord = {
      name,
      alias: config?.alias as string,
      tone: config?.tone as string || 'default',
      samples: 0,
      registered_at: new Date().toISOString(),
    }
    this.speakers.push(speaker)
    if (!this.currentSpeaker) this.currentSpeaker = speaker
    this.emit('voice.speaker_registered', { name, tone: speaker.tone })
    return speaker
  }

  deleteSpeaker(name: string): { success: boolean } {
    const idx = this.speakers.findIndex((s) => s.name === name)
    if (idx === -1) return { success: false }
    this.speakers.splice(idx, 1)
    this.speakerSamples = this.speakerSamples.filter((s) => s.label !== name)
    if (this.currentSpeaker?.name === name) {
      this.currentSpeaker = this.speakers.length > 0 ? this.speakers[0] : null
    }
    this.emit('voice.speaker_removed', { name })
    return { success: true }
  }

  getCurrentSpeaker(): SpeakerRecord | null {
    return this.currentSpeaker
  }

  enroll(name: string, features: number[]): { success: boolean } {
    const speaker = this.speakers.find((s) => s.name === name)
    if (!speaker) return { success: false }
    this.speakerSamples.push({ label: name, features })
    speaker.samples++
    this.emit('voice.sample_added', { name, samples: speaker.samples })
    return { success: true }
  }

  identify(data: unknown): { speaker: string; confidence: number; possible: string[] } {
    const features = Array.isArray(data) ? data as number[] : null

    if (features && this.speakerSamples.length > 0 && this.speakers.length > 1) {
      const scores = this.speakers.map((speaker) => {
        const samples = this.speakerSamples.filter((s) => s.label === speaker.name)
        if (samples.length === 0) return { speaker: speaker.name, similarity: 0 }
        let totalSim = 0
        for (const sample of samples) {
          totalSim += this.cosineSimilarity(features, sample.features)
        }
        return { speaker: speaker.name, similarity: totalSim / samples.length }
      })

      scores.sort((a, b) => b.similarity - a.similarity)
      const best = scores[0]
      this.currentSpeaker = this.speakers.find((s) => s.name === best.speaker) || this.currentSpeaker

      return {
        speaker: best.speaker,
        confidence: Math.min(best.similarity, 1),
        possible: scores.slice(0, 3).filter((s) => s.similarity > 0.3).map((s) => s.speaker),
      }
    }

    return {
      speaker: this.currentSpeaker?.name || 'unknown',
      confidence: 0.5,
      possible: this.speakers.map((s) => s.name),
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0
    let dot = 0, normA = 0, normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    if (normA === 0 || normB === 0) return 0
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  transcribe(_audioBase64: string, lang = 'zh'): { text: string; lang: string; engine: string; note: string } {
    return {
      text: '',
      lang,
      engine: 'none',
      note: 'ASR requires whisper binary or cloud API. Configure in settings.',
    }
  }
}