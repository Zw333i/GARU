'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { HexShotChart } from '@/components/lab/HexShotChart'
import { StatGlossary } from '@/components/lab/StatGlossary'
import { EfficiencyBubbleChart } from '@/components/lab/EfficiencyBubbleChart'
import { PlayerImage } from '@/components/ui/PlayerImage'
import { LabIcon, SearchIcon } from '@/components/icons'
import { supabase, incrementStatViews } from '@/lib/supabase'

// Player type from database
interface Player {
  id: number
  name: string
  team: string
  position: string
  ppg: number
  rpg: number
  apg: number
}

// Fallback players - 2025-26 Season Stars + 2010s Legends
const FALLBACK_PLAYERS: Player[] = [
  // Current Stars (2025-26)
  { id: 203999, name: 'Nikola Jokic', team: 'DEN', position: 'C', ppg: 27.5, rpg: 13.1, apg: 10.2 },
  { id: 1629029, name: 'Luka Doncic', team: 'DAL', position: 'PG', ppg: 28.8, rpg: 8.3, apg: 7.8 },
  { id: 203507, name: 'Giannis Antetokounmpo', team: 'MIL', position: 'PF', ppg: 31.5, rpg: 12.0, apg: 6.1 },
  { id: 1628369, name: 'Jayson Tatum', team: 'BOS', position: 'SF', ppg: 27.8, rpg: 9.0, apg: 5.5 },
  { id: 201939, name: 'Stephen Curry', team: 'GSW', position: 'PG', ppg: 25.8, rpg: 4.4, apg: 5.3 },
  { id: 203954, name: 'Joel Embiid', team: 'PHI', position: 'C', ppg: 27.3, rpg: 8.6, apg: 3.8 },
  { id: 2544, name: 'LeBron James', team: 'LAL', position: 'SF', ppg: 24.2, rpg: 7.1, apg: 8.0 },
  { id: 201142, name: 'Kevin Durant', team: 'PHX', position: 'SF', ppg: 27.1, rpg: 6.6, apg: 4.3 },
  { id: 1628983, name: 'Shai Gilgeous-Alexander', team: 'OKC', position: 'PG', ppg: 31.4, rpg: 5.5, apg: 6.0 },
  { id: 1630162, name: 'Anthony Edwards', team: 'MIN', position: 'SG', ppg: 27.2, rpg: 5.8, apg: 4.5 },
  { id: 1629630, name: 'Ja Morant', team: 'MEM', position: 'PG', ppg: 24.8, rpg: 5.4, apg: 8.5 },
  { id: 1627759, name: 'Jaylen Brown', team: 'BOS', position: 'SG', ppg: 24.5, rpg: 5.8, apg: 4.0 },
  { id: 202681, name: 'Kyrie Irving', team: 'DAL', position: 'PG', ppg: 25.6, rpg: 5.0, apg: 5.2 },
  { id: 1641705, name: 'Victor Wembanyama', team: 'SAS', position: 'C', ppg: 21.4, rpg: 10.6, apg: 3.9 },
  { id: 1628973, name: 'Jalen Brunson', team: 'NYK', position: 'PG', ppg: 26.3, rpg: 3.8, apg: 7.2 },
  { id: 203081, name: 'Damian Lillard', team: 'MIL', position: 'PG', ppg: 25.1, rpg: 4.2, apg: 7.0 },
  { id: 1626164, name: 'Devin Booker', team: 'PHX', position: 'SG', ppg: 27.5, rpg: 4.8, apg: 7.2 },
  { id: 1629027, name: 'Trae Young', team: 'ATL', position: 'PG', ppg: 26.8, rpg: 3.0, apg: 11.2 },
  { id: 1628378, name: 'Donovan Mitchell', team: 'CLE', position: 'SG', ppg: 27.5, rpg: 4.2, apg: 5.5 },
  { id: 1630595, name: 'Cade Cunningham', team: 'DET', position: 'PG', ppg: 24.2, rpg: 4.8, apg: 8.0 },
  
  // Role Players (2025-26)
  { id: 1628389, name: 'Bam Adebayo', team: 'MIA', position: 'C', ppg: 20.5, rpg: 10.8, apg: 5.2 },
  { id: 1627734, name: 'Domantas Sabonis', team: 'SAC', position: 'C', ppg: 20.1, rpg: 14.2, apg: 8.5 },
  { id: 1628386, name: 'Jarrett Allen', team: 'CLE', position: 'C', ppg: 17.2, rpg: 11.0, apg: 1.8 },
  { id: 1628969, name: 'Mikal Bridges', team: 'NYK', position: 'SF', ppg: 19.6, rpg: 4.5, apg: 3.2 },
  { id: 1628401, name: 'Derrick White', team: 'BOS', position: 'SG', ppg: 15.2, rpg: 4.2, apg: 5.2 },
  { id: 1627826, name: 'Ivica Zubac', team: 'LAC', position: 'C', ppg: 11.7, rpg: 9.2, apg: 1.4 },
  { id: 1628966, name: 'Luguentz Dort', team: 'OKC', position: 'SG', ppg: 10.8, rpg: 3.8, apg: 1.8 },
  { id: 1629684, name: 'Franz Wagner', team: 'ORL', position: 'SF', ppg: 19.7, rpg: 5.3, apg: 3.7 },
  { id: 1630578, name: 'Alperen Sengun', team: 'HOU', position: 'C', ppg: 19.0, rpg: 10.3, apg: 5.0 },
  { id: 1630224, name: 'Jalen Green', team: 'HOU', position: 'SG', ppg: 22.1, rpg: 5.2, apg: 3.5 },
  
  // 2010s Legends (Retired/Late Career)
  { id: 977, name: 'Kobe Bryant', team: 'LAL', position: 'SG', ppg: 25.0, rpg: 5.2, apg: 4.7 },
  { id: 1495, name: 'Tim Duncan', team: 'SAS', position: 'PF', ppg: 19.0, rpg: 10.8, apg: 3.0 },
  { id: 1718, name: 'Dirk Nowitzki', team: 'DAL', position: 'PF', ppg: 20.7, rpg: 7.5, apg: 2.4 },
  { id: 2546, name: 'Carmelo Anthony', team: 'DEN', position: 'SF', ppg: 22.5, rpg: 6.2, apg: 2.7 },
  { id: 1717, name: 'Pau Gasol', team: 'LAL', position: 'C', ppg: 17.0, rpg: 9.2, apg: 3.2 },
  { id: 101106, name: 'Tony Parker', team: 'SAS', position: 'PG', ppg: 15.5, rpg: 2.7, apg: 5.6 },
  { id: 1884, name: 'Manu Ginobili', team: 'SAS', position: 'SG', ppg: 13.3, rpg: 3.5, apg: 3.8 },
  { id: 2548, name: 'Dwyane Wade', team: 'MIA', position: 'SG', ppg: 22.0, rpg: 4.7, apg: 5.4 },
  { id: 101108, name: 'Chris Paul', team: 'SAS', position: 'PG', ppg: 8.5, rpg: 3.5, apg: 7.2 },
  { id: 201565, name: 'Derrick Rose', team: 'MEM', position: 'PG', ppg: 7.5, rpg: 1.8, apg: 2.0 },
  { id: 201566, name: 'Russell Westbrook', team: 'DEN', position: 'PG', ppg: 10.0, rpg: 5.5, apg: 6.5 },
  { id: 200765, name: 'Rajon Rondo', team: 'BOS', position: 'PG', ppg: 10.0, rpg: 4.5, apg: 8.0 },
  { id: 2730, name: 'Dwight Howard', team: 'ORL', position: 'C', ppg: 17.4, rpg: 12.4, apg: 1.4 },
  { id: 2037, name: 'Vince Carter', team: 'TOR', position: 'SG', ppg: 16.7, rpg: 4.3, apg: 3.1 },
  { id: 1891, name: 'Ray Allen', team: 'MIA', position: 'SG', ppg: 18.9, rpg: 4.1, apg: 3.4 },
  { id: 101113, name: 'Paul Pierce', team: 'BOS', position: 'SF', ppg: 19.7, rpg: 5.6, apg: 3.5 },
  { id: 708, name: 'Kevin Garnett', team: 'MIN', position: 'PF', ppg: 17.8, rpg: 10.0, apg: 3.7 },
  { id: 947, name: 'Shaquille ONeal', team: 'LAL', position: 'C', ppg: 23.7, rpg: 10.9, apg: 2.5 },
  { id: 959, name: 'Steve Nash', team: 'PHX', position: 'PG', ppg: 14.3, rpg: 3.0, apg: 8.5 },
  { id: 1897, name: 'Jason Kidd', team: 'DAL', position: 'PG', ppg: 12.6, rpg: 6.3, apg: 8.7 },
  { id: 1497, name: 'Tracy McGrady', team: 'ORL', position: 'SG', ppg: 19.6, rpg: 5.6, apg: 4.4 },
  { id: 1899, name: 'Allen Iverson', team: 'PHI', position: 'PG', ppg: 26.7, rpg: 3.7, apg: 6.2 },
  { id: 1740, name: 'Gary Payton', team: 'SEA', position: 'PG', ppg: 16.3, rpg: 3.9, apg: 6.7 },
  { id: 200746, name: 'LaMarcus Aldridge', team: 'SAS', position: 'PF', ppg: 19.4, rpg: 8.2, apg: 2.0 },
  { id: 200794, name: 'Marc Gasol', team: 'MEM', position: 'C', ppg: 14.0, rpg: 7.7, apg: 3.4 },
]

