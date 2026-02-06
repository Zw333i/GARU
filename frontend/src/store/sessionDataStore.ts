/**
 * Session Data Store - Centralized session-based data management
 * Fetches user stats, achievements, and game history ONCE per session
 * Persists to sessionStorage so data survives page refreshes
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { UserAchievement } from '@/lib/supabase'
import { calculateLevel } from '@/lib/xpUtils'

// User stats from database
export interface UserStats {
  gamesPlayed: number
  wins: number
  losses: number
  winRate: number
  currentStreak: number
  bestStreak: number
  dailyChallengesCompleted: number
  xp: number
  level: number
}

// Game history entry
export interface GameHistoryEntry {
  id: string
  gameType: string
  score: number
  correctAnswers: number
  questionsAnswered: number
  timeTaken: number
  createdAt: string
}

interface SessionDataState {
  // User stats
  userStats: UserStats | null
  achievements: UserAchievement[]
  gameHistory: GameHistoryEntry[]
  
  // Status flags
  isStatsLoaded: boolean
  isStatsLoading: boolean
  statsLastFetchedAt: number | null
  statsError: string | null
  
  // Current user ID (to invalidate cache on user change)
  userId: string | null
  
  // Actions
  fetchUserStats: (userId: string) => Promise<void>
  refreshStats: () => Promise<void>
  updateLocalStats: (updates: Partial<UserStats>) => void
  addGameToHistory: (game: GameHistoryEntry) => void
  clearSession: () => void
}

const initialStats: UserStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  currentStreak: 0,
  bestStreak: 0,
  dailyChallengesCompleted: 0,
  xp: 0,
  level: 1,
}

// Session storage adapter
const sessionStorageAdapter = {
  getItem: (name: string): string | null => {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(name)
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(name, value)
  },
  removeItem: (name: string): void => {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(name)
  },
}

export const useSessionDataStore = create<SessionDataState>()(
  persist(
    (set, get) => ({
      userStats: null,
      achievements: [],
      gameHistory: [],
      isStatsLoaded: false,
      isStatsLoading: false,
      statsLastFetchedAt: null,
      statsError: null,
      userId: null,

      fetchUserStats: async (userId: string) => {
        const state = get()
        
        // If different user, clear cache
        if (state.userId && state.userId !== userId) {
          console.log('👤 User changed, clearing session cache')
          set({
            userStats: null,
            achievements: [],
            gameHistory: [],
            isStatsLoaded: false,
            userId: null,
          })
        }
        
        // Skip if already loaded for this user
        if (state.isStatsLoaded && state.userId === userId) {
          console.log('📦 User stats already cached, skipping fetch')
          return
        }
        
        // Skip if currently loading
        if (state.isStatsLoading) {
          return
        }

        set({ isStatsLoading: true, statsError: null, userId })
        console.log('📊 Fetching user stats from database...')

        try {
          // Fetch user stats
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('xp, level, wins, losses, current_streak, best_streak, games_played, daily_challenges_completed')
            .eq('id', userId)
            .single()

          let stats = { ...initialStats }
          
          if (!userError && userData) {
            const wins = userData.wins || 0
            const losses = userData.losses || 0
            const total = wins + losses
            
            stats = {
              gamesPlayed: userData.games_played || 0,
              wins,
              losses,
              winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
              currentStreak: userData.current_streak || 0,
              bestStreak: userData.best_streak || 0,
              dailyChallengesCompleted: userData.daily_challenges_completed || 0,
              xp: userData.xp || 0,
              level: userData.level || 1,
            }
          }

          // Fetch achievements
          let achievements: UserAchievement[] = []
          try {
            const { data: achievementData } = await supabase
              .from('user_achievements')
              .select('*')
              .eq('user_id', userId)
            
            if (achievementData) {
              achievements = achievementData as UserAchievement[]
            }
          } catch {
            // Achievements table might not exist
          }

          // Fetch recent game history
          let gameHistory: GameHistoryEntry[] = []
          try {
            const { data: historyData } = await supabase
              .from('game_scores')
              .select('*')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(20)
            
            if (historyData) {
              gameHistory = historyData.map((g: any) => ({
                id: g.id,
                gameType: g.game_type,
                score: g.score,
                correctAnswers: g.correct_answers || 0,
                questionsAnswered: g.questions_answered || 0,
                timeTaken: g.time_taken || 0,
                createdAt: g.created_at,
              }))
            }
          } catch {
            // Game history table might not exist
          }

          console.log(`✅ Loaded user stats (Level ${stats.level}, ${stats.gamesPlayed} games)`)
          
          set({
            userStats: stats,
            achievements,
            gameHistory,
            isStatsLoaded: true,
            isStatsLoading: false,
            statsLastFetchedAt: Date.now(),
          })
        } catch (err) {
          console.error('Error fetching user stats:', err)
          set({
            userStats: initialStats,
            isStatsLoaded: true,
            isStatsLoading: false,
            statsError: err instanceof Error ? err.message : 'Failed to fetch stats',
          })
        }
      },

      refreshStats: async () => {
        const { userId } = get()
        if (!userId) return
        
        // Force refresh by resetting loaded state
        set({ isStatsLoaded: false })
        await get().fetchUserStats(userId)
      },

      updateLocalStats: (updates: Partial<UserStats>) => {
        const { userStats } = get()
        if (!userStats) return
        
        set({
          userStats: { ...userStats, ...updates },
        })
      },

      addGameToHistory: (game: GameHistoryEntry) => {
        const { gameHistory, userStats } = get()
        
        // Add to front of history
        const newHistory = [game, ...gameHistory].slice(0, 20)
        
        // Update local stats
        if (userStats) {
          const isWin = game.correctAnswers >= game.questionsAnswered / 2
          const newXP = userStats.xp + game.score
          set({
            gameHistory: newHistory,
            userStats: {
              ...userStats,
              gamesPlayed: userStats.gamesPlayed + 1,
              wins: userStats.wins + (isWin ? 1 : 0),
              losses: userStats.losses + (isWin ? 0 : 1),
              xp: newXP,
              level: calculateLevel(newXP), // Use proper scaling XP system
              currentStreak: isWin ? userStats.currentStreak + 1 : 0,
              bestStreak: isWin ? Math.max(userStats.bestStreak, userStats.currentStreak + 1) : userStats.bestStreak,
            },
          })
        } else {
          set({ gameHistory: newHistory })
        }
      },

      clearSession: () => {
        set({
          userStats: null,
          achievements: [],
          gameHistory: [],
          isStatsLoaded: false,
          isStatsLoading: false,
          statsLastFetchedAt: null,
          statsError: null,
          userId: null,
        })
      },
    }),
    {
      name: 'garu-session-data',
      storage: createJSONStorage(() => sessionStorageAdapter),
      partialize: (state) => ({
        userStats: state.userStats,
        achievements: state.achievements,
        gameHistory: state.gameHistory,
        isStatsLoaded: state.isStatsLoaded,
        statsLastFetchedAt: state.statsLastFetchedAt,
        userId: state.userId,
      }),
    }
  )
)
