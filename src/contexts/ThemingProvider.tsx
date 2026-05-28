import { useEffect, ReactNode } from 'react'
import { useThemeStore } from '../stores/themeStore'

interface ThemingProviderProps {
  children: ReactNode
}

export function ThemingProvider({ children }: ThemingProviderProps) {
  const { currentTheme } = useThemeStore()

  useEffect(() => {
    const root = document.documentElement
    if (currentTheme === 'midnight') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', currentTheme)
    }
  }, [currentTheme])

  return <>{children}</>
}
