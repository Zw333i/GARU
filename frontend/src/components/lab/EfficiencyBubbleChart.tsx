'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'

interface Player {
  id: number
  name: string
  team: string
  position: string
  ppg: number
  rpg?: number
  apg?: number
  ts?: number // True Shooting %
}

interface EfficiencyBubbleChartProps {
  players: Player[]
  selectedPlayerId?: number | null
  onPlayerClick?: (player: Player) => void
}

// Generate mock TS% for players based on their ppg (seeded for consistency)
const generateTS = (playerId: number, ppg: number): number => {
  // Use player ID to generate consistent TS%
  const seed = playerId % 100
  const base = 52 + (seed / 100) * 16 // Range: 52-68%
  // Higher scorers tend to be slightly more efficient in modern NBA
  const ppgBonus = ppg > 25 ? 2 : ppg > 20 ? 1 : 0
  return Math.min(68, Math.max(48, base + ppgBonus + (seed % 5) - 2))
}

// Quadrant definitions
const QUADRANTS = {
  highEfficient: { label: 'High Volume Efficient', emoji: '🌟', color: 'text-electric-lime', desc: 'Stars - High PPG, High TS%' },
  efficient: { label: 'Low Volume Efficient', emoji: '✨', color: 'text-blue-400', desc: 'Role Players - Low PPG, High TS%' },
  inefficient: { label: 'High Volume Inefficient', emoji: '⚠️', color: 'text-amber-400', desc: 'Volume Scorers - High PPG, Low TS%' },
  cheeks: { label: 'CHEEKS', emoji: '💀', color: 'text-hot-pink', desc: 'Low PPG, Low TS%' },
}

// Axis thresholds
const PPG_THRESHOLD = 18 // High vs Low volume
const TS_THRESHOLD = 57 // High vs Low efficiency

