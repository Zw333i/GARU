'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Auth error:', error)
        router.push('/profile?error=auth_failed')
        return
      }

      if (data.session) {
        // Successfully logged in
        router.push('/profile?success=true')
      } else {
        router.push('/profile')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="loader mx-auto mb-4"></div>
        <p className="text-muted">Completing sign in...</p>
      </div>
    </div>
  )
}
