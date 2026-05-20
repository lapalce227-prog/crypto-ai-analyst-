import { createContext, useState, useEffect, useContext, useCallback } from 'react'

const THEME_KEY = 'laplace-theme'

function getSystemPreference() {
  const hour = new Date().getHours()
  return hour >= 18 || hour < 6 ? 'dark' : 'light'
}

function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'dark' || stored === 'light') return stored
    if (stored === 'auto') return 'auto'
  } catch {}
  return 'auto'
}

export const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => getStoredTheme())

  const resolved = mode === 'auto' ? getSystemPreference() : mode

  useEffect(() => {
    const root = document.documentElement
    if (resolved === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [resolved])

  // 自动模式每隔一分钟检查时间（跨 18:00 时自动切）
  useEffect(() => {
    if (mode !== 'auto') return
    const interval = setInterval(() => {
      const now = getSystemPreference()
      const root = document.documentElement
      if (now === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [mode])

  const setTheme = useCallback((m) => {
    setMode(m)
    try { localStorage.setItem(THEME_KEY, m) } catch {}
  }, [])

  const toggle = useCallback(() => {
    const current = mode === 'auto' ? getSystemPreference() : mode
    setTheme(current === 'dark' ? 'light' : 'dark')
  }, [mode, setTheme])

  return (
    <ThemeContext.Provider value={{ mode, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
