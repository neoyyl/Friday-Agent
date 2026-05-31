import { ServiceBase } from './ServiceBase'

interface EmotionScore {
  emotion: string
  confidence: number
  intensity: number
}

interface EmotionResult {
  primary: EmotionScore
  secondary: EmotionScore[]
  valence: number
  arousal: number
  intensity: number
}

interface EmotionState {
  current: string
  history: Array<{ emotion: string; confidence: number; intensity: number; timestamp: string }>
  trend: string
  dominant_emotion: string
  dominant_count: number
  intensity: number
  valence: number
}

const EMOTION_PATTERNS: Array<{
  emotion: string
  valence: number
  arousal: number
  patterns: RegExp[]
  weight: number
}> = [
  {
    emotion: 'joy', valence: 0.9, arousal: 0.7, weight: 1.0,
    patterns: [/\b(happy|joy|great|excellent|love|wonderful|amazing|delightful|cheerful|thrilled)\b/i],
  },
  {
    emotion: 'sadness', valence: -0.7, arousal: -0.4, weight: 1.0,
    patterns: [/\b(sad|unfortunate|sorry|miss|regret|cry|tears|grief|mourn|lonely)\b/i],
  },
  {
    emotion: 'anger', valence: -0.8, arousal: 0.9, weight: 1.2,
    patterns: [/\b(angry|furious|annoyed|hate|terrible|awful|rage|outrage|irritated)\b/i],
  },
  {
    emotion: 'anxiety', valence: -0.6, arousal: 0.8, weight: 0.9,
    patterns: [/\b(worried|anxious|nervous|scared|afraid|panic|stress|tense|uneasy)\b/i],
  },
  {
    emotion: 'excitement', valence: 0.8, arousal: 0.95, weight: 1.1,
    patterns: [/\b(excited|thrilled|pumped|eager|enthusiastic|ecstatic|overjoyed)\b/i],
  },
  {
    emotion: 'fatigue', valence: -0.3, arousal: -0.7, weight: 0.8,
    patterns: [/\b(tired|exhausted|sleepy|drained|weary|fatigued|worn)\b/i],
  },
  {
    emotion: 'surprise', valence: 0.1, arousal: 0.85, weight: 0.7,
    patterns: [/\b(surpris|shocked|stunned|amazed|astonished|unexpected|wow)\b/i],
  },
  {
    emotion: 'curiosity', valence: 0.4, arousal: 0.5, weight: 0.6,
    patterns: [/\b(curious|wonder|question|investigate|explore|learn|how|why)\b/i],
  },
  {
    emotion: 'gratitude', valence: 0.95, arousal: 0.3, weight: 0.8,
    patterns: [/\b(thank|grateful|appreciate|blessed|thanks|gratitude)\b/i],
  },
  {
    emotion: 'confusion', valence: -0.2, arousal: 0.3, weight: 0.7,
    patterns: [/\b(confus|puzzled|unsure|unclear|baffled|perplexed|what)\b/i],
  },
  {
    emotion: 'pride', valence: 0.7, arousal: 0.6, weight: 0.6,
    patterns: [/\b(proud|accomplish|achieve|success|nailed|mastered)\b/i],
  },
  {
    emotion: 'frustration', valence: -0.6, arousal: 0.7, weight: 0.9,
    patterns: [/\b(frustrat|stuck|blocked|impossible|annoying|dammit|ugh)\b/i],
  },
]

