'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChartIcon, BasketballIcon } from '@/components/icons'

interface Player {
  id: number
  name: string
  team: string
  position: string
}

interface HexZone {
  id: string
  x: number
  y: number
  made: number
  attempts: number
  leagueAvg: number
  zone: string
}

interface HexShotChartProps {
  selectedPlayer?: Player | null
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '')

// Hexagon zones matching Kirk Goldsberry style - proper NBA court alignment
const ZONE_DEFINITIONS = [
  // Restricted Area
  { id: 'restricted_area', x: 0, y: 55, zone: 'Restricted Area', leagueAvg: 0.63 },
  
  // Paint (non-restricted)
  { id: 'paint_left', x: -45, y: 100, zone: 'Left Paint', leagueAvg: 0.42 },
  { id: 'paint_right', x: 45, y: 100, zone: 'Right Paint', leagueAvg: 0.42 },
  { id: 'paint_center', x: 0, y: 140, zone: 'Center Paint', leagueAvg: 0.40 },
  
  // Mid-range - inside the arc
  { id: 'mid_left_baseline', x: -120, y: 50, zone: 'Left Baseline Mid', leagueAvg: 0.40 },
  { id: 'mid_right_baseline', x: 120, y: 50, zone: 'Right Baseline Mid', leagueAvg: 0.40 },
  { id: 'mid_left', x: -90, y: 150, zone: 'Left Elbow', leagueAvg: 0.42 },
  { id: 'mid_right', x: 90, y: 150, zone: 'Right Elbow', leagueAvg: 0.42 },
  { id: 'mid_center', x: 0, y: 195, zone: 'Free Throw', leagueAvg: 0.45 },
  { id: 'mid_center_left', x: -145, y: 130, zone: 'Left Wing Mid', leagueAvg: 0.39 },
  { id: 'mid_center_right', x: 145, y: 130, zone: 'Right Wing Mid', leagueAvg: 0.39 },
  
  // Three-point zones - aligned beyond the arc
  { id: 'corner_3_left', x: -220, y: 45, zone: 'Left Corner 3', leagueAvg: 0.39 },
  { id: 'corner_3_right', x: 220, y: 45, zone: 'Right Corner 3', leagueAvg: 0.39 },
  { id: 'above_break_3_left', x: -195, y: 165, zone: 'Left Wing 3', leagueAvg: 0.36 },
  { id: 'above_break_3_right', x: 195, y: 165, zone: 'Right Wing 3', leagueAvg: 0.36 },
  { id: 'above_break_3_center_left', x: -145, y: 245, zone: 'Left Above Break 3', leagueAvg: 0.37 },
  { id: 'above_break_3_center_right', x: 145, y: 245, zone: 'Right Above Break 3', leagueAvg: 0.37 },
  { id: 'above_break_3_center', x: 0, y: 280, zone: 'Top of Key 3', leagueAvg: 0.38 },
]

// Generate player-specific zone data based on player ID (seeded random)
function generatePlayerZones(playerId: number): HexZone[] {
  let seed = playerId
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  
  // Player tendencies based on ID
  const isShooter = (playerId % 3) === 0
  const isSlasher = (playerId % 5) === 0
  const isBigMan = (playerId % 7) === 0
  
  return ZONE_DEFINITIONS.map(zone => {
    // Base attempts - varies by zone and player type
    let baseAttempts = 20 + Math.floor(random() * 30)
    let efficiency = zone.leagueAvg
    
    // Adjust by player type
    if (zone.zone.includes('3') || zone.zone.includes('Corner')) {
      if (isShooter) {
        baseAttempts *= 2
        efficiency += 0.04 + random() * 0.06
      } else if (isBigMan) {
        baseAttempts *= 0.3
        efficiency -= 0.02
      }
    } else if (zone.zone.includes('Restricted') || zone.zone.includes('Paint')) {
      if (isSlasher || isBigMan) {
        baseAttempts *= 1.8
        efficiency += 0.05 + random() * 0.05
      } else if (isShooter) {
        baseAttempts *= 0.6
      }
    } else {
      // Mid-range
      efficiency += (random() - 0.5) * 0.1
    }
    
    // Add variation
    efficiency += (random() - 0.5) * 0.08
    efficiency = Math.max(0.25, Math.min(0.70, efficiency))
    
    const attempts = Math.max(5, Math.floor(baseAttempts))
    const made = Math.floor(attempts * efficiency)
    
    return {
      id: zone.id,
      x: zone.x,
      y: zone.y,
      made,
      attempts,
      leagueAvg: zone.leagueAvg,
      zone: zone.zone,
    }
  })
}

