import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({
  theme: 'light',
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
})

const THEME_STORAGE_KEY = 'ib_theme_preference'

export function ThemeProvider({ children }) {
  // Default to 'light' mode so light theme is cleanly applied first
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) || 'light'
    } catch {
      return 'light'
    }
  })

  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem(THEME_STORAGE_KEY) || 'light'
    if (stored === 'dark') return true
    if (stored === 'light') return false
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      let activeIsDark = false
      if (theme === 'dark') {
        activeIsDark = true
      } else if (theme === 'light') {
        activeIsDark = false
      } else {
        activeIsDark = mediaQuery.matches
      }

      setIsDark(activeIsDark)
      if (activeIsDark) {
        root.classList.add('dark')
        body?.classList.add('dark')
        root.setAttribute('data-theme', 'dark')
      } else {
        root.classList.remove('dark')
        body?.classList.remove('dark')
        root.setAttribute('data-theme', 'light')
      }
    }

    applyTheme()

    const handleSystemChange = (e) => {
      if (theme === 'system') {
        setIsDark(e.matches)
        if (e.matches) {
          root.classList.add('dark')
          body?.classList.add('dark')
          root.setAttribute('data-theme', 'dark')
        } else {
          root.classList.remove('dark')
          body?.classList.remove('dark')
          root.setAttribute('data-theme', 'light')
        }
      }
    }

    mediaQuery.addEventListener('change', handleSystemChange)
    return () => mediaQuery.removeEventListener('change', handleSystemChange)
  }, [theme])

  const setTheme = (newTheme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    } catch (e) {
      console.warn('Could not persist theme', e)
    }
  }

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark'
    setTheme(nextTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
