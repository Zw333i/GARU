'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'

interface PlayerCardProps {
  id: number
  name: string
  team: string
  position: string
  stats?: {
    pts: number
    reb: number
    ast: number
    fg: number
    ts: number
  }
  rating?: number
  showBack?: boolean
}

export function PlayerCard({
  id,
  name,
  team,
  position,
  stats,
  rating,
  showBack = false,
}: PlayerCardProps) {
  const [isFlipped, setIsFlipped] = useState(showBack)

  const imageUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`

  return (
    <div
      className="card-flip w-full max-w-[280px] aspect-[3/4] cursor-pointer perspective-1000"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="card-flip-inner relative w-full h-full"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front of Card */}
        <div
          className="card-front absolute inset-0 glass rounded-2xl overflow-hidden"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Rating Badge */}
          {rating && (
            <div className="absolute top-3 right-3 z-10 w-12 h-12 rounded-full bg-electric-lime flex items-center justify-center">
              <span className="text-deep-void font-display font-bold text-lg">{rating}</span>
            </div>
          )}

          {/* Player Image */}
          <div className="h-2/3 bg-gradient-to-b from-gunmetal to-deep-void flex items-end justify-center overflow-hidden">
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-player.svg'
              }}
            />
          </div>

          {/* Player Info */}
          <div className="h-1/3 p-4 flex flex-col justify-center">
            <p className="text-lg font-display font-bold truncate">{name}</p>
            <div className="flex items-center gap-2 text-sm text-muted">
              <span>{team}</span>
              <span>•</span>
              <span>{position}</span>
            </div>
          </div>

          {/* Tap hint */}
          <div className="absolute bottom-2 right-2 text-xs text-muted opacity-50">
            Tap to flip
          </div>
        </div>

        {/* Back of Card */}
        <div
          className="card-back absolute inset-0 glass rounded-2xl p-6"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="text-center mb-4">
              <p className="font-display font-bold text-lg">{name}</p>
              <p className="text-sm text-muted">{team} • {position}</p>
            </div>

            {/* Stats */}
            {stats && (
              <div className="flex-1 space-y-3">
                <StatBar label="Scoring" value={stats.pts} max={35} color="lime" />
                <StatBar label="Rebounding" value={stats.reb} max={15} color="blue" />
                <StatBar label="Playmaking" value={stats.ast} max={12} color="purple" />
                <StatBar label="Efficiency" value={stats.ts} max={70} color="pink" suffix="%" />
              </div>
            )}

            {/* Radar Chart placeholder */}
            <div className="mt-4 text-center text-xs text-muted">
              <p>Season 2025-26</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function StatBar({
  label,
  value,
  max,
  color,
  suffix = '',
}: {
  label: string
  value: number
  max: number
  color: 'lime' | 'blue' | 'purple' | 'pink'
  suffix?: string
}) {
  const percentage = Math.min((value / max) * 100, 100)
  
  const colorClasses = {
    lime: 'bg-electric-lime',
    blue: 'bg-blue-400',
    purple: 'bg-purple-400',
    pink: 'bg-hot-pink',
  }

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted">{label}</span>
        <span className="font-bold">{value}{suffix}</span>
      </div>
      <div className="h-2 bg-gunmetal rounded-full overflow-hidden">
        <motion.div
          className={clsx('h-full rounded-full', colorClasses[color])}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, delay: 0.2 }}
        />
      </div>
    </div>
  )
}
