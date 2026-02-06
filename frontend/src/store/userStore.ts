import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { calculateLevel } from '@/lib/xpUtils'

interface User {
  id: string
  username: string
  avatarUrl?: string
  email?: string
}

interface UserStats {
  gamesPlayed: number
  wins: number
  losses: number
  currentStreak: number
  bestStreak: number
  dailyChallengesCompleted: number
  xp: number
  level: number
}

interface UserState {
  user: User | null
  stats: UserStats
  isAuthenticated: boolean
  
  // Actions
  setUser: (user: User | null) => void
  updateStats: (updates: Partial<UserStats>) => void
  addXP: (amount: number) => void
  incrementStreak: () => void
  resetStreak: () => void
  logout: () => void
}

const initialStats: UserStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  currentStreak: 0,
  bestStreak: 0,
  dailyChallengesCompleted: 0,
  xp: 0,
  level: 1,
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      stats: initialStats,
      isAuthenticated: false,

      setUser: (user) =>
        set({ user, isAuthenticated: !!user }),

      updateStats: (updates) =>
        set((state) => ({
          stats: { ...state.stats, ...updates },
        })),

      addXP: (amount) =>
        set((state) => {
          const newXP = state.stats.xp + amount
          const newLevel = calculateLevel(newXP) // Use proper scaling XP system
          return {
            stats: {
              ...state.stats,
              xp: newXP,
              level: newLevel,
            },
          }
        }),

      incrementStreak: () =>
        set((state) => ({
          stats: {
            ...state.stats,
            currentStreak: state.stats.currentStreak + 1,
            bestStreak: Math.max(state.stats.bestStreak, state.stats.currentStreak + 1),
          },
        })),

      resetStreak: () =>
        set((state) => ({
          stats: { ...state.stats, currentStreak: 0 },
        })),

      logout: () =>
        set({ user: null, isAuthenticated: false, stats: initialStats }),
    }),
    {
      name: 'garu-user-storage',
    }
  )
)
