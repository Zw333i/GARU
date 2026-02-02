import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  // Theme
  theme: 'dark' | 'light'
  toggleTheme: () => void
  
  // Sound
  soundEnabled: boolean
  toggleSound: () => void
  
  // Volume (0-1)
  volume: number
  setVolume: (volume: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Default to dark theme
      theme: 'dark',
      toggleTheme: () => set((state) => {
        const newTheme = state.theme === 'dark' ? 'light' : 'dark'
        // Apply theme to document
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('light-mode', newTheme === 'light')
        }
        return { theme: newTheme }
      }),
      
      // Sound enabled by default
      soundEnabled: true,
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      
      // Default volume
      volume: 0.5,
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
    }),
    {
      name: 'garu-settings',
    }
  )
)
