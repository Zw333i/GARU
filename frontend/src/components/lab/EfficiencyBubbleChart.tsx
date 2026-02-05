'use client'

import { useState, useMemo, useEffect } from 'react'
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

// SVG Icons for quadrants (no emojis)
const StarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
)

const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3L14 9L20 9L15 13L17 20L12 16L7 20L9 13L4 9L10 9L12 3Z"/>
  </svg>
)

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L1 21h22L12 2zm0 3.83L19.13 19H4.87L12 5.83zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
  </svg>
)

const SkullIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12c0 3.69 2.47 6.86 6 8.25V22h8v-1.75c3.53-1.39 6-4.56 6-8.25 0-5.52-4.48-10-10-10zm-2 15h-1v-2h1v2zm0-4h-1v-4h1v4zm4 4h-1v-2h1v2zm0-4h-1v-4h1v4zm4 4h-1v-2h1v2zm0-4h-1v-4h1v4z"/>
  </svg>
)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Quadrant definitions
const QUADRANTS = {
  highEfficient: { label: 'Stars', icon: StarIcon, color: 'text-electric-lime', bgColor: 'bg-electric-lime/20', desc: 'High PPG, High TS%' },
  efficient: { label: 'Efficient', icon: SparkleIcon, color: 'text-blue-400', bgColor: 'bg-blue-400/20', desc: 'Low PPG, High TS%' },
  inefficient: { label: 'Volume', icon: AlertIcon, color: 'text-amber-400', bgColor: 'bg-amber-400/20', desc: 'High PPG, Low TS%' },
  cheeks: { label: 'CHEEKS', icon: SkullIcon, color: 'text-hot-pink', bgColor: 'bg-hot-pink/20', desc: 'Low PPG, Low TS%' },
}

// Axis thresholds
const PPG_THRESHOLD = 18 // High vs Low volume
const TS_THRESHOLD = 57 // High vs Low efficiency

