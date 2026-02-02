'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ChartIcon } from '@/components/icons'

interface Player {
  id: number
  name: string
  team: string
  position: string
}

interface Shot {
  x: number
  y: number
  made: boolean
  isThree: boolean
}

interface ShotChartVisualizerProps {
  selectedPlayer?: Player | null
}

// Generate mock shots - seeded by player ID for consistency
const generateMockShots = (playerId: number) => {
  const shots: Shot[] = []
  // Use player ID as seed for consistent shot patterns per player
  let seed = playerId
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  
  // Different shot patterns based on position
  const shotCount = 100 + Math.floor(random() * 100)
  const threePointBias = random() * 0.5 + 0.2 // 20-70% three point tendency
  
  for (let i = 0; i < shotCount; i++) {
    let x: number, y: number
    
    if (random() < threePointBias) {
      // Three pointer
      const angle = random() * Math.PI
      const radius = 220 + random() * 30
      x = Math.cos(angle) * radius
      y = Math.sin(angle) * 200 + 80
    } else {
      // Two pointer
      x = random() * 300 - 150
      y = random() * 180 + 40
    }
    
    const distance = Math.sqrt(x * x + (y - 60) * (y - 60))
    const isThree = distance > 220
    // Closer shots have higher make rate
    const makeChance = 0.6 - (distance / 500)
    const made = random() > (1 - makeChance - 0.1)
    
    shots.push({ x, y, made, isThree })
  }
  return shots
}

export function ShotChartVisualizer({ selectedPlayer }: ShotChartVisualizerProps) {
  const [shots, setShots] = useState<Shot[]>([])
  const [showMade, setShowMade] = useState(true)
  const [showMissed, setShowMissed] = useState(true)
  const svgRef = useRef<SVGSVGElement>(null)

  // Regenerate shots when player changes - only if player is selected
  useEffect(() => {
    if (selectedPlayer) {
      const newShots = generateMockShots(selectedPlayer.id)
      setShots(newShots)
    } else {
      setShots([]) // Clear shots when no player
    }
  }, [selectedPlayer?.id, selectedPlayer])

  // Calculate stats
  const madeShots = shots.filter(s => s.made)
  const missedShots = shots.filter(s => !s.made)
  const fgPercent = shots.length > 0 ? ((madeShots.length / shots.length) * 100).toFixed(1) : '0.0'
  const threePointers = shots.filter(s => s.isThree)
  const threePercent = threePointers.length > 0 
    ? ((threePointers.filter(s => s.made).length / threePointers.length) * 100).toFixed(1) 
    : '0.0'

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
      {selectedPlayer ? (
        <div className="flex gap-4 mb-4 text-sm flex-wrap">
          <div className="bg-gunmetal px-4 py-2 rounded-lg">
            <span className="text-muted">FG%:</span>{' '}
            <span className="font-bold text-electric-lime">{fgPercent}%</span>
          </div>
          <div className="bg-gunmetal px-4 py-2 rounded-lg">
            <span className="text-muted">3P%:</span>{' '}
            <span className="font-bold text-electric-lime">{threePercent}%</span>
          </div>
          <div className="bg-gunmetal px-4 py-2 rounded-lg">
            <span className="text-muted">Shots:</span>{' '}
            <span className="font-bold">{shots.length}</span>
          </div>
        </div>
      ) : null}

      {/* Filters */}
      {selectedPlayer ? (
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setShowMade(!showMade)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showMade ? 'bg-electric-lime/20 text-electric-lime' : 'bg-gunmetal text-muted'
            }`}
          >
            <span className="w-3 h-3 rounded-full bg-electric-lime"></span>
            Made ({madeShots.length})
          </button>
          <button
            onClick={() => setShowMissed(!showMissed)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showMissed ? 'bg-hot-pink/20 text-hot-pink' : 'bg-gunmetal text-muted'
            }`}
          >
            <span className="w-3 h-3 rounded-full bg-hot-pink"></span>
            Missed ({missedShots.length})
          </button>
        </div>
      ) : null}

      {/* Court SVG */}
      <div className="relative bg-gunmetal rounded-xl overflow-hidden">
        <svg
          ref={svgRef}
          viewBox="-250 0 500 500"
          className="w-full h-auto"
          style={{ maxHeight: '400px' }}
        >
          {/* Court Floor */}
          <rect x="-250" y="0" width="500" height="500" fill="#1E293B" />
          
          {/* Paint */}
          <rect x="-80" y="0" width="160" height="190" fill="none" stroke="#334155" strokeWidth="2" />
          
          {/* Free Throw Circle */}
          <circle cx="0" cy="190" r="60" fill="none" stroke="#334155" strokeWidth="2" />
          
          {/* Restricted Area */}
          <path d="M -40 0 A 40 40 0 0 0 40 0" fill="none" stroke="#334155" strokeWidth="2" />
          
          {/* 3-Point Line */}
          <path
            d="M -220 0 L -220 140 Q -220 280 0 280 Q 220 280 220 140 L 220 0"
            fill="none"
            stroke="#334155"
            strokeWidth="2"
          />
          
          {/* Basket */}
          <circle cx="0" cy="60" r="8" fill="none" stroke="#EC4899" strokeWidth="3" />
          <rect x="-30" y="52" width="60" height="2" fill="#EC4899" />
          
          {/* Empty State - No player selected */}
          {!selectedPlayer && (
            <g>
              <text x="0" y="220" textAnchor="middle" fill="#64748b" fontSize="16" fontFamily="sans-serif">
                Select a player to view shot chart
              </text>
              <text x="0" y="250" textAnchor="middle" fill="#475569" fontSize="12" fontFamily="sans-serif">
                Use the search above to find a player
              </text>
            </g>
          )}
          
          {/* Shot Points - only render when player selected */}
          {selectedPlayer && shots.map((shot, i) => {
            if (shot.made && !showMade) return null
            if (!shot.made && !showMissed) return null
            
            return (
              <motion.circle
                key={`${selectedPlayer.id}-${i}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.7 }}
                transition={{ delay: i * 0.002 }}
                cx={shot.x}
                cy={shot.y}
                r="6"
                className={shot.made ? 'shot-made' : 'shot-missed'}
              />
            )
          })}
        </svg>
      </div>

      {/* Legend - only show when player selected */}
      {selectedPlayer && (
        <div className="flex justify-center gap-6 mt-4 text-sm text-muted">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-electric-lime"></span>
            Made Shot
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-hot-pink"></span>
            Missed Shot
          </div>
        </div>
      )}
    </motion.div>
  )
}
