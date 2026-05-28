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
        applyTheme(theme)
      },

      cycleTheme: () => {
        const { currentTheme } = get()
        const currentIndex = THEMES.indexOf(currentTheme)
        const nextIndex = (currentIndex + 1) % THEMES.length
        const nextTheme = THEMES[nextIndex]
        set({ currentTheme: nextTheme })
        applyTheme(nextTheme)
      },
    }),
    {
      name: 'friday-theme',
      onRehydrateStorage: () => {
        return (state) => {
          if (state?.currentTheme) {
            applyTheme(state.currentTheme)
          }
        }
      },
    }
  )
)

function applyTheme(theme: ThemeName) {
  const root = document.documentElement
  if (theme === 'midnight') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', theme)
  }
}

export const THEMES_CONFIG = THEMES.map((theme) => ({
  name: theme,
  label: theme.charAt(0).toUpperCase() + theme.slice(1),
}))
