'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check for PKCE auth code in URL (used by mobile browsers)
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')

        if (code) {
          // PKCE flow: exchange code for session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.error('Auth code exchange error:', error)
            router.push('/profile?error=auth_failed')
            return
          }
          if (data.session) {
            router.push('/profile?success=true')
            return
          }
        }

        // Implicit flow fallback: tokens in URL hash fragment
        // Wait briefly for Supabase JS to pick up hash tokens
        await new Promise(resolve => setTimeout(resolve, 500))

        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Auth error:', error)
          router.push('/profile?error=auth_failed')
          return
        }

        if (data.session) {
          router.push('/profile?success=true')
        } else {
          // No session found — retry once after a short delay (mobile can be slow)
          await new Promise(resolve => setTimeout(resolve, 1000))
          const { data: retryData } = await supabase.auth.getSession()
          if (retryData?.session) {
            router.push('/profile?success=true')
          } else {
            router.push('/profile?error=auth_failed')
          }
        }
      } catch (err) {
        console.error('Auth callback error:', err)
        router.push('/profile?error=auth_failed')
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
