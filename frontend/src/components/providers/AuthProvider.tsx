'use client'

import { useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useUserStore } from '@/store/userStore'
import { useAuthStore } from '@/store/authStore'
import { usePlayersStore } from '@/store/playersStore'
import { useSessionDataStore } from '@/store/sessionDataStore'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useUserStore((state) => state.setUser)
  const updateStats = useUserStore((state) => state.updateStats)
  const logout = useUserStore((state) => state.logout)
  
  // Centralized auth state
  const { setSession, setLoading } = useAuthStore()
  
  // Session data stores
  const fetchPlayers = usePlayersStore((state) => state.fetchPlayers)
  const fetchUserStats = useSessionDataStore((state) => state.fetchUserStats)
  const clearSessionData = useSessionDataStore((state) => state.clearSession)

  // Load user stats from Supabase (legacy - still sync to userStore)
  const loadUserStats = useCallback(async (userId: string) => {
    try {
      // Fetch user stats using session store (cached)
      await fetchUserStats(userId)
      
      // Also sync to legacy userStore for components that use it
      const { data: userData } = await supabase
        .from('users')
        .select('wins, losses, xp, level, current_streak, best_streak, daily_challenges_completed, games_played')
        .eq('id', userId)
        .single()
      
      if (userData) {
        const gamesFromDb = userData.games_played || 0
        const gamesFromWinsLosses = (userData.wins || 0) + (userData.losses || 0)
        
        updateStats({
          gamesPlayed: gamesFromDb > 0 ? gamesFromDb : gamesFromWinsLosses,
          currentStreak: userData.current_streak || 0,
          bestStreak: userData.best_streak || 0,
          dailyChallengesCompleted: userData.daily_challenges_completed || 0,
          xp: userData.xp || 0,
          level: userData.level || 1,
        })
      }
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }, [fetchUserStats, updateStats])

  useEffect(() => {
    // Pre-fetch players data on app load (session-cached)
    fetchPlayers()
    
    // Check initial session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        // Update centralized auth store
        setSession(session)
        setLoading(false)
        
        if (session?.user) {
          const username = session.user.user_metadata?.name || 
                      session.user.user_metadata?.full_name ||
                      session.user.email?.split('@')[0] || 
                      'Player'
          setUser({
            id: session.user.id,
            username,
            email: session.user.email || undefined,
            avatarUrl: session.user.user_metadata?.avatar_url || undefined,
          })
          
          // Load stats from Supabase (session-cached)
          await loadUserStats(session.user.id)
        }
      } catch (error) {
        console.error('Error checking session:', error)
        setLoading(false)
      }
    }

    checkSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        // Update centralized auth store immediately
        setSession(session)
        setLoading(false)
        
        if (session?.user) {
          const username = session.user.user_metadata?.name || 
                      session.user.user_metadata?.full_name ||
                      session.user.email?.split('@')[0] || 
                      'Player'
          setUser({
            id: session.user.id,
            username,
            email: session.user.email || undefined,
            avatarUrl: session.user.user_metadata?.avatar_url || undefined,
          })

          // Sync user profile to Supabase on sign in
          if (event === 'SIGNED_IN') {
            try {
              await supabase.from('users').upsert({
                id: session.user.id,
                username: session.user.user_metadata?.name || 
                          session.user.user_metadata?.full_name ||
                          session.user.email?.split('@')[0] || 
                          `Player_${session.user.id.slice(0, 8)}`,
                avatar_url: session.user.user_metadata?.avatar_url,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'id',
              })
            } catch (error) {
              console.error('Error syncing user profile:', error)
            }
          }
          
          // Load stats from Supabase on any auth event (session-cached)
          await loadUserStats(session.user.id)
        } else {
          // User logged out - clear session data
          clearSessionData()
          logout()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [setUser, updateStats, logout, fetchPlayers, loadUserStats, setSession, setLoading, clearSessionData])

  return <>{children}</>
}