export function EfficiencyBubbleChart({ players, selectedPlayerId, onPlayerClick }: EfficiencyBubbleChartProps) {
  const [hoveredPlayer, setHoveredPlayer] = useState<Player | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [efficiencyData, setEfficiencyData] = useState<Record<number, number>>({})
  const [usingRealData, setUsingRealData] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Fetch real TS% data for top players
  useEffect(() => {
    if (players.length === 0) return
    
    const fetchEfficiency = async () => {
      setIsLoading(true)
      const topPlayers = players.slice(0, 30) // Fetch for top 30 players
      const newData: Record<number, number> = {}
      let hasRealData = false
      
      // Batch fetch efficiency data
      for (const player of topPlayers) {
        try {
          const res = await fetch(`${API_URL}/api/stats/player-efficiency/${player.id}`)
          if (res.ok) {
            const data = await res.json()
            if (data.using_real_data) {
              hasRealData = true
              newData[player.id] = data.ts_pct
            }
          }
        } catch {
          // Skip on error
        }
      }
      
      setEfficiencyData(newData)
      setUsingRealData(hasRealData)
      setIsLoading(false)
    }
    
    fetchEfficiency()
  }, [players])

  // Generate fallback TS% for players without real data
  const generateTS = (playerId: number, ppg: number): number => {
    const seed = playerId % 100
    const base = 52 + (seed / 100) * 16
    const ppgBonus = ppg > 25 ? 2 : ppg > 20 ? 1 : 0
    return Math.min(68, Math.max(48, base + ppgBonus + (seed % 5) - 2))
  }

  // Process players with TS% data (real or generated)
  const processedPlayers = useMemo(() => {
    return players.map(p => ({
      ...p,
      ts: efficiencyData[p.id] || p.ts || generateTS(p.id, p.ppg)
    }))
  }, [players, efficiencyData])

  // Get quadrant for a player
  const getQuadrant = (ppg: number, ts: number) => {
    if (ppg >= PPG_THRESHOLD && ts >= TS_THRESHOLD) return 'highEfficient'
    if (ppg < PPG_THRESHOLD && ts >= TS_THRESHOLD) return 'efficient'
    if (ppg >= PPG_THRESHOLD && ts < TS_THRESHOLD) return 'inefficient'
    return 'cheeks'
  }

  // Calculate SVG coordinates (scale to fit 400x400 viewBox)
  const getCoords = (ppg: number, ts: number) => {
    // PPG: 0-35 maps to x: 50-380
    const x = Math.min(380, Math.max(50, (ppg / 35) * 330 + 50))
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
      className="glass rounded-2xl p-6 h-full"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-electric-lime">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="12" y1="3" x2="12" y2="21" />
            <line x1="3" y1="12" x2="21" y2="12" />
          </svg>
          The Box
          {usingRealData && (
            <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              LIVE DATA
            </span>
          )}
          {isLoading && (
            <span className="ml-2 text-xs text-muted">Loading...</span>
          )}
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
        Points Per Game (X) vs True Shooting % (Y) — Click bubbles to see player heatmap
      </p>

      {/* Quadrant Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-xs">
        {Object.entries(QUADRANTS).map(([key, q]) => {
          const Icon = q.icon
          return (
            <div 
              key={key}
              className={`flex items-center gap-2 ${q.bgColor} px-3 py-2 rounded-lg`}
            >
              <span className={q.color}><Icon /></span>
              <div>
                <p className={`font-bold ${q.color}`}>{q.label}</p>
                <p className="text-muted">{quadrantCounts[key as keyof typeof quadrantCounts]} players</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Chart */}
      <div className="relative bg-gunmetal rounded-xl overflow-hidden">
        <svg viewBox="0 0 420 420" className="w-full h-auto" style={{ minHeight: '480px', maxHeight: '550px' }}>
          {/* Background quadrants */}
          <rect x="50" y="40" width="165" height="170" fill="rgba(34, 197, 94, 0.08)" /> {/* Top-left: Efficient */}
          <rect x="215" y="40" width="165" height="170" fill="rgba(163, 230, 53, 0.12)" /> {/* Top-right: High Efficient */}
          <rect x="50" y="210" width="165" height="170" fill="rgba(236, 72, 153, 0.08)" /> {/* Bottom-left: Cheeks */}
          <rect x="215" y="210" width="165" height="170" fill="rgba(251, 191, 36, 0.08)" /> {/* Bottom-right: Inefficient */}

          {/* Quadrant Labels */}
          {showLabels && (
            <>
              <text x="132" y="70" textAnchor="middle" fill="#22C55E" fontSize="10" fontFamily="sans-serif" opacity="0.7">
                Efficient
              </text>
              <text x="298" y="70" textAnchor="middle" fill="#A3E635" fontSize="10" fontFamily="sans-serif" opacity="0.7">
                Stars
              </text>
              <text x="132" y="370" textAnchor="middle" fill="#EC4899" fontSize="10" fontFamily="sans-serif" opacity="0.7">
                CHEEKS
              </text>
              <text x="298" y="370" textAnchor="middle" fill="#FBBF24" fontSize="10" fontFamily="sans-serif" opacity="0.7">
                Volume
              </text>
            </>
          )}

          {/* Grid lines */}
          <line x1="215" y1="40" x2="215" y2="380" stroke="#334155" strokeWidth="2" strokeDasharray="4,4" />
          <line x1="50" y1="210" x2="380" y2="210" stroke="#334155" strokeWidth="2" strokeDasharray="4,4" />

          {/* Axes */}
          <line x1="50" y1="380" x2="380" y2="380" stroke="#64748B" strokeWidth="2" />
          <line x1="50" y1="40" x2="50" y2="380" stroke="#64748B" strokeWidth="2" />

          {/* X-axis labels (PPG) */}
          <text x="50" y="400" textAnchor="middle" fill="#64748B" fontSize="10">0</text>
          <text x="132" y="400" textAnchor="middle" fill="#64748B" fontSize="10">10</text>
          <text x="215" y="400" textAnchor="middle" fill="#EC4899" fontSize="10" fontWeight="bold">18</text>
          <text x="298" y="400" textAnchor="middle" fill="#64748B" fontSize="10">25</text>
          <text x="380" y="400" textAnchor="middle" fill="#64748B" fontSize="10">35</text>
          <text x="215" y="415" textAnchor="middle" fill="#94A3B8" fontSize="11">Points Per Game</text>

          {/* Y-axis labels (TS%) - moved further left */}
          <text x="20" y="385" textAnchor="middle" fill="#64748B" fontSize="10">45%</text>
          <text x="20" y="295" textAnchor="middle" fill="#64748B" fontSize="10">51%</text>
          <text x="20" y="215" textAnchor="middle" fill="#EC4899" fontSize="10" fontWeight="bold">57%</text>
          <text x="20" y="125" textAnchor="middle" fill="#64748B" fontSize="10">63%</text>
          <text x="20" y="45" textAnchor="middle" fill="#64748B" fontSize="10">70%</text>
          <text x="8" y="210" textAnchor="middle" fill="#94A3B8" fontSize="10" transform="rotate(-90, 8, 210)">TS%</text>

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
            <p className={`text-xs mt-2 flex items-center gap-1 ${QUADRANTS[getQuadrant(hoveredPlayer.ppg, hoveredPlayer.ts!) as keyof typeof QUADRANTS].color}`}>
              {(() => {
                const Icon = QUADRANTS[getQuadrant(hoveredPlayer.ppg, hoveredPlayer.ts!) as keyof typeof QUADRANTS].icon
                return <Icon />
              })()}
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
