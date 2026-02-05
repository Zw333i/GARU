'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
  TrophyIcon,
  GoldMedalIcon,
  SilverMedalIcon,
  BronzeMedalIcon,
  FireIcon,
} from '@/components/icons'
import { LeaderboardRowSkeleton } from '@/components/ui/LoadingSkeleton'

interface LeaderboardEntry {
  id: string
  username: string
  avatar_url: string | null
  wins: number
  losses: number
  xp: number
  level: number
  current_streak: number
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <GoldMedalIcon size={28} />
    case 2:
      return <SilverMedalIcon size={28} />
    case 3:
      return <BronzeMedalIcon size={28} />
    default:
      return null
  }
}

const getRankStyle = (rank: number) => {
  switch (rank) {
    case 1:
      return {
        bg: 'bg-yellow-500/20',
        border: 'border-yellow-500',
        text: 'text-yellow-400',
      }
    case 2:
      return {
        bg: 'bg-gray-400/20',
        border: 'border-gray-400',
        text: 'text-gray-300',
      }
    case 3:
      return {
        bg: 'bg-amber-600/20',
        border: 'border-amber-600',
        text: 'text-amber-500',
      }
    default:
      return { bg: 'bg-gunmetal', border: 'border-surface', text: 'text-muted' }
  }
}

export function RealtimeLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedId, setUpdatedId] = useState<string | null>(null)

  // Fetch initial leaderboard
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('wins', { ascending: false })
          .limit(20)

        if (error) throw error
        setLeaderboard(data || [])
      } catch (err) {
        console.error('Error fetching leaderboard:', err)
        setError('Failed to load leaderboard')
        // Use mock data as fallback
        setLeaderboard(MOCK_LEADERBOARD)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLeaderboard()
  }, [])

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          console.log('Leaderboard update:', payload)

          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const updated = payload.new as LeaderboardEntry

            setLeaderboard((prev) => {
              const index = prev.findIndex((p) => p.id === updated.id)
              let newList: LeaderboardEntry[]

              if (index >= 0) {
                // Update existing entry
                newList = [...prev]
                newList[index] = updated
              } else {
                // Add new entry
                newList = [...prev, updated]
              }

              // Re-sort by wins
              return newList
                .sort((a, b) => b.wins - a.wins)
                .slice(0, 20)
            })

            // Highlight updated row
            setUpdatedId(updated.id)
            setTimeout(() => setUpdatedId(null), 2000)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="glass rounded-2xl overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <LeaderboardRowSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header Row */}
      <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gunmetal border-b border-surface text-sm text-muted font-medium">
        <div className="col-span-1">Rank</div>
        <div className="col-span-4">Player</div>
        <div className="col-span-2 text-center">Wins</div>
        <div className="col-span-2 text-center">Losses</div>
        <div className="col-span-2 text-center">Win Rate</div>
        <div className="col-span-1 text-center">Level</div>
      </div>

      {/* Leaderboard Rows */}
      <AnimatePresence mode="popLayout">
        {leaderboard.map((player, index) => {
          const rank = index + 1
          const style = getRankStyle(rank)
          const winRate =
            player.wins + player.losses > 0
              ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
              : '0.0'
          const rankIcon = getRankIcon(rank)
          const isUpdated = player.id === updatedId

          return (
            <motion.div
              key={player.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{
                opacity: 1,
                x: 0,
                backgroundColor: isUpdated
                  ? 'rgba(132, 204, 22, 0.2)'
                  : 'transparent',
              }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className={`grid grid-cols-12 gap-4 px-6 py-4 border-b border-surface/50 hover:bg-white/5 transition-colors ${
                rank <= 3 ? style.bg : ''
              }`}
            >
              {/* Rank */}
              <div className="col-span-1 flex items-center">
                {rankIcon || (
                  <span className={`font-bold ${style.text}`}>{rank}</span>
                )}
              </div>

              {/* Player */}
              <div className="col-span-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gunmetal flex items-center justify-center overflow-hidden">
                  {player.avatar_url ? (
                    <img
                      src={player.avatar_url}
                      alt={player.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-electric-lime font-bold">
                      {player.username?.[0]?.toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium">{player.username}</p>
                  {player.current_streak >= 3 && (
                    <div className="flex items-center gap-1 text-xs text-hot-pink">
                      <FireIcon size={12} />
                      <span>{player.current_streak} streak</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="col-span-2 text-center self-center font-medium text-electric-lime">
                {player.wins}
              </div>
              <div className="col-span-2 text-center self-center text-muted">
                {player.losses}
              </div>
              <div className="col-span-2 text-center self-center">
                <span
                  className={
                    parseFloat(winRate) >= 60
                      ? 'text-electric-lime'
                      : parseFloat(winRate) >= 40
                      ? 'text-ghost-white'
                      : 'text-hot-pink'
                  }
                >
                  {winRate}%
                </span>
              </div>
              <div className="col-span-1 text-center self-center">
                <span className="px-2 py-1 bg-gunmetal rounded text-sm">
                  {player.level}
                </span>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {leaderboard.length === 0 && !error && (
        <div className="px-6 py-12 text-center text-muted">
          <TrophyIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p>No players yet. Be the first to join!</p>
        </div>
      )}
    </div>
  )
}

// Mock data fallback
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: '1',
    username: 'JokicFan2024',
    avatar_url: null,
    wins: 152,
    losses: 23,
    xp: 15200,
    level: 42,
    current_streak: 7,
  },
  {
    id: '2',
    username: 'DraftKing99',
    avatar_url: null,
    wins: 134,
    losses: 31,
    xp: 13400,
    level: 38,
    current_streak: 3,
  },
  {
    id: '3',
    username: 'StatNerd',
    avatar_url: null,
    wins: 128,
    losses: 28,
    xp: 12800,
    level: 36,
    current_streak: 0,
  },
  {
    id: '4',
    username: 'BucksIn6',
    avatar_url: null,
    wins: 115,
    losses: 35,
    xp: 11500,
    level: 33,
    current_streak: 5,
  },
  {
    id: '5',
    username: 'TatumTime',
    avatar_url: null,
    wins: 98,
    losses: 42,
    xp: 9800,
    level: 28,
    current_streak: 0,
  },
]
