'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUserStore } from '@/store/userStore'
import { useAuthStore } from '@/store/authStore'
import { usePlayersStore } from '@/store/playersStore'
import { useSessionDataStore } from '@/store/sessionDataStore'
import { prefetchLabForPlayer } from '@/lib/labPrefetch'
import { sounds } from '@/lib/sounds'

const getAuthAvatarUrl = (metadata?: Record<string, any>) => {
  if (!metadata) return undefined
  return metadata.avatar_url || metadata.picture || metadata.avatar || undefined
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useUserStore((state) => state.setUser)
  const updateStats = useUserStore((state) => state.updateStats)
  const logout = useUserStore((state) => state.logout)
  
  // Centralized auth state
  const { setSession, setLoading, refreshSession, isSessionExpiringSoon } = useAuthStore()
  
  // Session data stores
  const fetchPlayers = usePlayersStore((state) => state.fetchPlayers)
  const players = usePlayersStore((state) => state.players)
  const playersLoaded = usePlayersStore((state) => state.isLoaded)
  const fetchUserStats = useSessionDataStore((state) => state.fetchUserStats)
  const sessionUserStats = useSessionDataStore((state) => state.userStats)
  const clearSessionData = useSessionDataStore((state) => state.clearSession)

  // Sync centralized session stats to legacy userStore without extra DB query.
  useEffect(() => {
    if (!sessionUserStats) return

    updateStats({
      gamesPlayed: sessionUserStats.gamesPlayed,
      currentStreak: sessionUserStats.currentStreak,
      bestStreak: sessionUserStats.bestStreak,
      dailyChallengesCompleted: sessionUserStats.dailyChallengesCompleted,
      xp: sessionUserStats.xp,
      level: sessionUserStats.level,
    })
  }, [sessionUserStats, updateStats])

  useEffect(() => {
    // Pre-fetch players data on app load (session-cached)
    fetchPlayers()
    
    // Preload all sounds for instant playback across games
    sounds.preloadSounds().catch(() => {
      // Preload errors are non-critical
    })
    
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
          const avatarUrl = getAuthAvatarUrl(session.user.user_metadata)
          setUser({
            id: session.user.id,
            username,
            email: session.user.email || undefined,
            avatarUrl,
          })

          // Warm user session data immediately after auth bootstraps.
          void fetchUserStats(session.user.id)
        }
      } catch (error) {
        console.error('Error checking session:', error)
        setLoading(false)
      }
    }

    checkSession()

    // Proactively refresh session shortly before expiry to reduce auth hiccups.
    const refreshInterval = setInterval(async () => {
      if (isSessionExpiringSoon()) {
        await refreshSession()
      }
    }, 60 * 1000)

    const onVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isSessionExpiringSoon()) {
        await refreshSession()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

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
          const avatarUrl = getAuthAvatarUrl(session.user.user_metadata)
          setUser({
            id: session.user.id,
            username,
            email: session.user.email || undefined,
            avatarUrl,
          })

          // Sync user profile to Supabase on sign in
          if (event === 'SIGNED_IN') {
            void (async () => {
              try {
                await supabase.from('users').upsert({
                  id: session.user.id,
                  username: session.user.user_metadata?.name || 
                            session.user.user_metadata?.full_name ||
                            session.user.email?.split('@')[0] || 
                            `Player_${session.user.id.slice(0, 8)}`,
                  avatar_url: avatarUrl,
                  updated_at: new Date().toISOString(),
                }, {
                  onConflict: 'id',
                })
              } catch (error) {
                console.error('Error syncing user profile:', error)
              }
            })()
          }

          // Prefetch profile/history/achievements in background on every valid auth event.
          void fetchUserStats(session.user.id)
        } else {
          // User logged out - clear session data
          clearSessionData()
          logout()
        }
      }
    )

    return () => {
      clearInterval(refreshInterval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      subscription.unsubscribe()
    }
  }, [setUser, logout, fetchPlayers, fetchUserStats, setSession, setLoading, clearSessionData, refreshSession, isSessionExpiringSoon])

  useEffect(() => {
    if (!playersLoaded || players.length === 0) return

    // Warm one representative player's Lab data in the background.
    void prefetchLabForPlayer(players[0].id)
  }, [playersLoaded, players])

  return <>{children}</>
}
