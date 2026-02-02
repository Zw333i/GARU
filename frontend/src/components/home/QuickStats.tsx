'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface UserStats {
  gamesPlayed: number
  currentStreak: number
  bestStreak: number
  dailyChallengesCompleted: number
  xp: number
  level: number
}

export function QuickStats() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [stats, setStats] = useState<UserStats>({
    gamesPlayed: 0,
    currentStreak: 0,
    bestStreak: 0,
    dailyChallengesCompleted: 0,
    xp: 0,
    level: 1,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check auth state
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        // Fetch user stats from database
        const { data: userData } = await supabase
          .from('users')
          .select('wins, losses, xp, level, current_streak, best_streak, daily_challenges_completed')
          .eq('id', user.id)
          .single()
        
        if (userData) {
          setStats({
            gamesPlayed: (userData.wins || 0) + (userData.losses || 0),
            currentStreak: userData.current_streak || 0,
            bestStreak: userData.best_streak || 0,
            dailyChallengesCompleted: userData.daily_challenges_completed || 0,
            xp: userData.xp || 0,
            level: userData.level || 1,
          })
        }
        
        // Also fetch game scores count
        const { count } = await supabase
          .from('game_scores')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
        
        if (count) {
          setStats(prev => ({ ...prev, gamesPlayed: count }))
        }
      }
      
      setLoading(false)
    }
    
    checkAuth()
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (session?.user) {
        checkAuth()
      } else {
        setStats({
          gamesPlayed: 0,
          currentStreak: 0,
          bestStreak: 0,
          dailyChallengesCompleted: 0,
          xp: 0,
          level: 1,
        })
      }
    })
    
    return () => subscription.unsubscribe()
  }, [])

  const xpProgress = stats.level > 0 ? (stats.xp % 100) : 0
  const xpToNext = 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass rounded-2xl p-6"
    >
      <h2 className="text-lg font-display font-bold mb-4 flex items-center gap-2">
        <span className="text-xl">🏀</span>
        Your Stats
      </h2>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-6 bg-gunmetal rounded"></div>
          <div className="h-6 bg-gunmetal rounded"></div>
          <div className="h-6 bg-gunmetal rounded"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Games Played */}
          <div className="flex items-center justify-between">
            <span className="text-muted">Games Played</span>
            <span className="font-bold">{stats.gamesPlayed}</span>
          </div>

          {/* Streak */}
          <div className="flex items-center justify-between">
            <span className="text-muted">Current Streak</span>
            <span className="font-bold text-electric-lime">{stats.currentStreak} days</span>
          </div>

          {/* Best Streak */}
          <div className="flex items-center justify-between">
            <span className="text-muted">Best Streak</span>
            <span className="font-bold text-hot-pink">{stats.bestStreak} days</span>
          </div>

          {/* Daily Challenges */}
          <div className="flex items-center justify-between">
            <span className="text-muted">Daily Challenges</span>
            <span className="font-bold">{stats.dailyChallengesCompleted}/30</span>
          </div>

          {/* Progress Bar */}
          <div className="pt-2">
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

          {/* Sign in prompt or user info */}
          <div className="pt-4 border-t border-surface">
            {user ? (
              <div className="text-center">
                <p className="text-sm text-muted mb-2">Signed in as</p>
                <p className="text-electric-lime font-medium truncate">{user.email}</p>
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
