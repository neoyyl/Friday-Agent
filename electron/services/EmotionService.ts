import { ServiceBase } from './ServiceBase'

interface EmotionResult {
  emotion: string
  confidence: number
  details?: Record<string, number>
}

interface EmotionState {
  current: string
  history: Array<{ emotion: string; timestamp: string }>
  intensity: number
}

export class EmotionService extends ServiceBase {
  private state: EmotionState = {
    current: 'neutral',
    history: [],
    intensity: 0.5,
  }

  constructor() {
    super({
      name: 'emotion',
      version: '1.0.0',
      description: 'Text emotion analysis & state tracking',
    })
  }

  async init(): Promise<void> {
    this.setReady()
  }

  async shutdown(): Promise<void> {
    this.state.history = []
    this.ready = false
  }

  analyze(text: string): EmotionResult {
    const lower = text.toLowerCase()
    let emotion = 'neutral'
    let confidence = 0.5

    if (/\b(happy|joy|great|excellent|love|wonderful|amazing)\b/.test(lower)) {
      emotion = 'happy'; confidence = 0.7
    } else if (/\b(sad|unfortunate|sorry|miss|regret|cry)\b/.test(lower)) {
      emotion = 'sad'; confidence = 0.7
    } else if (/\b(angry|furious|annoyed|hate|terrible|awful)\b/.test(lower)) {
      emotion = 'angry'; confidence = 0.8
    } else if (/\b(worried|anxious|nervous|scared|afraid)\b/.test(lower)) {
      emotion = 'anxious'; confidence = 0.7
    } else if (/\b(excited|thrilled|pumped|eager)\b/.test(lower)) {
      emotion = 'excited'; confidence = 0.75
    } else if (/\b(tired|exhausted|sleepy|drained)\b/.test(lower)) {
      emotion = 'tired'; confidence = 0.7
    }

    this.state.current = emotion
    this.state.history.unshift({ emotion, timestamp: new Date().toISOString() })
    if (this.state.history.length > 50) this.state.history = this.state.history.slice(0, 50)

    this.emit('emotion.updated', { current: emotion, intensity: confidence })
    return { emotion, confidence }
  }

  getState(): EmotionState {
    return { ...this.state, history: this.state.history.slice(0, 20) }
  }
}
