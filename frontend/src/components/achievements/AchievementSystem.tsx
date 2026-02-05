'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAchievementStore, Achievement, ACHIEVEMENTS } from '@/store/achievementStore'
import { TrophyIcon, CheckIcon } from '@/components/icons'

// Toast notification for newly unlocked achievement
export function AchievementToast() {
  const { recentUnlock, clearRecentUnlock } = useAchievementStore()

  useEffect(() => {
    if (recentUnlock) {
      const timer = setTimeout(() => {
        clearRecentUnlock()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [recentUnlock, clearRecentUnlock])

  return (
    <AnimatePresence>
      {recentUnlock && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="glass rounded-2xl p-4 flex items-center gap-4 shadow-2xl border border-electric-lime/30">
            <div className="text-4xl">{recentUnlock.icon}</div>
            <div>
              <p className="text-sm text-electric-lime font-medium">
                🎉 Achievement Unlocked!
              </p>
              <p className="font-display font-bold text-lg">
                {recentUnlock.name}
              </p>
              <p className="text-sm text-muted">{recentUnlock.description}</p>
            </div>
            <div className="px-3 py-1 bg-electric-lime/20 rounded-lg">
              <span className="text-electric-lime font-bold">
                +{recentUnlock.xp} XP
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Achievement card for profile/achievements page
interface AchievementCardProps {
  achievement: Achievement
  isUnlocked: boolean
  progress?: number
}

export function AchievementCard({
  achievement,
  isUnlocked,
  progress = 0,
}: AchievementCardProps) {
  const progressPercent = achievement.maxProgress
    ? (progress / achievement.maxProgress) * 100
    : 0

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`relative glass rounded-xl p-4 transition-all ${
        isUnlocked
          ? 'border border-electric-lime/30'
          : 'opacity-60 grayscale'
      }`}
    >
      {/* Unlocked badge */}
      {isUnlocked && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-electric-lime rounded-full flex items-center justify-center">
          <CheckIcon size={14} className="text-deep-void" />
        </div>
      )}

      <div className="flex items-start gap-4">
        <div
          className={`text-3xl p-2 rounded-lg ${
            isUnlocked ? 'bg-electric-lime/20' : 'bg-gunmetal'
          }`}
        >
          {achievement.icon}
        </div>
        <div className="flex-1">
          <h4 className="font-medium">{achievement.name}</h4>
          <p className="text-sm text-muted">{achievement.description}</p>

          {/* Progress bar for progressive achievements */}
          {achievement.maxProgress && !isUnlocked && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>Progress</span>
                <span>
                  {progress}/{achievement.maxProgress}
                </span>
              </div>
              <div className="h-2 bg-gunmetal rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  className="h-full bg-electric-lime rounded-full"
                />
              </div>
            </div>
          )}

          {/* XP reward */}
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                isUnlocked
                  ? 'bg-electric-lime/20 text-electric-lime'
                  : 'bg-gunmetal text-muted'
              }`}
            >
              {achievement.xp} XP
            </span>
            {isUnlocked && achievement.unlockedAt && (
              <span className="text-xs text-muted">
                {new Date(achievement.unlockedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Full achievements grid/page component
export function AchievementsGrid() {
  const { getAllAchievements, hasAchievement, getProgress } =
    useAchievementStore()

  const achievements = getAllAchievements()
  const unlockedCount = achievements.filter((a) => a.unlockedAt).length
  const totalCount = achievements.length

  return (
    <div>
      {/* Summary */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <TrophyIcon size={24} className="text-electric-lime" />
          <span className="text-2xl font-display font-bold">
            {unlockedCount}/{totalCount}
          </span>
        </div>
        <div className="flex-1 h-2 bg-gunmetal rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(unlockedCount / totalCount) * 100}%` }}
            className="h-full bg-electric-lime rounded-full"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {achievements.map((achievement) => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
            isUnlocked={!!achievement.unlockedAt}
            progress={achievement.progress}
          />
        ))}
      </div>
    </div>
  )
}
