import { create } from 'zustand'

export type EmotionType = 'happy' | 'sad' | 'angry' | 'fear' | 'surprise' | 'neutral' | 'disgust' | 'anticipation'

export interface EmotionResult {
  emotion: EmotionType
  confidence: number
  valence?: number  // -1 to 1
  arousal?: number  // 0 to 1
}

export interface EmotionFlowEntry {
  timestamp: string
  emotion: EmotionType
  confidence: number
}

interface EmotionState {
  currentEmotion: EmotionType | null
  confidence: number
  conversationFlow: EmotionFlowEntry[]
  isAnalyzing: boolean

  analyze: (text: string) => Promise<EmotionResult | null>
  getState: () => Promise<void>
  addToFlow: (emotion: EmotionType, confidence: number) => void
  clearFlow: () => void
}

export const useEmotionStore = create<EmotionState>((set, get) => ({
  currentEmotion: null,
  confidence: 0,
  conversationFlow: [],
  isAnalyzing: false,

  analyze: async (text: string) => {
    set({ isAnalyzing: true })
    try {
      const result = await window.electronAPI!.backend.emotion.analyze(text)
      if (result && !result.error) {
        const d = result.data as Record<string, unknown> | undefined
        const emotion: EmotionResult = {
          emotion: (d?.emotion || d?.dominant_emotion || 'neutral') as EmotionType,
          confidence: (d?.confidence as number) || 0.5,
          valence: d?.valence as number | undefined,
          arousal: d?.arousal as number | undefined,
        }
        set({
          currentEmotion: emotion.emotion,
          confidence: emotion.confidence,
        })
        get().addToFlow(emotion.emotion, emotion.confidence)
        return emotion
      }
      return null
    } catch (e) {
      console.error('Emotion analysis failed:', e)
      return null
    } finally {
      set({ isAnalyzing: false })
    }
  },

  getState: async () => {
    try {
      const result = await window.electronAPI!.backend.emotion.state()
      if (result && !result.error) {
        const d = result.data as Record<string, unknown> | undefined
        set({
          currentEmotion: (d?.emotion || d?.dominant_emotion || null) as EmotionType | null,
          confidence: (d?.confidence as number) || 0,
        })
      }
    } catch (e) {
      console.error('Failed to get emotion state:', e)
    }
  },

  addToFlow: (emotion: EmotionType, confidence: number) => {
    set((s) => ({
      conversationFlow: [
        ...s.conversationFlow,
        { timestamp: new Date().toISOString(), emotion, confidence },
      ].slice(-50), // Keep last 50 entries
    }))
  },

  clearFlow: () => set({ conversationFlow: [] }),
}))
