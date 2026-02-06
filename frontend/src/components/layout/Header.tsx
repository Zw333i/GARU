'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { useAuthStore } from '@/store/authStore'
import { useSessionDataStore } from '@/store/sessionDataStore'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  SunIcon, 
  MoonIcon, 
  VolumeOnIcon, 
  VolumeOffIcon,
  BasketballIcon
} from '@/components/icons'
import { AuthButton } from '@/components/auth/AuthButton'

interface Notification {
  id: string
  type: 'achievement' | 'game' | 'streak' | 'level'
  message: string
  time: string
  read: boolean
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function Header() {
  const { theme, toggleTheme, soundEnabled, toggleSound } = useSettingsStore()
  const { user, isAuthenticated } = useAuthStore()
  const { gameHistory, achievements, isStatsLoaded } = useSessionDataStore()
  
  const [mounted, setMounted] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const notifRef = useRef<HTMLDivElement>(null)

  // Load read notification IDs from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('garu_read_notifications')
      if (stored) {
        setReadIds(new Set(JSON.parse(stored)))
      }
    }
  }, [])

  // Build notifications from real data
  useEffect(() => {
    if (!isAuthenticated || !isStatsLoaded) {
      setNotifications([])
      return
    }

    const notifs: Notification[] = []

    // Add recent game notifications (last 5 games)
    gameHistory.slice(0, 5).forEach((game) => {
      const gameTypeNames: Record<string, string> = {
        'whos-that': "Who's That?",
        'the-journey': 'The Journey',
        'blind-comparison': 'Blind Comparison',
        'stat-attack': 'Stat Attack',
      }
      const gameName = gameTypeNames[game.gameType] || game.gameType
      
      notifs.push({
        id: `game-${game.id}`,
        type: 'game',
        message: `You scored ${game.score} points in ${gameName}!`,
        time: formatRelativeTime(game.createdAt),
        read: readIds.has(`game-${game.id}`),
      })
    })

    // Add achievement notifications
    achievements
      .filter(a => a.unlocked && a.unlocked_at)
      .sort((a, b) => new Date(b.unlocked_at!).getTime() - new Date(a.unlocked_at!).getTime())
      .slice(0, 3)
      .forEach((achievement) => {
        const achievementNames: Record<string, string> = {
          'first_game': 'First Steps',
          'ten_games': 'Getting Started',
          'hundred_games': 'Dedicated Player',
          'first_win': 'Winner!',
          'streak_3': '3-Day Streak',
          'streak_7': 'Week Warrior',
          'perfect_round': 'Perfect Round',
        }
        const name = achievementNames[achievement.achievement_type] || achievement.achievement_type
        
        notifs.push({
          id: `achievement-${achievement.id}`,
          type: 'achievement',
          message: `Achievement unlocked: ${name}!`,
          time: achievement.unlocked_at ? formatRelativeTime(achievement.unlocked_at) : 'Recently',
          read: readIds.has(`achievement-${achievement.id}`),
        })
      })

    // Sort by recency (unread first, then by time)
    notifs.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1
      return 0
    })

    setNotifications(notifs)
  }, [gameHistory, achievements, isStatsLoaded, isAuthenticated, readIds])

  const unreadCount = notifications.filter(n => !n.read).length

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
    // Apply theme on mount
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('light-mode', theme === 'light')
    }
  }, [theme])

  // Close notifications on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id)
    const newReadIds = new Set([...readIds, ...allIds])
    setReadIds(newReadIds)
    localStorage.setItem('garu_read_notifications', JSON.stringify([...newReadIds]))
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  const markAsRead = (id: string) => {
    const newReadIds = new Set([...readIds, id])
    setReadIds(newReadIds)
    localStorage.setItem('garu_read_notifications', JSON.stringify([...newReadIds]))
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n))
  }

  return (
    <header className="sticky top-0 z-40 glass border-b border-surface/50">
      <div className="flex items-center justify-between px-4 py-3 md:px-8 md:ml-20">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-electric-lime to-green-600 flex items-center justify-center">
            <BasketballIcon size={24} className="text-deep-void" />
          </div>
          <span className="font-display font-bold text-xl hidden sm:block">
            GARU
          </span>
        </Link>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={toggleTheme}
              className="p-2 text-muted hover:text-ghost-white transition-colors rounded-lg hover:bg-surface"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <SunIcon size={20} />
              ) : (
                <MoonIcon size={20} />
              )}
            </button>
          )}

          {/* Sound Toggle */}
          {mounted && (
            <button
              onClick={toggleSound}
              className="p-2 text-muted hover:text-ghost-white transition-colors rounded-lg hover:bg-surface"
              title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundEnabled ? (
                <VolumeOnIcon size={20} />
              ) : (
                <VolumeOffIcon size={20} />
              )}
            </button>
          )}

          {/* Notifications - Only show when logged in */}
          {isAuthenticated && (
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-muted hover:text-ghost-white transition-colors relative rounded-lg hover:bg-surface"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-hot-pink rounded-full text-[10px] flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-12 w-80 bg-gunmetal border border-surface rounded-xl shadow-2xl overflow-hidden z-[100]"
                  >
                    <div className="p-3 border-b border-surface flex justify-between items-center">
                      <h3 className="font-display font-bold text-sm">Notifications</h3>
                      {unreadCount > 0 && (
                        <button 
                          onClick={markAllAsRead}
                          className="text-xs text-electric-lime hover:underline"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-muted">
                          <p>No notifications yet</p>
                          <p className="text-xs mt-1">Play games to see your activity here!</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id}
                            onClick={() => markAsRead(notif.id)}
                            className={`p-3 border-b border-surface/50 hover:bg-surface/50 transition-colors flex items-start gap-3 cursor-pointer ${
                              !notif.read ? 'bg-surface/30' : ''
                            }`}
                          >
                            <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                              notif.type === 'achievement' ? 'bg-yellow-400' :
                              notif.type === 'game' ? 'bg-electric-lime' :
                              notif.type === 'streak' ? 'bg-hot-pink' :
                              'bg-blue-400'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-ghost-white">{notif.message}</p>
                              <p className="text-xs text-muted mt-1">{notif.time}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    
                    <div className="p-2 border-t border-surface">
                      <Link 
                        href="/profile"
                        className="block text-center text-sm text-muted hover:text-electric-lime transition-colors py-2"
                        onClick={() => setShowNotifications(false)}
                      >
                        View profile
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Auth/Profile */}
          <AuthButton />
        </div>
      </div>
    </header>
  )
}