// Get color based on efficiency relative to league average
// cheeks: red, inefficient: red-orange, below avg: orange, avg: yellow, above avg: yellow-green, excellent: green
function getEfficiencyColor(made: number, attempts: number, leagueAvg: number): string {
  if (attempts < 5) return '#374151' // Gray for low volume
  
  const pct = made / attempts
  const diff = pct - leagueAvg
  
  // Efficiency scale: red (bad) to green (good)
  if (diff < -0.10) return '#DC2626' // Cheeks - dark red
  if (diff < -0.05) return '#EA580C' // Inefficient - red-orange
  if (diff < -0.02) return '#F97316' // Below average - orange
  if (diff < 0.02) return '#EAB308'  // Average - yellow
  if (diff < 0.06) return '#84CC16' // Above average - yellow-green (lime)
  return '#22C55E' // Excellent - green
}

// Get hexagon size based on frequency
function getHexSize(attempts: number, maxAttempts: number): number {
  const minSize = 20
  const maxSize = 38
  const ratio = attempts / maxAttempts
  return minSize + (maxSize - minSize) * Math.sqrt(ratio)
}

// Hexagon path generator
function hexPath(cx: number, cy: number, size: number): string {
  const points: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    const x = cx + size * Math.cos(angle)
    const y = cy + size * Math.sin(angle)
    points.push(`${x},${y}`)
  }
  return `M ${points.join(' L ')} Z`
}

