'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { supabase } from '@/lib/supabase'
import { 
  GamepadIcon, 
  SearchIcon, 
  JourneyIcon, 
  CompareIcon, 
  ChartIcon 
} from '@/components/icons'

interface GameModeProps {
  id: string
  title: string
  description: string
  Icon: React.FC<{ className?: string; size?: number }>
  difficulty: string
  color: 'lime' | 'blue' | 'pink' | 'purple'
  gamesPlayed: number
}

const colorClasses = {
  lime: {
    bg: 'bg-electric-lime/10',
    border: 'border-electric-lime/30',
    text: 'text-electric-lime',
    glow: 'hover:shadow-[0_0_30px_rgba(132,204,22,0.2)]',
    iconBg: 'bg-electric-lime/20',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    glow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]',
    iconBg: 'bg-blue-500/20',
  },
  pink: {
    bg: 'bg-hot-pink/10',
    border: 'border-hot-pink/30',
    text: 'text-hot-pink',
    glow: 'hover:shadow-[0_0_30px_rgba(236,72,153,0.2)]',
    iconBg: 'bg-hot-pink/20',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    glow: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]',
    iconBg: 'bg-purple-500/20',
  },
}

// Game mode definitions (without gamesPlayed - that comes from state)
const gameModeDefinitions = [
  {
    id: 'whos-that',
    title: "Who's That Role Player?",
    description: 'Guess the player from their image and hints about their stats.',
    Icon: SearchIcon,
    difficulty: 'Easy',
    color: 'lime' as const,
  },
  {
    id: 'the-journey',
    title: 'The Journey',
    description: 'Guess which player took this career path through different teams.',
    Icon: JourneyIcon,
    difficulty: 'Medium',
    color: 'blue' as const,
  },
  {
    id: 'blind-comparison',
    title: 'Blind Comparison',
    description: 'Two stat lines, no names. Pick who you would draft. Get surprised!',
    Icon: CompareIcon,
    difficulty: 'Hard',
    color: 'pink' as const,
  },
  {
    id: 'stat-attack',
    title: 'Stat Attack',
    description: 'Given a stat, guess if the player is above or below the league average.',
    Icon: ChartIcon,
    difficulty: 'Medium',
    color: 'purple' as const,
  },
]

function GameModeCard({ id, title, description, Icon, difficulty, color, gamesPlayed }: GameModeProps) {
  const colors = colorClasses[color]

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link
        href={`/play/${id}`}
        className={clsx(
          'block glass rounded-2xl p-6 border transition-all duration-300',
          colors.border,
          colors.glow
        )}
      >
        <div className="flex items-start justify-between mb-4">
          <div className={clsx(
            'w-14 h-14 rounded-xl flex items-center justify-center',
            colors.iconBg
          )}>
            <Icon size={28} className={colors.text} />
          </div>
          <span className={clsx(
            'text-xs px-3 py-1 rounded-full',
            colors.bg,
            colors.text
          )}>
            {difficulty}
          </span>
        </div>

        <h3 className="text-xl font-display font-bold mb-2">{title}</h3>
        <p className="text-muted text-sm mb-4">{description}</p>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">
            <span className="font-bold text-ghost-white">{gamesPlayed}</span> played
          </span>
          <span className={clsx('text-sm font-medium flex items-center gap-1', colors.text)}>
            Play Now
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

export default function PlayPage() {
  const [gamesPlayedCounts, setGamesPlayedCounts] = useState<Record<string, number>>({
    'whos-that': 0,
    'the-journey': 0,
    'blind-comparison': 0,
    'stat-attack': 0,
  })

  // Fetch games played counts from database
  useEffect(() => {
    const fetchGamesCounts = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Fetch all game scores for the user and count by game_type
        const { data: scores } = await supabase
          .from('game_scores')
          .select('game_type')
          .eq('user_id', user.id)

        if (scores) {
          const counts: Record<string, number> = {
            'whos-that': 0,
            'the-journey': 0,
            'blind-comparison': 0,
            'stat-attack': 0,
          }
          scores.forEach((score) => {
            const gameType = score.game_type
            if (gameType in counts) {
              counts[gameType]++
            }
          })
          setGamesPlayedCounts(counts)
        }
      } catch (err) {
        console.error('Error fetching game counts:', err)
      }
    }

    fetchGamesCounts()
  }, [])

  // Combine definitions with games played counts
  const gameModes = gameModeDefinitions.map(mode => ({
    ...mode,
    gamesPlayed: gamesPlayedCounts[mode.id] || 0,
  }))

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
      {/* Header */}
      <section className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-2 flex items-center gap-3">
          <GamepadIcon size={32} className="text-electric-lime" />
          Game Modes
        </h1>
        <p className="text-muted text-lg">
          Test your NBA knowledge with various challenges
        </p>
      </section>

      {/* Game Mode Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {gameModes.map((mode) => (
          <GameModeCard key={mode.id} {...mode} />
        ))}
      </div>

      {/* Coming Soon */}
      <section className="mt-12">
        <h2 className="text-xl font-display font-bold mb-4 text-muted">Coming Soon</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['Team Builder', 'Season Simulator', 'Trade Machine'].map((title) => (
            <div 
              key={title}
              className="glass rounded-xl p-4 opacity-50 cursor-not-allowed"
            >
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted">Under development</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
