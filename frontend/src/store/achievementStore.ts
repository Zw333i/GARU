import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  xp: number
  unlockedAt?: string
  progress?: number
  maxProgress?: number
}

// Achievement definitions
export const ACHIEVEMENTS: Record<string, Omit<Achievement, 'unlockedAt' | 'progress'>> = {
  FIRST_WIN: {
    id: 'FIRST_WIN',
    name: 'First Victory',
    description: 'Win your first draft battle',
    icon: '🏆',
    xp: 50,
  },
  STREAK_3: {
    id: 'STREAK_3',
    name: 'On a Roll',
    description: 'Win 3 games in a row',
    icon: '🔥',
    xp: 75,
  },
  STREAK_5: {
    id: 'STREAK_5',
    name: 'Unstoppable',
    description: 'Win 5 games in a row',
    icon: '💪',
    xp: 150,
  },
  STREAK_10: {
    id: 'STREAK_10',
    name: 'Legendary Run',
    description: 'Win 10 games in a row',
    icon: '👑',
    xp: 300,
  },
  PERFECT_DRAFT: {
    id: 'PERFECT_DRAFT',
    name: 'Dream Team',
    description: 'Draft a team with 90+ rating',
    icon: '⭐',
    xp: 200,
  },
  STAT_MASTER: {
    id: 'STAT_MASTER',
    name: 'Stat Master',
    description: 'Learn all stat definitions in The Lab',
    icon: '📊',
    xp: 100,
    maxProgress: 15,
  },
  DAILY_WARRIOR: {
    id: 'DAILY_WARRIOR',
    name: 'Daily Warrior',
    description: 'Complete 7 daily challenges',
    icon: '📅',
    xp: 100,
    maxProgress: 7,
  },
  WEEKLY_HERO: {
    id: 'WEEKLY_HERO',
    name: 'Weekly Hero',
    description: 'Complete 30 daily challenges',
    icon: '🦸',
    xp: 300,
    maxProgress: 30,
  },
  JOURNEY_EXPLORER: {
    id: 'JOURNEY_EXPLORER',
    name: 'Journey Explorer',
    description: 'Complete 10 Journey challenges',
    icon: '🗺️',
    xp: 100,
    maxProgress: 10,
  },
  COMPARISON_KING: {
    id: 'COMPARISON_KING',
    name: 'Comparison King',
    description: 'Win 20 Blind Comparison rounds',
    icon: '⚖️',
    xp: 150,
    maxProgress: 20,
  },
  ROLE_PLAYER_PRO: {
    id: 'ROLE_PLAYER_PRO',
    name: 'Role Player Pro',
    description: "Correctly guess 25 players in Who's That",
    icon: '🔍',
    xp: 150,
    maxProgress: 25,
  },
  LEVEL_10: {
    id: 'LEVEL_10',
    name: 'Rising Star',
    description: 'Reach level 10',
    icon: '⬆️',
    xp: 100,
  },
  LEVEL_25: {
    id: 'LEVEL_25',
    name: 'All-Star',
    description: 'Reach level 25',
    icon: '🌟',
    xp: 250,
  },
  LEVEL_50: {
    id: 'LEVEL_50',
    name: 'MVP',
    description: 'Reach level 50',
    icon: '🏅',
    xp: 500,
  },
  WINS_10: {
    id: 'WINS_10',
    name: 'Getting Warmed Up',
    description: 'Win 10 total games',
    icon: '🎯',
    xp: 50,
  },
  WINS_50: {
    id: 'WINS_50',
    name: 'Competitor',
    description: 'Win 50 total games',
    icon: '🎮',
    xp: 150,
  },
  WINS_100: {
    id: 'WINS_100',
    name: 'Champion',
    description: 'Win 100 total games',
    icon: '🏆',
    xp: 300,
  },
}

interface AchievementState {
  unlockedAchievements: Record<string, Achievement>
  progressAchievements: Record<string, number>
  recentUnlock: Achievement | null
  
  // Actions
  unlockAchievement: (achievementId: string) => Achievement | null
  updateProgress: (achievementId: string, progress: number) => Achievement | null
  incrementProgress: (achievementId: string) => Achievement | null
  hasAchievement: (achievementId: string) => boolean
  getProgress: (achievementId: string) => number
  clearRecentUnlock: () => void
  getAllAchievements: () => Achievement[]
}

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      unlockedAchievements: {},
      progressAchievements: {},
      recentUnlock: null,

      unlockAchievement: (achievementId: string) => {
        const state = get()
        if (state.unlockedAchievements[achievementId]) {
          return null // Already unlocked
        }

        const achievementDef = ACHIEVEMENTS[achievementId]
        if (!achievementDef) {
          console.error(`Achievement not found: ${achievementId}`)
          return null
        }

        const achievement: Achievement = {
          ...achievementDef,
          unlockedAt: new Date().toISOString(),
        }

        set((state) => ({
          unlockedAchievements: {
            ...state.unlockedAchievements,
            [achievementId]: achievement,
          },
          recentUnlock: achievement,
        }))

        return achievement
      },

      updateProgress: (achievementId: string, progress: number) => {
        const achievementDef = ACHIEVEMENTS[achievementId]
        if (!achievementDef || !achievementDef.maxProgress) return null

        set((state) => ({
          progressAchievements: {
            ...state.progressAchievements,
            [achievementId]: Math.min(progress, achievementDef.maxProgress!),
          },
        }))

        // Check if achievement should be unlocked
        if (progress >= achievementDef.maxProgress) {
          return get().unlockAchievement(achievementId)
        }

        return null
      },

      incrementProgress: (achievementId: string) => {
        const state = get()
        const currentProgress = state.progressAchievements[achievementId] || 0
        return state.updateProgress(achievementId, currentProgress + 1)
      },

      hasAchievement: (achievementId: string) => {
        return !!get().unlockedAchievements[achievementId]
      },

      getProgress: (achievementId: string) => {
        return get().progressAchievements[achievementId] || 0
      },

      clearRecentUnlock: () => {
        set({ recentUnlock: null })
      },

      getAllAchievements: () => {
        const state = get()
        return Object.values(ACHIEVEMENTS).map((def) => ({
          ...def,
          unlockedAt: state.unlockedAchievements[def.id]?.unlockedAt,
          progress: state.progressAchievements[def.id] || 0,
        }))
      },
    }),
    {
      name: 'garu-achievements',
    }
  )
)
