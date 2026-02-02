'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChartIcon } from '@/components/icons'

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

// Hexagon zones matching Kirk Goldsberry style
const ZONE_DEFINITIONS = [
  // Restricted Area
  { id: 'ra', x: 0, y: 50, zone: 'Restricted Area', leagueAvg: 0.63 },
  
  // Paint (non-restricted)
  { id: 'paint-l', x: -50, y: 100, zone: 'Left Paint', leagueAvg: 0.42 },
  { id: 'paint-r', x: 50, y: 100, zone: 'Right Paint', leagueAvg: 0.42 },
  { id: 'paint-c', x: 0, y: 130, zone: 'Center Paint', leagueAvg: 0.40 },
  
  // Mid-range
  { id: 'mid-ll', x: -140, y: 60, zone: 'Left Baseline Mid', leagueAvg: 0.40 },
  { id: 'mid-lr', x: 140, y: 60, zone: 'Right Baseline Mid', leagueAvg: 0.40 },
  { id: 'mid-l', x: -100, y: 150, zone: 'Left Elbow', leagueAvg: 0.42 },
  { id: 'mid-r', x: 100, y: 150, zone: 'Right Elbow', leagueAvg: 0.42 },
  { id: 'mid-c', x: 0, y: 190, zone: 'Free Throw', leagueAvg: 0.45 },
  { id: 'mid-lw', x: -150, y: 140, zone: 'Left Wing Mid', leagueAvg: 0.39 },
  { id: 'mid-rw', x: 150, y: 140, zone: 'Right Wing Mid', leagueAvg: 0.39 },
  
  // Three-point zones
  { id: '3-lc', x: -200, y: 60, zone: 'Left Corner 3', leagueAvg: 0.39 },
  { id: '3-rc', x: 200, y: 60, zone: 'Right Corner 3', leagueAvg: 0.39 },
  { id: '3-lw', x: -180, y: 180, zone: 'Left Wing 3', leagueAvg: 0.36 },
  { id: '3-rw', x: 180, y: 180, zone: 'Right Wing 3', leagueAvg: 0.36 },
  { id: '3-l', x: -120, y: 260, zone: 'Left Above Break 3', leagueAvg: 0.37 },
  { id: '3-r', x: 120, y: 260, zone: 'Right Above Break 3', leagueAvg: 0.37 },
  { id: '3-c', x: 0, y: 290, zone: 'Top of Key 3', leagueAvg: 0.38 },
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
function getEfficiencyColor(made: number, attempts: number, leagueAvg: number): string {
  if (attempts < 5) return '#374151' // Gray for low volume
  
  const pct = made / attempts
  const diff = pct - leagueAvg
  
  // Red = below average, Yellow = average, Green/Orange = above average
  if (diff < -0.08) return '#DC2626' // Dark red - well below
  if (diff < -0.03) return '#EF4444' // Red - below
  if (diff < 0.02) return '#FCD34D' // Yellow - average
  if (diff < 0.06) return '#FB923C' // Orange - above
  return '#F97316' // Bright orange - well above
}

// Get hexagon size based on frequency
function getHexSize(attempts: number, maxAttempts: number): number {
  const minSize = 18
  const maxSize = 35
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

  useEffect(() => {
    if (selectedPlayer) {
      setZones(generatePlayerZones(selectedPlayer.id))
    } else {
      setZones([])
    }
  }, [selectedPlayer?.id, selectedPlayer])

  const stats = useMemo(() => {
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
  }, [zones])

  const maxAttempts = useMemo(() => 
    Math.max(...zones.map(z => z.attempts), 1), 
    [zones]
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6"
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
        </h2>
        {!selectedPlayer && (
          <span className="text-sm text-muted">Select a player above</span>
        )}
      </div>

      {/* Stats Bar */}
      {stats && (
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

      {/* Hovered Zone Info */}
      {hoveredZone && (
        <div className="bg-surface px-4 py-2 rounded-lg mb-4 text-sm">
          <span className="font-bold">{hoveredZone.zone}</span>
          <span className="mx-2">•</span>
          <span>{hoveredZone.made}/{hoveredZone.attempts}</span>
          <span className="mx-2">•</span>
          <span className={
            (hoveredZone.made / hoveredZone.attempts) > hoveredZone.leagueAvg 
              ? 'text-electric-lime' 
              : 'text-hot-pink'
          }>
            {((hoveredZone.made / hoveredZone.attempts) * 100).toFixed(1)}%
          </span>
          <span className="text-muted ml-1">(Avg: {(hoveredZone.leagueAvg * 100).toFixed(0)}%)</span>
        </div>
      )}

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
            
            return (
              <motion.g
                key={zone.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.05 * zones.indexOf(zone) }}
                onMouseEnter={() => setHoveredZone(zone)}
                onMouseLeave={() => setHoveredZone(null)}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d={hexPath(zone.x, zone.y, size)}
                  fill={color}
                  stroke="#000"
                  strokeWidth="1"
                  opacity={0.9}
                />
                {/* Show percentage on larger hexagons */}
                {size > 25 && (
                  <text
                    x={zone.x}
                    y={zone.y + 4}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="sans-serif"
                  >
                    {zone.attempts > 0 ? `${Math.round((zone.made / zone.attempts) * 100)}%` : ''}
                  </text>
                )}
              </motion.g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      {selectedPlayer && (
        <div className="mt-4 space-y-3">
          {/* Efficiency Legend */}
          <div className="flex items-center justify-center gap-1">
            <span className="text-xs text-muted mr-2">Efficiency</span>
            <div className="flex items-center">
              <span className="text-xs text-muted mr-1">Below</span>
              <div className="w-5 h-5 rounded" style={{ backgroundColor: '#DC2626' }} />
              <div className="w-5 h-5 rounded" style={{ backgroundColor: '#EF4444' }} />
              <div className="w-5 h-5 rounded" style={{ backgroundColor: '#FCD34D' }} />
              <div className="w-5 h-5 rounded" style={{ backgroundColor: '#FB923C' }} />
              <div className="w-5 h-5 rounded" style={{ backgroundColor: '#F97316' }} />
              <span className="text-xs text-muted ml-1">Above</span>
            </div>
            <span className="text-xs text-muted ml-2">Avg.</span>
          </div>
          
          {/* Frequency Legend */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-muted">Frequency</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted">Low</span>
              <div className="w-4 h-4 rounded-full bg-muted opacity-50" />
              <div className="w-5 h-5 rounded-full bg-muted opacity-70" />
              <div className="w-6 h-6 rounded-full bg-muted opacity-90" />
              <span className="text-xs text-muted">High</span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
