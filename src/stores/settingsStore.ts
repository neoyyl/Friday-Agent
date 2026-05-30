import { create } from 'zustand'

export interface Settings {
  // 旧的单提供商配置（保留兼容）
  apiKey: string
  model: string
  
  // 新的多提供商配置
  provider: string
  providerConfigs: Record<string, Record<string, string>>
  
  // 外观设置
  theme: 'light' | 'dark' | 'system'
  
  // 生成设置
  temperature: string
  maxTokens: string
  
  // 安全设置
  sandboxEnabled: boolean
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
        setSettings(settings as Partial<Settings>)
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
      await window.electronAPI!.settings.update(newSettings as Record<string, string>)
      setSettings(newSettings)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  },
}))