export default function LabPage() {
  const searchParams = useSearchParams()
  const playerIdParam = searchParams.get('player')
  
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [heatmapLoading, setHeatmapLoading] = useState(false)
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null)
  const [heatmapError, setHeatmapError] = useState<string | null>(null)

  // Fetch players from Supabase
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const { data, error } = await supabase
          .from('cached_players')
          .select('player_id, full_name, team_abbreviation, position, season_stats')
          .order('season_stats->pts', { ascending: false })
          .limit(500)
        
        if (error) {
          // Silently fall back if table doesn't exist or connection fails
          console.warn('Using fallback player data (database unavailable)')
          setPlayers(FALLBACK_PLAYERS)
          return
        }
        
        if (data && data.length > 0) {
          interface CachedPlayer {
            player_id: number
            full_name: string
            team_abbreviation: string | null
            position: string | null
            season_stats: {
              pts?: number
              reb?: number
              ast?: number
            } | null
          }
          const mappedPlayers: Player[] = (data as CachedPlayer[]).map(p => ({
            id: p.player_id,
            name: p.full_name,
            team: p.team_abbreviation || '',
            position: p.position || 'N/A',
            ppg: p.season_stats?.pts || 0,
            rpg: p.season_stats?.reb || 0,
            apg: p.season_stats?.ast || 0
          }))
          setPlayers(mappedPlayers)
        } else {
          setPlayers(FALLBACK_PLAYERS)
        }
      } catch {
        // Network error or other issue - use fallback silently
        setPlayers(FALLBACK_PLAYERS)
      } finally {
        setLoading(false)
      }
    }
    
    fetchPlayers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase())
  )

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
        // Try to fetch from Python backend
        const response = await fetch(`http://localhost:8000/api/stats/heatmap/${selectedPlayer.id}`)
        
        if (!response.ok) {
          throw new Error('Heatmap generation failed')
        }
        
        const blob = await response.blob()
        currentUrl = URL.createObjectURL(blob)
        setHeatmapUrl(currentUrl)
      } catch {
        // Backend not running - show placeholder
        setHeatmapError('Python backend not running. Start with: python backend/main.py')
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
    
    // Track stat view for achievement
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await incrementStatViews(user.id)
      }
    } catch {
      // Silently fail achievement tracking
    }
  }

  // Loading state
  if (loading) {
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
          <div className="animate-spin w-12 h-12 border-4 border-electric-lime border-t-transparent rounded-full"></div>
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
                setShowResults(e.target.value.length > 0)
              }}
              onFocus={() => query.length > 0 && setShowResults(true)}
              placeholder="Search for a player..."
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shot Chart - passes selected player */}
        <div className="lg:col-span-2">
          <HexShotChart selectedPlayer={selectedPlayer} />
        </div>

        {/* Stat Glossary */}
        <div>
          <StatGlossary />
        </div>
      </div>

      {/* Efficiency Bubble Chart - Full Width */}
      <section className="mt-8">
        <EfficiencyBubbleChart 
          players={players}
          selectedPlayerId={selectedPlayer?.id}
          onPlayerClick={(player) => {
            // Find the full player data from our players array
            const fullPlayer = players.find(p => p.id === player.id)
            if (fullPlayer) handleSelect(fullPlayer)
          }}
        />
      </section>

      {/* Heatmap Section */}
      {selectedPlayer && (
        <section className="mt-8">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-xl font-display font-bold mb-4">
              Scoring Density Heatmap
            </h2>
            <p className="text-muted text-sm mb-4">
              KDE visualization showing {selectedPlayer.name}&apos;s shot distribution relative to league averages.
            </p>
            
            {/* Heatmap Display - Auto-generated */}
            <div className="bg-gunmetal rounded-xl p-4">
              {heatmapLoading && (
                <div className="w-full h-64 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-electric-lime border-t-transparent rounded-full mx-auto mb-3"></div>
                    <p className="text-muted">Generating heatmap for {selectedPlayer.name}...</p>
                  </div>
                </div>
              )}
              
              {heatmapUrl && !heatmapLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center"
                >
                  <img 
                    src={heatmapUrl} 
                    alt={`${selectedPlayer.name} Shot Heatmap`}
                    className="max-w-full h-auto rounded-lg"
                  />
                </motion.div>
              )}
              
              {heatmapError && !heatmapLoading && (
                <div className="w-full h-64 flex items-center justify-center">
                  <div className="text-center max-w-md">
                    <LabIcon className="text-muted mx-auto mb-3" size={48} />
                    <p className="text-muted mb-2">Advanced heatmap visualization</p>
                    <p className="text-xs text-warning bg-surface/50 px-4 py-2 rounded-lg">
                      {heatmapError}
                    </p>
                    <p className="text-xs text-muted mt-3">
                      Endpoint: <code className="bg-surface px-2 py-1 rounded">/api/stats/heatmap/{selectedPlayer.id}</code>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