export function EfficiencyBubbleChart({ players, selectedPlayerId, onPlayerClick }: EfficiencyBubbleChartProps) {
  const [hoveredPlayer, setHoveredPlayer] = useState<Player | null>(null)
  const [showLabels, setShowLabels] = useState(true)

  // Process players with TS% data
  const processedPlayers = useMemo(() => {
    return players.map(p => ({
      ...p,
      ts: p.ts || generateTS(p.id, p.ppg)
    }))
  }, [players])

  // Get quadrant for a player
  const getQuadrant = (ppg: number, ts: number) => {
    if (ppg >= PPG_THRESHOLD && ts >= TS_THRESHOLD) return 'highEfficient'
    if (ppg < PPG_THRESHOLD && ts >= TS_THRESHOLD) return 'efficient'
    if (ppg >= PPG_THRESHOLD && ts < TS_THRESHOLD) return 'inefficient'
    return 'cheeks'
  }

  // Calculate SVG coordinates (scale to fit 400x400 viewBox)
  const getCoords = (ppg: number, ts: number) => {
    // PPG: 0-35 maps to x: 40-380
    const x = Math.min(380, Math.max(40, (ppg / 35) * 340 + 40))
    // TS%: 45-70% maps to y: 380-40 (inverted for SVG)
    const y = Math.min(380, Math.max(40, 380 - ((ts - 45) / 25) * 340))
    return { x, y }
  }

  // Count players in each quadrant
  const quadrantCounts = useMemo(() => {
    const counts = { highEfficient: 0, efficient: 0, inefficient: 0, cheeks: 0 }
    processedPlayers.forEach(p => {
      const q = getQuadrant(p.ppg, p.ts!)
      counts[q]++
    })
    return counts
  }, [processedPlayers])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <span className="text-2xl">📊</span>
          Efficiency Quadrants
        </h2>
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
            showLabels ? 'bg-electric-lime/20 text-electric-lime' : 'bg-gunmetal text-muted'
          }`}
        >
          {showLabels ? 'Hide Labels' : 'Show Labels'}
        </button>
      </div>

      <p className="text-muted text-sm mb-4">
        Points Per Game (X) vs True Shooting % (Y) — Hover over bubbles to see player details
      </p>

      {/* Quadrant Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-xs">
        {Object.entries(QUADRANTS).map(([key, q]) => (
          <div 
            key={key}
            className="flex items-center gap-2 bg-gunmetal px-3 py-2 rounded-lg"
          >
            <span>{q.emoji}</span>
            <div>
              <p className={`font-bold ${q.color}`}>{q.label}</p>
              <p className="text-muted">{quadrantCounts[key as keyof typeof quadrantCounts]} players</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="relative bg-gunmetal rounded-xl overflow-hidden">
        <svg viewBox="0 0 420 420" className="w-full h-auto" style={{ maxHeight: '450px' }}>
          {/* Background quadrants */}
          <rect x="40" y="40" width="170" height="170" fill="rgba(34, 197, 94, 0.08)" /> {/* Top-left: Efficient */}
          <rect x="210" y="40" width="170" height="170" fill="rgba(163, 230, 53, 0.12)" /> {/* Top-right: High Efficient */}
          <rect x="40" y="210" width="170" height="170" fill="rgba(236, 72, 153, 0.08)" /> {/* Bottom-left: Cheeks */}
          <rect x="210" y="210" width="170" height="170" fill="rgba(251, 191, 36, 0.08)" /> {/* Bottom-right: Inefficient */}

          {/* Quadrant Labels */}
          {showLabels && (
            <>
              <text x="125" y="70" textAnchor="middle" fill="#22C55E" fontSize="10" fontFamily="sans-serif" opacity="0.7">
                {QUADRANTS.efficient.emoji} Efficient
              </text>
              <text x="295" y="70" textAnchor="middle" fill="#A3E635" fontSize="10" fontFamily="sans-serif" opacity="0.7">
                {QUADRANTS.highEfficient.emoji} Stars
              </text>
              <text x="125" y="370" textAnchor="middle" fill="#EC4899" fontSize="10" fontFamily="sans-serif" opacity="0.7">
                {QUADRANTS.cheeks.emoji} CHEEKS
              </text>
              <text x="295" y="370" textAnchor="middle" fill="#FBBF24" fontSize="10" fontFamily="sans-serif" opacity="0.7">
                {QUADRANTS.inefficient.emoji} Volume
              </text>
            </>
          )}

          {/* Grid lines */}
          <line x1="210" y1="40" x2="210" y2="380" stroke="#334155" strokeWidth="2" strokeDasharray="4,4" />
          <line x1="40" y1="210" x2="380" y2="210" stroke="#334155" strokeWidth="2" strokeDasharray="4,4" />

          {/* Axes */}
          <line x1="40" y1="380" x2="380" y2="380" stroke="#64748B" strokeWidth="2" />
          <line x1="40" y1="40" x2="40" y2="380" stroke="#64748B" strokeWidth="2" />

          {/* X-axis labels (PPG) */}
          <text x="40" y="400" textAnchor="middle" fill="#64748B" fontSize="10">0</text>
          <text x="125" y="400" textAnchor="middle" fill="#64748B" fontSize="10">10</text>
          <text x="210" y="400" textAnchor="middle" fill="#EC4899" fontSize="10" fontWeight="bold">18</text>
          <text x="295" y="400" textAnchor="middle" fill="#64748B" fontSize="10">25</text>
          <text x="380" y="400" textAnchor="middle" fill="#64748B" fontSize="10">35</text>
          <text x="210" y="415" textAnchor="middle" fill="#94A3B8" fontSize="11">Points Per Game</text>

          {/* Y-axis labels (TS%) */}
          <text x="25" y="385" textAnchor="middle" fill="#64748B" fontSize="10">45%</text>
          <text x="25" y="295" textAnchor="middle" fill="#64748B" fontSize="10">51%</text>
          <text x="25" y="215" textAnchor="middle" fill="#EC4899" fontSize="10" fontWeight="bold">57%</text>
          <text x="25" y="125" textAnchor="middle" fill="#64748B" fontSize="10">63%</text>
          <text x="25" y="45" textAnchor="middle" fill="#64748B" fontSize="10">70%</text>
          <text x="15" y="210" textAnchor="middle" fill="#94A3B8" fontSize="11" transform="rotate(-90, 15, 210)">True Shooting %</text>

          {/* Player bubbles */}
          {processedPlayers.map((player) => {
            const { x, y } = getCoords(player.ppg, player.ts!)
            const quadrant = getQuadrant(player.ppg, player.ts!)
            const isSelected = selectedPlayerId === player.id
            const isHovered = hoveredPlayer?.id === player.id

            // Bubble color based on quadrant
            const colors = {
              highEfficient: '#A3E635',
              efficient: '#22C55E',
              inefficient: '#FBBF24',
              cheeks: '#EC4899',
            }

            return (
              <motion.circle
                key={player.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: isSelected || isHovered ? 1.5 : 1, 
                  opacity: isSelected ? 1 : 0.7 
                }}
                cx={x}
                cy={y}
                r={isSelected ? 10 : 6}
                fill={colors[quadrant]}
                stroke={isSelected ? '#FFF' : 'transparent'}
                strokeWidth={isSelected ? 2 : 0}
                className="cursor-pointer transition-all duration-200"
                onClick={() => onPlayerClick?.(player)}
                onMouseEnter={() => setHoveredPlayer(player)}
                onMouseLeave={() => setHoveredPlayer(null)}
              />
            )
          })}
        </svg>

        {/* Hover tooltip */}
        {hoveredPlayer && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-4 right-4 bg-deep-void/95 border border-surface rounded-xl p-4 min-w-[200px] pointer-events-none z-10"
          >
            <div className="flex items-center gap-3 mb-2">
              <img
                src={`https://cdn.nba.com/headshots/nba/latest/260x190/${hoveredPlayer.id}.png`}
                alt={hoveredPlayer.name}
                className="w-12 h-12 rounded-full object-cover bg-surface"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
              <div>
                <p className="font-bold">{hoveredPlayer.name}</p>
                <p className="text-xs text-muted">{hoveredPlayer.team} • {hoveredPlayer.position}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gunmetal rounded-lg px-3 py-2">
                <p className="text-muted text-xs">PPG</p>
                <p className="font-bold text-electric-lime">{hoveredPlayer.ppg}</p>
              </div>
              <div className="bg-gunmetal rounded-lg px-3 py-2">
                <p className="text-muted text-xs">TS%</p>
                <p className="font-bold text-blue-400">{hoveredPlayer.ts?.toFixed(1)}%</p>
              </div>
            </div>
            <p className={`text-xs mt-2 ${QUADRANTS[getQuadrant(hoveredPlayer.ppg, hoveredPlayer.ts!) as keyof typeof QUADRANTS].color}`}>
              {QUADRANTS[getQuadrant(hoveredPlayer.ppg, hoveredPlayer.ts!) as keyof typeof QUADRANTS].emoji}{' '}
              {QUADRANTS[getQuadrant(hoveredPlayer.ppg, hoveredPlayer.ts!) as keyof typeof QUADRANTS].label}
            </p>
          </motion.div>
        )}
      </div>

      {/* Chart explanation */}
      <div className="mt-4 text-xs text-muted space-y-1">
        <p>
          <strong className="text-ghost-white">X-axis (PPG):</strong> Points per game — Volume of scoring
        </p>
        <p>
          <strong className="text-ghost-white">Y-axis (TS%):</strong> True shooting percentage — Efficiency of scoring
        </p>
        <p className="text-hot-pink">
          Threshold: {PPG_THRESHOLD} PPG | {TS_THRESHOLD}% TS — Click bubbles to select player
        </p>
      </div>
    </motion.div>
  )
}
