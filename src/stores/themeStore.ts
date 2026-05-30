import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeName = 'midnight' | 'phosphor' | 'violet' | 'rose' | 'arctic' | 'sand'

interface ThemeState {
  currentTheme: ThemeName
  setTheme: (theme: ThemeName) => void
  cycleTheme: () => void
}

const THEMES: ThemeName[] = ['midnight', 'phosphor', 'violet', 'rose', 'arctic', 'sand']

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      currentTheme: 'midnight',

      setTheme: (theme: ThemeName) => {
        set({ currentTheme: theme })
      },

      cycleTheme: () => {
        const { currentTheme } = get()
        const currentIndex = THEMES.indexOf(currentTheme)
        const nextIndex = (currentIndex + 1) % THEMES.length
        const nextTheme = THEMES[nextIndex]
        set({ currentTheme: nextTheme })
      },
    }),
    {
      name: 'friday-theme',
    }
  )
)

/** Keep for external reference; theme DOM is managed by ThemingProvider */
export const THEME_LIST = THEMES
