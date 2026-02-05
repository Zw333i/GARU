'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import { useSessionDataStore } from '@/store/sessionDataStore'
import { FireIcon, TrophyIcon } from '@/components/icons'

// NBA Trivia facts
const NBA_TRIVIA = [
  "Wilt Chamberlain scored 100 points in a single game in 1962.",
  "The shortest player in NBA history was Muggsy Bogues at 5'3\".",
  "Michael Jordan was cut from his high school varsity team.",
  "Kareem Abdul-Jabbar is the all-time leading scorer with 38,387 points.",
  "The Boston Celtics have won the most championships (17).",
  "LeBron James passed Kareem as scoring leader in 2023.",
  "Stephen Curry revolutionized the 3-point shot in the modern era.",
  "The NBA was founded on June 6, 1946 in New York City.",
  "Shaq made only 1 three-pointer in his entire 19-year career.",
  "Tim Duncan was drafted after winning a coin flip.",
  "Kobe Bryant entered the NBA straight from high school at 17.",
  "The longest game in NBA history went 6 overtimes.",
  "Dennis Rodman led the league in rebounds for 7 straight years.",
  "Magic Johnson won Finals MVP as a rookie in 1980.",
  "The Dream Team (1992) featured Jordan, Magic, and Bird together.",
]

// Get a trivia based on the day
function getDailyTrivia(): string {
  const dayOfYear = Math.floor(
    (new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  )
  return NBA_TRIVIA[dayOfYear % NBA_TRIVIA.length]
}

export function QuickStats() {
  // Use centralized auth and session data stores
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const { userStats, achievements, isStatsLoaded, isStatsLoading, fetchUserStats } = useSessionDataStore()
  const [trivia, setTrivia] = useState<string>('')

  // Set trivia on mount (client-side only)
  useEffect(() => {
    setTrivia(getDailyTrivia())
  }, [])

  // Fetch stats when user is authenticated (uses session cache)
  useEffect(() => {
    if (user && isAuthenticated && !isStatsLoaded && !isStatsLoading) {
      fetchUserStats(user.id)
    }
  }, [user, isAuthenticated, isStatsLoaded, isStatsLoading, fetchUserStats])

  // Calculate achievements count
  const achievementsUnlocked = useMemo(() => {
    return achievements.filter(a => a.unlocked).length
  }, [achievements])
  
  const totalAchievements = 10 // Total possible achievements

  // Default stats when not logged in
  const stats = userStats || {
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

  const loading = authLoading || isStatsLoading
  const xpProgress = stats.level > 0 ? (stats.xp % 100) : 0
  const xpToNext = 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass rounded-2xl p-6 h-full flex flex-col"
    >
      <h2 className="text-lg font-display font-bold mb-4 flex items-center gap-2">
        <FireIcon size={20} className="text-electric-lime" />
        Your Stats
      </h2>

      {loading ? (
        <div className="space-y-4 animate-pulse flex-1">
          <div className="h-6 bg-gunmetal rounded"></div>
          <div className="h-6 bg-gunmetal rounded"></div>
          <div className="h-6 bg-gunmetal rounded"></div>
        </div>
      ) : (
        <div className="flex flex-col flex-1">
          {/* Stats Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted">Games Played</span>
              <span className="font-bold">{stats.gamesPlayed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Wins</span>
              <span className="font-bold text-electric-lime">{stats.wins}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Losses</span>
              <span className="font-bold text-hot-pink">{stats.losses}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Win Rate</span>
              <span className="font-bold">{stats.winRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Best Streak</span>
              <span className="font-bold text-orange-400">{stats.bestStreak} days</span>
            </div>
          </div>

          {/* Achievements Section */}
          <div className="mt-4 pt-4 border-t border-surface">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrophyIcon size={16} className="text-yellow-400" />
                <span className="text-muted">Achievements</span>
              </div>
              <span className="font-bold">{achievementsUnlocked}/{totalAchievements}</span>
            </div>
            <Link 
              href="/profile#achievements"
              className="text-xs text-electric-lime hover:underline"
            >
              View All →
            </Link>
          </div>

          {/* NBA Trivia Section */}
          <div className="mt-4 pt-4 border-t border-surface">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">💡</span>
              <span className="text-muted text-sm font-medium">NBA Trivia</span>
            </div>
            <p className="text-xs text-ghost-white/80 leading-relaxed">
              {trivia}
            </p>
          </div>

          {/* Level Progress */}
          <div className="mt-4 pt-4 border-t border-surface">
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>Level {stats.level}</span>
              <span>{xpProgress}/{xpToNext} XP</span>
            </div>
            <div className="h-2 bg-gunmetal rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-electric-lime to-green-400 rounded-full transition-all duration-500"
                style={{ width: `${(xpProgress / xpToNext) * 100}%` }}
              />
            </div>
          </div>

          {/* Sign in prompt or user info - Always at bottom */}
          <div className="mt-auto pt-4 border-t border-surface">
            {user ? (
              <div className="text-center">
                <p className="text-sm text-muted mb-1">Signed in as</p>
                <p className="text-electric-lime font-medium truncate text-sm">{user.email}</p>
              </div>
            ) : (
              <Link 
                href="/profile"
                className="block w-full py-2 text-sm text-center text-electric-lime border border-electric-lime rounded-lg hover:bg-electric-lime/10 transition-colors"
              >
                Sign in to save progress
              </Link>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
