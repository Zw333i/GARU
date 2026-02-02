'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settingsStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useSettingsStore()

  useEffect(() => {
    // Apply theme class to html element
    const root = document.documentElement
    
    if (theme === 'light') {
      root.classList.add('light-mode')
    } else {
      root.classList.remove('light-mode')
    }
  }, [theme])

  return <>{children}</>
}
