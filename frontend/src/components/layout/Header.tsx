'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSettingsStore } from '@/store/settingsStore'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  SearchIcon, 
  SunIcon, 
  MoonIcon, 
  VolumeOnIcon, 
  VolumeOffIcon,
  ProfileIcon,
  BasketballIcon
} from '@/components/icons'
import { supabase } from '@/lib/supabase'

// Mock notifications
const mockNotifications = [
  { id: 1, type: 'achievement', message: 'New achievement unlocked: First Steps!', time: '2h ago', read: false },
  { id: 2, type: 'challenge', message: 'Daily challenge is ready!', time: '5h ago', read: false },
  { id: 3, type: 'update', message: 'New players added to The Lab', time: '1d ago', read: true },
  { id: 4, type: 'streak', message: 'Keep your streak going! Play today.', time: '1d ago', read: true },
]

interface SearchResult {
  id: number
  name: string
  team: string
}

export function Header() {
  const router = useRouter()
  const { theme, toggleTheme, soundEnabled, toggleSound } = useSettingsStore()
  const [mounted, setMounted] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState(mockNotifications)
  const notifRef = useRef<HTMLDivElement>(null)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search players in Supabase
  // Local search fallback when database unavailable
  const SEARCH_FALLBACK: SearchResult[] = [
    { id: 203999, name: 'Nikola Jokic', team: 'DEN' },
    { id: 1629029, name: 'Luka Doncic', team: 'DAL' },
    { id: 203507, name: 'Giannis Antetokounmpo', team: 'MIL' },
    { id: 1628369, name: 'Jayson Tatum', team: 'BOS' },
    { id: 201939, name: 'Stephen Curry', team: 'GSW' },
    { id: 2544, name: 'LeBron James', team: 'LAL' },
    { id: 201142, name: 'Kevin Durant', team: 'PHX' },
    { id: 1628983, name: 'Shai Gilgeous-Alexander', team: 'OKC' },
    { id: 1630162, name: 'Anthony Edwards', team: 'MIN' },
    { id: 977, name: 'Kobe Bryant', team: 'LAL' },
    { id: 2548, name: 'Dwyane Wade', team: 'MIA' },
    { id: 1899, name: 'Allen Iverson', team: 'PHI' },
  ]

  const searchPlayers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }
    
    setIsSearching(true)
    try {
      const { data, error } = await supabase
        .from('cached_players')
        .select('player_id, player_name, team_abbreviation')
        .ilike('player_name', `%${query}%`)
        .limit(8)
      
      if (error) {
        // Fallback to local search
        const localResults = SEARCH_FALLBACK.filter(p => 
          p.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5)
        setSearchResults(localResults)
        setShowSearchResults(localResults.length > 0)
        return
      }
      
      const results: SearchResult[] = (data || []).map((p: { player_id: number; player_name: string; team_abbreviation: string | null }) => ({
        id: p.player_id,
        name: p.player_name,
        team: p.team_abbreviation || ''
      }))
      
      setSearchResults(results)
      setShowSearchResults(results.length > 0)
    } catch {
      // Fallback to local search silently
      const localResults = SEARCH_FALLBACK.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
      setSearchResults(localResults)
      setShowSearchResults(localResults.length > 0)
    } finally {
      setIsSearching(false)
    }
  }

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchPlayers(value)
    }, 300)
  }

  // Navigate to Lab with selected player
  const selectPlayer = (player: SearchResult) => {
    setSearchQuery('')
    setShowSearchResults(false)
    router.push(`/lab?player=${player.id}`)
  }

  // Handle enter key in search
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchResults.length > 0) {
      selectPlayer(searchResults[0])
    }
  }

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  const clearNotification = (id: number) => {
    setNotifications(notifications.filter(n => n.id !== id))
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

        {/* Search Bar - Desktop */}
        <div className="hidden md:flex flex-1 max-w-md mx-8" ref={searchRef}>
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
              placeholder="Search players..."
              className="w-full px-4 py-2 pl-10 bg-gunmetal border border-surface rounded-lg text-ghost-white placeholder-muted focus:outline-none focus:border-electric-lime transition-colors"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-electric-lime border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            
            {/* Search Results Dropdown */}
            <AnimatePresence>
              {showSearchResults && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-gunmetal border border-surface rounded-xl shadow-2xl overflow-hidden z-50"
                >
                  {searchResults.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => selectPlayer(player)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface transition-colors text-left"
                    >
                      <img
                        src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.id}.png`}
                        alt={player.name}
                        className="w-8 h-8 rounded-full object-cover bg-surface"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder-player.png'
                        }}
                      />
                      <div>
                        <p className="text-ghost-white font-medium">{player.name}</p>
                        <p className="text-xs text-muted">{player.team}</p>
                      </div>
                    </button>
                  ))}
                  <div className="px-4 py-2 border-t border-surface bg-surface/30">
                    <p className="text-xs text-muted text-center">
                      Press Enter or click to view in Lab
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

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

          {/* Notifications */}
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
                  {unreadCount}
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
                  className="absolute right-0 top-12 w-80 bg-gunmetal border border-surface rounded-xl shadow-2xl overflow-hidden z-50"
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
                        <p>No notifications</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id}
                          className={`p-3 border-b border-surface/50 hover:bg-surface/50 transition-colors flex items-start gap-3 ${
                            !notif.read ? 'bg-surface/30' : ''
                          }`}
                        >
                          <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                            notif.type === 'achievement' ? 'bg-yellow-400' :
                            notif.type === 'challenge' ? 'bg-electric-lime' :
                            notif.type === 'streak' ? 'bg-hot-pink' :
                            'bg-blue-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-ghost-white">{notif.message}</p>
                            <p className="text-xs text-muted mt-1">{notif.time}</p>
                          </div>
                          <button 
                            onClick={() => clearNotification(notif.id)}
                            className="text-muted hover:text-hot-pink transition-colors text-lg leading-none"
                          >
                            ×
                          </button>
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
                      View all notifications
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Profile */}
          <Link 
            href="/profile" 
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-surface transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-hot-pink to-purple-600 flex items-center justify-center overflow-hidden">
              <ProfileIcon size={18} className="text-ghost-white" />
            </div>
          </Link>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="md:hidden px-4 pb-3">
        <div className="relative w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
            placeholder="Search players..."
            className="w-full px-4 py-2 pl-10 bg-gunmetal border border-surface rounded-lg text-ghost-white placeholder-muted focus:outline-none focus:border-electric-lime transition-colors text-sm"
          />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          
          {/* Mobile Search Results */}
          <AnimatePresence>
            {showSearchResults && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-gunmetal border border-surface rounded-xl shadow-2xl overflow-hidden z-50"
              >
                {searchResults.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => selectPlayer(player)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface transition-colors text-left"
                  >
                    <img
                      src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.id}.png`}
                      alt={player.name}
                      className="w-8 h-8 rounded-full object-cover bg-surface"
                    />
                    <div>
                      <p className="text-ghost-white font-medium text-sm">{player.name}</p>
                      <p className="text-xs text-muted">{player.team}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
