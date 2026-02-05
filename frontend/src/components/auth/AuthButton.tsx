'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useUserStore } from '@/store/userStore'
import { ProfileIcon, LogoutIcon, GoogleIcon } from '@/components/icons'

export function AuthButton() {
  const { user, isAuthenticated, setUser, logout } = useUserStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser({
          id: session.user.id,
          username: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Player',
          email: session.user.email,
          avatarUrl: session.user.user_metadata?.avatar_url,
        })
      }
    }
    checkSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          username: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Player',
          email: session.user.email,
          avatarUrl: session.user.user_metadata?.avatar_url,
        })
      } else {
        logout()
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser, logout])

  const signInWithGoogle = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (error) {
      console.error('Error signing in:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      await supabase.auth.signOut()
      logout()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setIsLoading(false)
      setShowDropdown(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <motion.button
        onClick={signInWithGoogle}
        disabled={isLoading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-4 py-2 bg-white text-gray-800 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
      >
        <GoogleIcon size={18} />
        {isLoading ? 'Signing in...' : 'Sign in'}
      </motion.button>
    )
  }

  return (
    <div className="relative">
      <motion.button
        onClick={() => setShowDropdown(!showDropdown)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-3 py-2 glass rounded-lg"
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="w-7 h-7 rounded-full"
          />
        ) : (
          <ProfileIcon size={20} className="text-electric-lime" />
        )}
        <span className="hidden md:block text-sm font-medium max-w-[120px] truncate">
          {user?.username}
        </span>
      </motion.button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-48 glass rounded-xl overflow-hidden shadow-xl z-50"
          >
            <div className="px-4 py-3 border-b border-surface">
              <p className="text-sm font-medium">{user?.username}</p>
              <p className="text-xs text-muted truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="w-full px-4 py-3 flex items-center gap-2 text-sm text-hot-pink hover:bg-white/5 transition-colors"
            >
              <LogoutIcon size={16} />
              {isLoading ? 'Signing out...' : 'Sign out'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
