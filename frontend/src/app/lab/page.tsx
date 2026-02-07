'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { HexShotChart } from '@/components/lab/HexShotChart'
import { StatGlossary } from '@/components/lab/StatGlossary'
import { EfficiencyBubbleChart } from '@/components/lab/EfficiencyBubbleChart'
import { ShotDistributionChart } from '@/components/lab/ShotDistributionChart'
import { PlayerImage } from '@/components/ui/PlayerImage'
import { LabIcon, SearchIcon } from '@/components/icons'
import { incrementStatViews } from '@/lib/supabase'
import { BasketballLoader } from '@/components/ui/BasketballLoader'
import { usePlayersStore, CachedPlayer } from '@/store/playersStore'
import { useAuthStore } from '@/store/authStore'

// API URL from environment
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Player type for this page (alias to CachedPlayer)
type Player = CachedPlayer

export default function LabPage() {
  const searchParams = useSearchParams()
  const playerIdParam = searchParams.get('player')
  
  // Use session-cached players store instead of local fetch
  const { players, isLoaded, isLoading: playersLoading, fetchPlayers, searchPlayers } = usePlayersStore()
  
  // Use centralized auth store
  const { user } = useAuthStore()
  
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [heatmapLoading, setHeatmapLoading] = useState(false)
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null)
  const [heatmapError, setHeatmapError] = useState<string | null>(null)
  const [showFullscreen, setShowFullscreen] = useState(false)

  // Ensure players are loaded (uses session cache)
  useEffect(() => {
    if (!isLoaded && !playersLoading) {
      fetchPlayers()
    }
  }, [isLoaded, playersLoading, fetchPlayers])

  // Download heatmap image
  const handleDownload = async () => {
    if (!heatmapUrl || !selectedPlayer) return
    try {
      const response = await fetch(heatmapUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${selectedPlayer.name.replace(/\s+/g, '_')}_heatmap.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  // Handle URL parameter to auto-select player
  useEffect(() => {
    if (playerIdParam && players.length > 0) {
      const playerId = parseInt(playerIdParam)
      const player = players.find(p => p.id === playerId)
      if (player) {
        setSelectedPlayer(player)
        setQuery(player.name)
      }
    }
  }, [playerIdParam, players])

  // Require minimum 2 characters to prevent single-letter matches
  const filteredPlayers = query.length >= 2 
    ? searchPlayers(query)
    : []

  // Auto-fetch heatmap when player is selected
  useEffect(() => {
    if (!selectedPlayer) {
      setHeatmapUrl(null)
      setHeatmapError(null)
      return
    }

    let currentUrl: string | null = null

    const fetchHeatmap = async () => {
      setHeatmapLoading(true)
      setHeatmapError(null)
      
      try {
        // Add cache-busting timestamp to prevent browser caching
        const timestamp = Date.now()
        const response = await fetch(`${API_URL}/api/stats/heatmap/${selectedPlayer.id}?t=${timestamp}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        })
        
        if (!response.ok) {
          throw new Error('Heatmap generation failed')
        }
        
        const blob = await response.blob()
        currentUrl = URL.createObjectURL(blob)
        setHeatmapUrl(currentUrl)
      } catch {
        // Backend not running - show placeholder
        setHeatmapError('Backend not available. Start with: cd backend && python main.py')
        setHeatmapUrl(null)
      } finally {
        setHeatmapLoading(false)
      }
    }

    fetchHeatmap()

    // Cleanup blob URL on unmount or player change
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }
    }
  }, [selectedPlayer?.id])

  const handleSelect = async (player: Player) => {
    setSelectedPlayer(player)
    setQuery(player.name)
    setShowResults(false)
    
    // Track stat view for achievement using cached user
    try {
      if (user) {
        await incrementStatViews(user.id)
      }
    } catch {
      // Silently fail achievement tracking
    }
  }

  // Loading state with basketball loader
  if (playersLoading && !isLoaded) {
    return (
      <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
        <section className="mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2 flex items-center gap-3">
            <LabIcon className="text-electric-lime" size={36} />
            The Lab
          </h1>
          <p className="text-muted text-lg">Loading players...</p>
        </section>
        <div className="flex justify-center py-12">
          <BasketballLoader size="lg" text="Fetching player data..." />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
      {/* Header */}
      <section className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-2 flex items-center gap-3">
          <LabIcon className="text-electric-lime" size={36} />
          The Lab
        </h1>
        <p className="text-muted text-lg">
          Explore advanced stats and visualizations
        </p>
      </section>

      {/* Player Search - z-40 to ensure dropdown appears above shot chart */}
      <section className="mb-8 relative z-40">
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-display font-bold mb-4">Select Player</h2>
          
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowResults(e.target.value.length >= 2)
              }}
              onFocus={() => query.length >= 2 && setShowResults(true)}
              placeholder="Search..."
              className="w-full px-4 py-3 pl-12 bg-gunmetal border border-surface rounded-xl text-ghost-white placeholder-muted focus:outline-none focus:border-electric-lime transition-colors"
            />
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />

            {/* Search Results Dropdown - z-50 to ensure it's above all other content */}
            {showResults && filteredPlayers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full left-0 right-0 mt-2 bg-gunmetal border border-surface rounded-xl overflow-hidden z-50 max-h-80 overflow-y-auto shadow-2xl"
              >
                {filteredPlayers.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => handleSelect(player)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-surface overflow-hidden">
                      <PlayerImage
                        playerId={player.id}
                        playerName={player.name}
                        size="sm"
                        className="w-full h-full rounded-full"
                        animate={false}
                      />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{player.name}</p>
                      <p className="text-sm text-muted">{player.team} • {player.position}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Selected Player Card */}
          {selectedPlayer && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-4 p-4 bg-gunmetal rounded-xl"
            >
              <div className="w-16 h-16 rounded-full bg-surface overflow-hidden border-2 border-electric-lime">
                <PlayerImage
                  playerId={selectedPlayer.id}
                  playerName={selectedPlayer.name}
                  size="md"
                  className="w-full h-full rounded-full"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-bold text-lg">{selectedPlayer.name}</h3>
                <p className="text-muted text-sm">{selectedPlayer.team} • {selectedPlayer.position}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xl font-bold text-electric-lime">{selectedPlayer.ppg}</p>
                  <p className="text-xs text-muted">PPG</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-blue-400">{selectedPlayer.rpg}</p>
                  <p className="text-xs text-muted">RPG</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-hot-pink">{selectedPlayer.apg}</p>
                  <p className="text-xs text-muted">APG</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Shot Chart - passes selected player */}
        <div className="lg:col-span-2 flex">
          <div className="w-full">
            <HexShotChart selectedPlayer={selectedPlayer} />
          </div>
        </div>

        {/* Stat Glossary - matches Shot Chart height */}
        <div className="flex">
          <StatGlossary />
        </div>
      </div>

      {/* The Box + Heatmap - Side by Side */}
      <section className="mt-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          {/* The Box (Efficiency Bubble Chart) */}
          <EfficiencyBubbleChart 
            players={players}
            selectedPlayerId={selectedPlayer?.id}
            onPlayerClick={(player) => {
              // Find the full player data from our players array
              const fullPlayer = players.find(p => p.id === player.id)
              if (fullPlayer) handleSelect(fullPlayer)
            }}
          />

          {/* Heatmap - Side by side with The Box */}
          <div className="glass rounded-2xl p-6 h-full flex flex-col">
            <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-hot-pink">
                <path d="M12 2C8 6 4 10 4 14a8 8 0 1016 0c0-4-4-8-8-12z"/>
              </svg>
              Scoring Density
              {selectedPlayer && (
                <span className="text-muted font-normal text-sm ml-2">
                  - {selectedPlayer.name}
                </span>
              )}
            </h2>
            
            {/* Heatmap + Shot Distribution - Flex to fill container */}
            <div className="flex-1 flex flex-col">
              {/* Heatmap Display */}
              <div className="bg-gunmetal rounded-xl p-4 flex-1 min-h-[350px] flex items-center justify-center">
                {!selectedPlayer && (
                  <div className="text-center text-muted">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
                      <path d="M12 2C8 6 4 10 4 14a8 8 0 1016 0c0-4-4-8-8-12z"/>
                    </svg>
                    <p className="text-sm">Select a player from The Box</p>
                    <p className="text-xs mt-1">to view their shot heatmap</p>
                  </div>
                )}

              {selectedPlayer && heatmapLoading && (
                <div className="text-center">
                  <BasketballLoader />
                  <p className="text-muted mt-3">Generating heatmap...</p>
                </div>
              )}
              
              {selectedPlayer && heatmapUrl && !heatmapLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center w-full"
                >
                  <img 
                    src={heatmapUrl} 
                    alt={`${selectedPlayer.name} Shot Heatmap`}
                    className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ maxHeight: '380px' }}
                    onClick={() => setShowFullscreen(true)}
                    title="Click to view fullscreen"
                  />
                  <p className="text-xs text-muted mt-2">Click image to view fullscreen</p>
                </motion.div>
              )}
              
              {selectedPlayer && heatmapError && !heatmapLoading && (
                <div className="text-center max-w-md">
                  <LabIcon className="text-muted mx-auto mb-3" size={48} />
                  <p className="text-muted mb-2">Backend required for heatmap</p>
                  <p className="text-xs text-amber-400 bg-surface/50 px-4 py-2 rounded-lg">
                    Run: cd backend &amp;&amp; python main.py
                  </p>
                </div>
              )}
              </div>

              {/* Shot Distribution Bar Chart - Below Heatmap */}
              {selectedPlayer && (
                <div className="mt-4">
                  <ShotDistributionChart selectedPlayer={selectedPlayer} />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Fullscreen Heatmap Modal */}
      <AnimatePresence>
        {showFullscreen && heatmapUrl && selectedPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col"
            onClick={() => setShowFullscreen(false)}
          >
            {/* Fixed Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-4 md:px-8">
              <h2 className="text-lg md:text-xl font-bold text-white">{selectedPlayer.name} - Shot Heatmap</h2>
              <button
                onClick={() => setShowFullscreen(false)}
                className="text-white hover:text-electric-lime transition-colors p-2"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Scrollable Image Container */}
            <div 
              className="flex-1 overflow-auto flex items-center justify-center px-4"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={heatmapUrl} 
                alt={`${selectedPlayer.name} Shot Heatmap`}
                className="max-w-full max-h-[calc(100vh-200px)] w-auto h-auto rounded-lg object-contain"
              />
            </div>
            
            {/* Fixed Footer with Download Button */}
            <div 
              className="flex-shrink-0 flex flex-col items-center gap-2 p-4 md:pb-6"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-6 py-3 bg-electric-lime text-gunmetal font-bold rounded-lg hover:bg-electric-lime/90 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Download Heatmap
              </button>
              <p className="text-muted text-sm">Click outside or press X to close</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
