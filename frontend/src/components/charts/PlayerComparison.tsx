'use client'

import { useEffect, useState } from 'react'
import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import { motion } from 'framer-motion'
import { BasketballLoader } from '@/components/ui/BasketballLoader'

interface PlayerStats {
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  fg_pct: number
}

interface PlayerComparisonProps {
  playerA: {
    name: string
    team: string
    stats: PlayerStats
  }
  playerB: {
    name: string
    team: string
    stats: PlayerStats
  }
  className?: string
}

// Normalize stats to 0-100 scale for radar chart
const normalizeStats = (stats: PlayerStats) => {
  return {
    Scoring: Math.min(100, (stats.pts / 35) * 100),
    Rebounding: Math.min(100, (stats.reb / 15) * 100),
    Playmaking: Math.min(100, (stats.ast / 12) * 100),
    Defense: Math.min(100, ((stats.stl + stats.blk) / 4) * 100),
    Efficiency: Math.min(100, (stats.fg_pct / 65) * 100),
  }
}

export function PlayerComparisonRadar({
  playerA,
  playerB,
  className = '',
}: PlayerComparisonProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const normalizedA = normalizeStats(playerA.stats)
  const normalizedB = normalizeStats(playerB.stats)

  const data = [
    {
      stat: 'Scoring',
      [playerA.name]: normalizedA.Scoring,
      [playerB.name]: normalizedB.Scoring,
      fullMarkA: 100,
      fullMarkB: 100,
    },
    {
      stat: 'Rebounding',
      [playerA.name]: normalizedA.Rebounding,
      [playerB.name]: normalizedB.Rebounding,
      fullMarkA: 100,
      fullMarkB: 100,
    },
    {
      stat: 'Playmaking',
      [playerA.name]: normalizedA.Playmaking,
      [playerB.name]: normalizedB.Playmaking,
      fullMarkA: 100,
      fullMarkB: 100,
    },
    {
      stat: 'Defense',
      [playerA.name]: normalizedA.Defense,
      [playerB.name]: normalizedB.Defense,
      fullMarkA: 100,
      fullMarkB: 100,
    },
    {
      stat: 'Efficiency',
      [playerA.name]: normalizedA.Efficiency,
      [playerB.name]: normalizedB.Efficiency,
      fullMarkA: 100,
      fullMarkB: 100,
    },
  ]

  if (!mounted) {
    return (
      <div className={`glass rounded-2xl p-6 ${className}`}>
        <div className="h-80 flex items-center justify-center text-muted">
          Loading chart...
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-2xl p-6 ${className}`}
    >
      <h3 className="text-lg font-display font-bold mb-4">
        Player Comparison
      </h3>

      {/* Player Labels */}
      <div className="flex justify-center gap-8 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-electric-lime" />
          <span className="text-sm">
            {playerA.name} ({playerA.team})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-hot-pink" />
          <span className="text-sm">
            {playerB.name} ({playerB.team})
          </span>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadarChart data={data}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis
              dataKey="stat"
              tick={{ fill: '#94A3B8', fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#64748B', fontSize: 10 }}
              axisLine={false}
            />
            <Radar
              name={playerA.name}
              dataKey={playerA.name}
              stroke="#84CC16"
              fill="#84CC16"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Radar
              name={playerB.name}
              dataKey={playerB.name}
              stroke="#EC4899"
              fill="#EC4899"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#F8FAFC' }}
            />
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Comparison Table */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div className="text-right text-electric-lime font-medium">
          {playerA.stats.pts} PPG
        </div>
        <div className="text-center text-muted">Scoring</div>
        <div className="text-left text-hot-pink font-medium">
          {playerB.stats.pts} PPG
        </div>

        <div className="text-right text-electric-lime font-medium">
          {playerA.stats.reb} RPG
        </div>
        <div className="text-center text-muted">Rebounds</div>
        <div className="text-left text-hot-pink font-medium">
          {playerB.stats.reb} RPG
        </div>

        <div className="text-right text-electric-lime font-medium">
          {playerA.stats.ast} APG
        </div>
        <div className="text-center text-muted">Assists</div>
        <div className="text-left text-hot-pink font-medium">
          {playerB.stats.ast} APG
        </div>

        <div className="text-right text-electric-lime font-medium">
          {playerA.stats.fg_pct.toFixed(1)}%
        </div>
        <div className="text-center text-muted">FG%</div>
        <div className="text-left text-hot-pink font-medium">
          {playerB.stats.fg_pct.toFixed(1)}%
        </div>
      </div>
    </motion.div>
  )
}

// Simple single-player radar chart
interface SinglePlayerRadarProps {
  player: {
    name: string
    stats: PlayerStats
  }
  className?: string
}

export function SinglePlayerRadar({ player, className = '' }: SinglePlayerRadarProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const normalized = normalizeStats(player.stats)

  const data = Object.entries(normalized).map(([stat, value]) => ({
    stat,
    value,
    fullMark: 100,
  }))

  if (!mounted) {
    return (
      <div className={`h-48 flex items-center justify-center ${className}`}>
        <BasketballLoader size="sm" text="" />
      </div>
    )
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={200}>
        <RechartsRadarChart data={data}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis
            dataKey="stat"
            tick={{ fill: '#94A3B8', fontSize: 10 }}
          />
          <Radar
            name={player.name}
            dataKey="value"
            stroke="#84CC16"
            fill="#84CC16"
            fillOpacity={0.4}
            strokeWidth={2}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  )
}
