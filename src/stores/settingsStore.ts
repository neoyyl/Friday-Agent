import { create } from 'zustand'

export interface Settings {
  apiKey: string
  model: string

  provider: string
  providerConfigs: Record<string, Record<string, string>>

  theme: 'light' | 'dark' | 'system'

  temperature: string
  maxTokens: string

  sandboxEnabled: boolean

  voiceLang: string
  voiceAutoSend: boolean
  voiceThreshold: string

  ttsProvider: string
  ttsVoice: string

  displayMode: 'graph' | 'cloud' | 'none'

  // 向后兼容
  showGraph?: boolean

  onboardingCompleted: boolean
}

interface SettingsState {
  settings: Settings
  isLoading: boolean

  // Actions
  setSettings: (settings: Partial<Settings>) => void
  setLoading: (loading: boolean) => void

  // Async actions
  loadSettings: () => Promise<void>
  saveSettings: (settings: Partial<Settings>) => Promise<void>
}

const BOOLEAN_KEYS = new Set(['sandboxEnabled', 'voiceAutoSend'])

function serializeSettings(settings: Partial<Settings>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(settings)) {
    if (key === 'providerConfigs') {
      result[key] = JSON.stringify(value)
    } else {
      result[key] = String(value ?? '')
    }
  }
  return result
}

function deserializeSettings(raw: Record<string, string>): Partial<Settings> {
  const result: Record<string, unknown> = { ...raw }
  for (const key of BOOLEAN_KEYS) {
    if (key in result) {
      result[key] = result[key] === 'true'
    }
  }
  // 处理旧的 showGraph 字段向后兼容
  if (result.showGraph !== undefined && typeof result.showGraph === 'string') {
    result.showGraph = result.showGraph === 'true'
  }
  // 处理 displayMode 枚举，或者从 showGraph 迁移
  if (result.displayMode && typeof result.displayMode === 'string') {
    const validModes: Array<'graph' | 'cloud' | 'none'> = ['graph', 'cloud', 'none']
    if (!validModes.includes(result.displayMode as typeof validModes[number])) {
      result.displayMode = 'cloud'
    }
  } else if (result.showGraph !== undefined) {
    // 如果没有 displayMode 但是有旧的 showGraph，进行迁移
    result.displayMode = result.showGraph ? 'graph' : 'none'
  }
  if (result.providerConfigs && typeof result.providerConfigs === 'string') {
    try {
      result.providerConfigs = JSON.parse(result.providerConfigs)
    } catch {
      result.providerConfigs = { openai: {} }
    }
  }
  return result as Partial<Settings>
}

const defaultSettings: Settings = {
  apiKey: '',
  model: 'gpt-4o',
  provider: 'openai',
  providerConfigs: {
    openai: {},
  },
  theme: 'light',
  temperature: '0.7',
  maxTokens: '4096',
  sandboxEnabled: true,
  voiceLang: 'zh-CN',
  voiceAutoSend: true,
  voiceThreshold: '0.008',
  ttsProvider: 'openai',
  ttsVoice: 'alloy',
  displayMode: 'cloud',
  onboardingCompleted: false,
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  isLoading: false,

  setSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }))
  },

  setLoading: (loading) => set({ isLoading: loading }),

  loadSettings: async () => {
    const { setLoading, setSettings } = get()
    setLoading(true)
    try {
      const settings = await window.electronAPI!.settings.get()
      if (settings) {
        setSettings(deserializeSettings(settings as Record<string, string>))
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  },

  saveSettings: async (newSettings) => {
    const { setSettings } = get()
    try {
      const serialized = serializeSettings(newSettings)
      await window.electronAPI!.settings.update(serialized)
      setSettings(newSettings)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  },
}))
