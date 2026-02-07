import type { Metadata, Viewport } from 'next'
import './globals.css'
import { BottomNav } from '@/components/layout/BottomNav'
import { Header } from '@/components/layout/Header'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { AchievementToast } from '@/components/achievements/AchievementSystem'

export const metadata: Metadata = {
  title: 'GARU - The NBA Knowledge Arena',
  description: 'Test your NBA knowledge, analyze player stats, and battle in draft challenges. The ultimate platform for basketball enthusiasts.',
  keywords: ['NBA', 'basketball', 'stats', 'trivia', 'draft', 'fantasy'],
  authors: [{ name: 'GARU Team' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/garu-logo.png',
    apple: '/garu-logo.png',
  },
  openGraph: {
    title: 'GARU - The NBA Knowledge Arena',
    description: 'Test your NBA knowledge and battle in draft challenges',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0F172A',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-deep-void text-ghost-white antialiased">
        <ThemeProvider>
          <AuthProvider>
            <Header />
            <main className="pb-20 md:pb-0 md:pl-20">
              {children}
            </main>
            <BottomNav />
            <AchievementToast />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
