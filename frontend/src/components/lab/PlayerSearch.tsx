'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

// Mock players for search
const players = [
  { id: 203999, name: 'Nikola Jokic', team: 'DEN', position: 'C' },
  { id: 201566, name: 'Luka Doncic', team: 'DAL', position: 'PG' },
  { id: 203507, name: 'Giannis Antetokounmpo', team: 'MIL', position: 'PF' },
  { id: 1628369, name: 'Jayson Tatum', team: 'BOS', position: 'SF' },
  { id: 203954, name: 'Joel Embiid', team: 'PHI', position: 'C' },
  { id: 2544, name: 'LeBron James', team: 'LAL', position: 'SF' },
  { id: 201142, name: 'Kevin Durant', team: 'PHX', position: 'SF' },
  { id: 201939, name: 'Stephen Curry', team: 'GSW', position: 'PG' },
]

export function PlayerSearch() {
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<typeof players[0] | null>(null)

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase())
  )

  const handleSelect = (player: typeof players[0]) => {
    setSelectedPlayer(player)
    setQuery(player.name)
    setShowResults(false)
  }

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-display font-bold mb-4">Search Player</h2>
      
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowResults(e.target.value.length > 0)
          }}
          onFocus={() => query.length > 0 && setShowResults(true)}
          placeholder="Type a player name..."
          className="w-full px-4 py-3 pl-10 bg-gunmetal border border-surface rounded-xl text-ghost-white placeholder-muted focus:outline-none focus:border-electric-lime transition-colors"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        {/* Search Results Dropdown */}
        {showResults && filteredPlayers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full left-0 right-0 mt-2 bg-gunmetal border border-surface rounded-xl overflow-hidden z-20"
          >
            {filteredPlayers.map((player) => (
              <button
                key={player.id}
                onClick={() => handleSelect(player)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-surface overflow-hidden">
                  <img
                    src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.id}.png`}
                    alt={player.name}
                    className="w-full h-full object-cover"
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
          <div className="w-16 h-16 rounded-full bg-surface overflow-hidden">
            <img
              src={`https://cdn.nba.com/headshots/nba/latest/260x190/${selectedPlayer.id}.png`}
              alt={selectedPlayer.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="font-display font-bold text-lg">{selectedPlayer.name}</p>
            <p className="text-muted">{selectedPlayer.team} • {selectedPlayer.position}</p>
          </div>
          <button
            onClick={() => {
              setSelectedPlayer(null)
              setQuery('')
            }}
            className="ml-auto text-muted hover:text-ghost-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </motion.div>
      )}
    </div>
  )
}