export function HexShotChart({ selectedPlayer }: HexShotChartProps) {
  const [zones, setZones] = useState<HexZone[]>([])
  const [hoveredZone, setHoveredZone] = useState<HexZone | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [usingRealData, setUsingRealData] = useState(false)
  const [apiStats, setApiStats] = useState<{ fgPct: number; threePct: number; paintPct: number; total: number } | null>(null)

  useEffect(() => {
    if (!selectedPlayer) {
      setZones([])
      setApiStats(null)
      setUsingRealData(false)
      return
    }

    const fetchZones = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`${API_URL}/api/stats/shot-zones/${selectedPlayer.id}`)
        if (res.ok) {
          const data = await res.json()
          setUsingRealData(data.using_real_data)
          setApiStats({
            fgPct: data.fg_pct || 0,
            threePct: data.three_pct || 0,
            paintPct: data.paint_pct || 0,
            total: data.total_shots || 0,
          })
          
          // Map API zones to our visualization zones
          const mappedZones: HexZone[] = []
          for (const zoneDef of ZONE_DEFINITIONS) {
            const apiZone = data.zones.find((z: { zone_key: string }) => z.zone_key === zoneDef.id)
            if (apiZone && apiZone.attempts > 0) {
              mappedZones.push({
                id: zoneDef.id,
                x: zoneDef.x,
                y: zoneDef.y,
                made: apiZone.made,
                attempts: apiZone.attempts,
                leagueAvg: apiZone.league_avg / 100, // Convert from percentage
                zone: apiZone.zone,
              })
            }
          }
          setZones(mappedZones)
        } else {
          // Fallback to generated data
          setZones(generatePlayerZones(selectedPlayer.id))
          setUsingRealData(false)
        }
      } catch (err) {
        console.error('Failed to fetch shot zones:', err)
        // Fallback to generated data
        setZones(generatePlayerZones(selectedPlayer.id))
        setUsingRealData(false)
      } finally {
        setIsLoading(false)
      }
    }

    fetchZones()
  }, [selectedPlayer?.id, selectedPlayer])

  const stats = useMemo(() => {
    // Use API stats if available
    if (apiStats && usingRealData) {
      return {
        fgPct: apiStats.fgPct.toFixed(1),
        threePct: apiStats.threePct.toFixed(1),
        paintPct: apiStats.paintPct.toFixed(1),
        totalShots: apiStats.total,
      }
    }
    
    if (zones.length === 0) return null
    
    const totalMade = zones.reduce((sum, z) => sum + z.made, 0)
    const totalAttempts = zones.reduce((sum, z) => sum + z.attempts, 0)
    const threeZones = zones.filter(z => z.zone.includes('3') || z.zone.includes('Corner'))
    const threeMade = threeZones.reduce((sum, z) => sum + z.made, 0)
    const threeAttempts = threeZones.reduce((sum, z) => sum + z.attempts, 0)
    const paintZones = zones.filter(z => z.zone.includes('Restricted') || z.zone.includes('Paint'))
    const paintMade = paintZones.reduce((sum, z) => sum + z.made, 0)
    const paintAttempts = paintZones.reduce((sum, z) => sum + z.attempts, 0)
    
    return {
      fgPct: totalAttempts > 0 ? ((totalMade / totalAttempts) * 100).toFixed(1) : '0.0',
      threePct: threeAttempts > 0 ? ((threeMade / threeAttempts) * 100).toFixed(1) : '0.0',
      paintPct: paintAttempts > 0 ? ((paintMade / paintAttempts) * 100).toFixed(1) : '0.0',
      totalShots: totalAttempts,
    }
  }, [zones, apiStats, usingRealData])

  const maxAttempts = useMemo(() => 
    Math.max(...zones.map(z => z.attempts), 1), 
    [zones]
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6 h-full min-h-[600px]"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <ChartIcon className="text-electric-lime" size={24} />
          Shot Chart
          {selectedPlayer && (
            <span className="text-muted font-normal text-sm ml-2">
              - {selectedPlayer.name}
            </span>
          )}
          {usingRealData && selectedPlayer && (
            <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              LIVE DATA
            </span>
          )}
        </h2>
        {!selectedPlayer && (
          <span className="text-sm text-muted">Select a player above</span>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="h-64 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <BasketballIcon size={32} className="text-electric-lime" />
          </motion.div>
        </div>
      )}

      {/* Stats Bar */}
      {stats && !isLoading && (
        <div className="flex gap-3 mb-4 text-sm flex-wrap">
          <div className="bg-gunmetal px-4 py-2 rounded-lg">
            <span className="text-muted">FG%:</span>{' '}
            <span className="font-bold text-electric-lime">{stats.fgPct}%</span>
          </div>
          <div className="bg-gunmetal px-4 py-2 rounded-lg">
            <span className="text-muted">3P%:</span>{' '}
            <span className="font-bold text-electric-lime">{stats.threePct}%</span>
          </div>
          <div className="bg-gunmetal px-4 py-2 rounded-lg">
            <span className="text-muted">Paint:</span>{' '}
            <span className="font-bold text-electric-lime">{stats.paintPct}%</span>
          </div>
          <div className="bg-gunmetal px-4 py-2 rounded-lg">
            <span className="text-muted">FGA:</span>{' '}
            <span className="font-bold">{stats.totalShots}</span>
          </div>
        </div>
      )}

      {/* Hovered Zone Info - Fixed position tooltip, doesn't move layout */}
      <div className="h-10 mb-2">
        {hoveredZone && (
          <div className="bg-surface px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2">
            <span className="font-bold">{hoveredZone.zone}</span>
            <span className="text-muted">•</span>
            <span>{hoveredZone.made}/{hoveredZone.attempts}</span>
            <span className="text-muted">•</span>
            <span className={
              (hoveredZone.made / hoveredZone.attempts) > hoveredZone.leagueAvg 
                ? 'text-green-500' 
                : 'text-red-500'
            }>
              {((hoveredZone.made / hoveredZone.attempts) * 100).toFixed(1)}%
            </span>
            <span className="text-muted">(Avg: {(hoveredZone.leagueAvg * 100).toFixed(0)}%)</span>
          </div>
        )}
      </div>

      {/* Court SVG */}
      <div className="relative bg-deep-void rounded-xl overflow-hidden">
        <svg
          viewBox="-250 0 500 350"
          className="w-full h-auto"
          style={{ maxHeight: '400px' }}
        >
          {/* Court Background */}
          <rect x="-250" y="0" width="500" height="350" fill="#0A0A0F" />
          
          {/* Paint */}
          <rect x="-80" y="0" width="160" height="190" fill="none" stroke="#1E293B" strokeWidth="2" />
          
          {/* Free Throw Circle */}
          <circle cx="0" cy="190" r="60" fill="none" stroke="#1E293B" strokeWidth="2" />
          
          {/* Restricted Area */}
          <path d="M -40 0 A 40 40 0 0 0 40 0" fill="none" stroke="#1E293B" strokeWidth="2" />
          
          {/* 3-Point Line - proper NBA dimensions */}
          <path
            d="M -220 0 L -220 140 A 238 238 0 0 0 220 140 L 220 0"
            fill="none"
            stroke="#1E293B"
            strokeWidth="2"
          />
          
          {/* Basket */}
          <circle cx="0" cy="40" r="8" fill="none" stroke="#EC4899" strokeWidth="3" />
          <rect x="-30" y="32" width="60" height="2" fill="#EC4899" />
          
          {/* Empty State */}
          {!selectedPlayer && (
            <g>
              <text x="0" y="160" textAnchor="middle" fill="#64748b" fontSize="16" fontFamily="sans-serif">
                Select a player to view shot chart
              </text>
              <text x="0" y="185" textAnchor="middle" fill="#475569" fontSize="12" fontFamily="sans-serif">
                Use the search above to find a player
              </text>
            </g>
          )}
          
          {/* Hexagon Zones */}
          {selectedPlayer && zones.map((zone) => {
            const size = getHexSize(zone.attempts, maxAttempts)
            const color = getEfficiencyColor(zone.made, zone.attempts, zone.leagueAvg)
            const isHovered = hoveredZone?.id === zone.id
            
            return (
              <g
                key={zone.id}
                onMouseEnter={() => setHoveredZone(zone)}
                onMouseLeave={() => setHoveredZone(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Background glow on hover - no transform to avoid layout shift */}
                {isHovered && (
                  <path
                    d={hexPath(zone.x, zone.y, size + 4)}
                    fill="none"
                    stroke="#FFF"
                    strokeWidth="2"
                    opacity={0.5}
                  />
                )}
                <motion.path
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.03 * zones.indexOf(zone) }}
                  d={hexPath(zone.x, zone.y, size)}
                  fill={color}
                  stroke={isHovered ? '#FFF' : '#000'}
                  strokeWidth={isHovered ? 2 : 1}
                  opacity={isHovered ? 1 : 0.9}
                />
                {/* Show percentage on larger hexagons */}
                {size > 26 && (
                  <text
                    x={zone.x}
                    y={zone.y + 4}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    {zone.attempts > 0 ? `${Math.round((zone.made / zone.attempts) * 100)}%` : ''}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      {selectedPlayer && (
        <div className="mt-4 space-y-3">
          {/* Efficiency Legend - Red to Green scale */}
          <div className="flex items-center justify-center gap-1 flex-wrap">
            <span className="text-xs text-muted mr-2">Efficiency</span>
            <div className="flex items-center gap-0.5">
              <span className="text-xs text-muted mr-1">Below</span>
              <div className="flex">
                <div className="w-6 h-5 rounded-l" style={{ backgroundColor: '#DC2626' }} title="Cheeks" />
                <div className="w-6 h-5" style={{ backgroundColor: '#EA580C' }} title="Inefficient" />
                <div className="w-6 h-5" style={{ backgroundColor: '#F97316' }} title="Below Avg" />
                <div className="w-6 h-5" style={{ backgroundColor: '#EAB308' }} title="Average" />
                <div className="w-6 h-5" style={{ backgroundColor: '#84CC16' }} title="Above Avg" />
                <div className="w-6 h-5 rounded-r" style={{ backgroundColor: '#22C55E' }} title="Excellent" />
              </div>
              <span className="text-xs text-muted ml-1">Above</span>
            </div>
            <span className="text-xs text-muted ml-2">Avg.</span>
          </div>
          
          {/* Frequency Legend - Size based */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-muted">Frequency</span>
            <div className="flex items-end gap-2">
              <div className="flex flex-col items-center">
                <svg viewBox="0 0 20 20" className="w-4 h-4">
                  <polygon points="10,2 18,6 18,14 10,18 2,14 2,6" fill="#6B7280" />
                </svg>
                <span className="text-[10px] text-muted">Low</span>
              </div>
              <div className="flex flex-col items-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5">
                  <polygon points="12,2 22,7 22,17 12,22 2,17 2,7" fill="#9CA3AF" />
                </svg>
                <span className="text-[10px] text-muted">Med</span>
              </div>
              <div className="flex flex-col items-center">
                <svg viewBox="0 0 28 28" className="w-7 h-7">
                  <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" fill="#D1D5DB" />
                </svg>
                <span className="text-[10px] text-muted">High</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
