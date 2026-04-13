import { create } from 'zustand'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  sessionExpiresAt: number | null
  
  // Actions
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  isSessionExpiringSoon: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true, // Start as loading until we verify session
  isAuthenticated: false,
  sessionExpiresAt: null,

  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user,
  }),

  setSession: (session) => set({ 
    session,
    user: session?.user || null,
    isAuthenticated: !!session?.user,
    sessionExpiresAt: session?.expires_at ? session.expires_at * 1000 : null,
  }),

  setLoading: (isLoading) => set({ isLoading }),

  signOut: async () => {
    await supabase.auth.signOut()
    // Clear session storage
    if (typeof window !== 'undefined') {
      sessionStorage.clear()
    }
    set({ user: null, session: null, isAuthenticated: false })
    // Refresh the page to reset all state
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
  },

  refreshSession: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error

      // Do not clear auth state on background refresh when session is temporarily unavailable.
      // Explicit SIGNED_OUT events and manual sign-out should control logout behavior.
      if (!session) {
        console.warn('Session refresh returned no session; keeping current auth state')
        set({ isLoading: false })
        return
      }

      set({
        session,
        user: session?.user || null,
        isAuthenticated: !!session?.user,
        sessionExpiresAt: session?.expires_at ? session.expires_at * 1000 : null,
        isLoading: false,
      })
    } catch (error) {
      console.error('Error refreshing session:', error)
      // Keep existing auth/session on transient refresh failures to avoid interrupting active games.
      set({ isLoading: false })
    }
  },

  isSessionExpiringSoon: () => {
    const { sessionExpiresAt } = get()
    if (!sessionExpiresAt) return false
    // Treat sessions with less than 10 minutes left as expiring soon.
    return (sessionExpiresAt - Date.now()) <= 10 * 60 * 1000
  },
}))

// Initialize auth listener - call this once at app startup
let authListenerInitialized = false

export function initializeAuthListener() {
  if (authListenerInitialized) return
  authListenerInitialized = true

  const { setSession, setLoading } = useAuthStore.getState()

  // Get initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session)
    setLoading(false)
  })

  // Listen for auth changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)
      setSession(session)
      setLoading(false)
    }
  )

  // Cleanup function (for testing/HMR)
  if (typeof window !== 'undefined') {
    (window as any).__authCleanup = () => {
      subscription.unsubscribe()
      authListenerInitialized = false
    }
  }

  return subscription
}