const INTENSITY_BOOSTERS = [/\b(very|extremely|so|really|absolutely|totally|completely|incredibly)\b/i]
const INTENSITY_MODIFIERS = [/\b(slightly|a bit|somewhat|kind of|sort of|a little)\b/i]
const NEGATION_PATTERNS = [/\b(not|n\'t|never|no|nothing)\b/i]

export class EmotionService extends ServiceBase {
  private state: EmotionState = {
    current: 'neutral',
    history: [],
    trend: 'stable',
    dominant_emotion: 'neutral',
    dominant_count: 0,
    intensity: 0.5,
    valence: 0,
  }

  constructor() {
    super({
      name: 'emotion',
      version: '2.0.0',
      description: 'Multi-dimensional emotion analysis with trend tracking',
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
    const negated = this.hasNegation(text)

    const scores: EmotionScore[] = EMOTION_PATTERNS.map((ep) => {
      let matchCount = 0
      for (const pattern of ep.patterns) {
        const matches = lower.match(new RegExp(pattern.source, 'gi'))
        if (matches) matchCount += matches.length
      }
      if (matchCount === 0) return { emotion: ep.emotion, confidence: 0, intensity: 0 }

      let intensity = Math.min(matchCount * 0.15 + 0.35, 1.0)
      intensity *= ep.weight

      for (const booster of INTENSITY_BOOSTERS) {
        if (booster.test(lower)) intensity = Math.min(intensity * 1.4, 1.0)
      }
      for (const modifier of INTENSITY_MODIFIERS) {
        if (modifier.test(lower)) intensity *= 0.6
      }

      let confidence = matchCount > 1 ? 0.8 : 0.55
      if (negated && ep.valence > 0) {
        confidence *= 0.5
        intensity *= 0.5
      }

      return { emotion: ep.emotion, confidence, intensity }
    })

    scores.sort((a, b) => b.intensity * b.confidence - a.intensity * a.confidence)

    const primary = scores[0].confidence > 0
      ? scores[0]
      : { emotion: 'neutral', confidence: 0.5, intensity: 0.3 }

    const secondary = scores
      .filter((s) => s.emotion !== primary.emotion && s.intensity * s.confidence > 0.2)
      .slice(0, 3)
      .map((s) => ({ ...s }))

    let totalValence = 0
    let totalArousal = 0
    let totalWeight = 0

    for (const s of scores) {
      if (s.confidence < 0.2) continue
      const ep = EMOTION_PATTERNS.find((e) => e.emotion === s.emotion)
      if (!ep) continue
      const weight = s.intensity * s.confidence
      totalValence += ep.valence * weight
      totalArousal += ep.arousal * weight
      totalWeight += weight
    }

    const valence = totalWeight > 0 ? totalValence / totalWeight : 0
    const arousal = totalWeight > 0 ? totalArousal / totalWeight : 0
    const intensity = primary.intensity

    this.updateState(primary.emotion, intensity, valence)

    return { primary, secondary, valence, arousal, intensity }
  }

  private hasNegation(text: string): boolean {
    for (const pattern of NEGATION_PATTERNS) {
      if (pattern.test(text)) return true
    }
    return false
  }

  private updateState(emotion: string, intensity: number, valence: number): void {
    const prevEmotion = this.state.current
    this.state.current = emotion
    this.state.intensity = intensity
    this.state.valence = valence

    this.state.history.unshift({
      emotion,
      confidence: intensity > 0.7 ? 0.8 : 0.5,
      intensity,
      timestamp: new Date().toISOString(),
    })

    if (this.state.history.length > 100) {
      this.state.history = this.state.history.slice(0, 100)
    }

    const recent = this.state.history.slice(0, 20)
    const counts = new Map<string, number>()
    for (const entry of recent) {
      counts.set(entry.emotion, (counts.get(entry.emotion) || 0) + 1)
    }
    let maxEmotion = 'neutral'
    let maxCount = 0
    for (const [em, cnt] of counts) {
      if (cnt > maxCount) { maxCount = cnt; maxEmotion = em }
    }
    this.state.dominant_emotion = maxEmotion
    this.state.dominant_count = maxCount

    if (recent.length >= 5) {
      const emotions = recent.slice(0, 5).map((e) => e.emotion)
      const unique = new Set(emotions)
      if (unique.size <= 2 && emotions[0] === emotions[1]) {
        this.state.trend = emotions[0] === prevEmotion ? 'stable' : `shifting_to_${emotion}`
      } else {
        this.state.trend = unique.size >= 4 ? 'volatile' : 'fluctuating'
      }
    }

    this.emit('emotion.updated', {
      current: emotion,
      intensity,
      valence,
      trend: this.state.trend,
    })
  }

  getState(): EmotionState {
    return {
      ...this.state,
      history: this.state.history.slice(0, 20),
    }
  }
}