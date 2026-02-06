'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { signInWithGoogle, signOut, ACHIEVEMENTS, UserAchievement, supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useSessionDataStore } from '@/store/sessionDataStore'
import { getXPProgress } from '@/lib/xpUtils'
import {
  BasketballIcon,
  ChartIcon,
  TrophyIcon,
  FireIcon,
  CrownIcon,
  TargetIcon,
  StarIcon,
  BabyIcon,
  CheckIcon,
  GamepadIcon,
  ClockIcon
} from '@/components/icons'

// Map achievement types to icons
const achievementIcons: Record<string, React.FC<{ size?: number; className?: string }>> = {
  first_steps: BabyIcon,
  streak_master: FireIcon,
  draft_king: CrownIcon,
  role_player_expert: TargetIcon,
  stat_nerd: ChartIcon,
  perfect_week: StarIcon,
}

export default function ProfilePage() {
  // Use centralized auth and session data stores
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const { 
    userStats: sessionStats, 
    achievements: sessionAchievements,
    isStatsLoaded, 
    isStatsLoading, 
    fetchUserStats 
  } = useSessionDataStore()

  const loading = authLoading
  const isGuest = !isAuthenticated
  
  // Convert session stats to local format
  const userStats = sessionStats ? {
    gamesPlayed: sessionStats.gamesPlayed,
    wins: sessionStats.wins,
    losses: sessionStats.losses,
    winRate: sessionStats.wins + sessionStats.losses > 0 
      ? sessionStats.winRate 
      : '--' as string | number,
    currentStreak: sessionStats.currentStreak,
    bestStreak: sessionStats.bestStreak,
    dailyChallenges: sessionStats.dailyChallengesCompleted,
    xp: sessionStats.xp,
    level: sessionStats.level,
  } : {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    winRate: '--' as string | number,
    currentStreak: 0,
    bestStreak: 0,
    dailyChallenges: 0,
    xp: 0,
    level: 1,
  }
  
  const userAchievements = sessionAchievements
  
  // Use proper XP scaling system
  const xpData = useMemo(() => getXPProgress(userStats.xp), [userStats.xp])
  
  // Avatar upload state
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Fetch custom avatar URL from database
  useEffect(() => {
    if (user?.id) {
      const fetchAvatar = async () => {
        const { data } = await supabase
          .from('users')
          .select('avatar_url')
          .eq('id', user.id)
          .single()
        if (data?.avatar_url) {
          setCustomAvatarUrl(data.avatar_url)
        }
      }
      fetchAvatar()
    }
  }, [user?.id])
  
  // Get the avatar to display (custom > Google > default)
  const displayAvatarUrl = customAvatarUrl || user?.user_metadata?.avatar_url
  
  // Handle avatar upload
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return
    
    // Validate file
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      setUploadError('Image must be less than 2MB')
      return
    }
    
    setIsUploading(true)
    setUploadError(null)
    
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const filePath = `${user.id}.${fileExt}`  // Just filename, bucket is 'avatars'
      
      // Delete existing avatar first to avoid conflicts
      await supabase.storage
        .from('avatars')
        .remove([filePath])
      
      const { error: storageError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })
      
      if (storageError) {
        console.error('Storage error:', storageError)
        throw new Error(storageError.message)
      }
      
      // Get public URL with cache bust
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)
      
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`
      
      // Update user profile in database
      const { error: dbError } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)
      
      if (dbError) {
        console.error('DB update error:', dbError)
        throw new Error(dbError.message)
      }
      
      // Force state update with new URL
      setCustomAvatarUrl(null) // Clear first
      setTimeout(() => {
        setCustomAvatarUrl(avatarUrl)
        setIsUploading(false)
      }, 100)
      
      console.log('✅ Avatar uploaded successfully:', avatarUrl)
      return // Exit early since we set isUploading in setTimeout
    } catch (err) {
      console.error('Avatar upload failed:', err)
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
      setIsUploading(false)
    }
  }

  // Fetch stats when user is authenticated (uses session cache)
  useEffect(() => {
    if (user && isAuthenticated && !isStatsLoaded && !isStatsLoading) {
      fetchUserStats(user.id)
    }
  }, [user, isAuthenticated, isStatsLoaded, isStatsLoading, fetchUserStats])

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Sign in error:', error)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  // Build achievements with real progress
  const achievements = ACHIEVEMENTS.map(a => {
    const userAchievement = userAchievements.find(ua => ua.achievement_type === a.type)
    const Icon = achievementIcons[a.type] || StarIcon
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      earned: userAchievement?.unlocked || false,
      progress: userAchievement?.progress || 0,
      threshold: a.threshold,
      Icon,
    }
  })

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 mb-6"
      >
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Avatar with upload functionality */}
          <div className="relative group">
            <div 
              className={`w-24 h-24 rounded-full flex items-center justify-center overflow-hidden cursor-pointer transition-all ${
                isAuthenticated ? 'hover:ring-2 hover:ring-electric-lime' : ''
              } ${isUploading ? 'opacity-50' : ''}`}
              onClick={() => isAuthenticated && fileInputRef.current?.click()}
            >
              {displayAvatarUrl ? (
                <img 
                  src={displayAvatarUrl} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-electric-lime to-green-600 flex items-center justify-center">
                  <BasketballIcon size={48} className="text-deep-void" />
                </div>
              )}
            </div>
            
            {/* Upload overlay on hover */}
            {isAuthenticated && (
              <div 
                className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="text-xs text-white font-medium">
                  {isUploading ? 'Uploading...' : 'Change'}
                </span>
              </div>
            )}
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          
          {/* Upload error message */}
          {uploadError && (
            <p className="text-red-400 text-xs mt-1">{uploadError}</p>
          )}

          {/* User Info */}
          <div className="flex-1 text-center md:text-left">
            {loading ? (
              <p className="text-muted">Loading...</p>
            ) : isGuest ? (
              <>
                <h1 className="text-2xl font-display font-bold mb-1">Guest Player</h1>
                <p className="text-muted mb-4">Sign in to save your progress and compete on leaderboards</p>
                <button 
                  onClick={handleGoogleSignIn}
                  className="px-6 py-2 bg-electric-lime text-deep-void font-bold rounded-lg hover:bg-green-400 transition-colors flex items-center gap-2 mx-auto md:mx-0"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                  <h1 className="text-2xl font-display font-bold">{user?.user_metadata?.full_name || user?.email}</h1>
                </div>
                <p className="text-muted mb-2">Level {xpData.level} • {userStats.xp} Total XP</p>
                <button onClick={handleSignOut} className="text-sm text-muted hover:text-hot-pink transition-colors">
                  Sign out
                </button>
              </>
            )}
          </div>

          {/* Level Progress */}
          <div className="w-full md:w-48">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted">Level {xpData.level}</span>
              <span className="text-muted">{xpData.currentXP}/{xpData.requiredXP} XP</span>
            </div>
            <div className="h-3 bg-gunmetal rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-electric-lime to-green-400 rounded-full transition-all"
                style={{ width: `${xpData.progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-lg font-display font-bold mb-4 flex items-center gap-2">
            <ChartIcon size={20} className="text-electric-lime" /> Statistics
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gunmetal rounded-xl p-4 text-center">
              <p className="text-3xl font-display font-bold text-electric-lime">{userStats.wins}</p>
              <p className="text-sm text-muted">Wins</p>
            </div>
            <div className="bg-gunmetal rounded-xl p-4 text-center">
              <p className="text-3xl font-display font-bold text-hot-pink">{userStats.losses}</p>
              <p className="text-sm text-muted">Losses</p>
            </div>
            <div className="bg-gunmetal rounded-xl p-4 text-center">
              <p className="text-3xl font-display font-bold">{userStats.gamesPlayed}</p>
              <p className="text-sm text-muted">Games</p>
            </div>
            <div className="bg-gunmetal rounded-xl p-4 text-center">
              <p className="text-3xl font-display font-bold">{userStats.winRate}</p>
              <p className="text-sm text-muted">Win Rate</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-surface">
            <div className="flex justify-between items-center mb-2">
              <span className="text-muted">Current Streak</span>
              <span className="font-bold text-electric-lime">{userStats.currentStreak} days</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-muted">Best Streak</span>
              <span className="font-bold">{userStats.bestStreak} days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Daily Challenges</span>
              <span className="font-bold">{userStats.dailyChallenges}/30</span>
            </div>
          </div>
        </motion.div>

        {/* Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 glass rounded-2xl p-6"
        >
          <h2 className="text-lg font-display font-bold mb-4 flex items-center gap-2">
            <TrophyIcon size={20} className="text-yellow-400" /> Achievements
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  achievement.earned
                    ? 'bg-electric-lime/10 border border-electric-lime/30'
                    : 'bg-gunmetal'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  achievement.earned ? 'bg-electric-lime/20' : 'bg-surface'
                }`}>
                  <achievement.Icon size={24} className={achievement.earned ? 'text-electric-lime' : 'text-muted'} />
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${achievement.earned ? 'text-ghost-white' : 'text-muted'}`}>
                    {achievement.name}
                  </p>
                  <p className="text-xs text-muted">{achievement.description}</p>
                  {!achievement.earned && achievement.progress > 0 && (
                    <div className="mt-1">
                      <div className="h-1 bg-surface rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-electric-lime/50 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (achievement.progress / achievement.threshold) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted mt-0.5">{achievement.progress}/{achievement.threshold}</p>
                    </div>
                  )}
                </div>
                {achievement.earned && (
                  <CheckIcon size={20} className="text-electric-lime" />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-3 glass rounded-2xl p-6"
        >
          <h2 className="text-lg font-display font-bold mb-4 flex items-center gap-2">
            <ClockIcon size={20} className="text-blue-400" /> Recent Activity
          </h2>
          
          <div className="text-center py-8 text-muted">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gunmetal flex items-center justify-center">
              <GamepadIcon size={32} className="text-muted" />
            </div>
            <p>No recent activity</p>
            <p className="text-sm mt-1">Start playing to see your history here!</p>
            <Link
              href="/play"
              className="inline-block mt-4 px-6 py-2 bg-electric-lime text-deep-void font-bold rounded-lg hover:bg-green-400 transition-colors"
            >
              Play Now
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
