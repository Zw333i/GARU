'use client'

import { useState, useEffect, useCallback } from 'react'
import { getRandomPlayers, getRolePlayers, getStarPlayers, getDraftPlayerPools, Player } from '@/lib/supabase'

// Simplified player interface for games
export interface GamePlayer {
  id: number
  name: string
  team: string
  position: string
  ppg: number
  rpg: number
  apg: number
  rating: number
}

// Convert Supabase Player to GamePlayer
function toGamePlayer(player: Player): GamePlayer {
  return {
    id: player.player_id,
    name: player.full_name,
    team: player.team_abbreviation || 'FA',
    position: player.position || 'SF',
    ppg: player.season_stats?.pts || 0,
    rpg: player.season_stats?.reb || 0,
    apg: player.season_stats?.ast || 0,
    rating: player.season_stats?.rating || 75,
  }
}

// Hook to fetch random players for games
export function useGamePlayers(count: number = 20, minGames: number = 10) {
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPlayers() {
      try {
        setLoading(true)
        const data = await getRandomPlayers(count, minGames)
        setPlayers(data.map(toGamePlayer))
        setError(null)
      } catch (err) {
        console.error('Error fetching players:', err)
        setError('Failed to load players')
      } finally {
        setLoading(false)
      }
    }
    
    fetchPlayers()
  }, [count, minGames])

  const refetch = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getRandomPlayers(count, minGames)
      setPlayers(data.map(toGamePlayer))
      setError(null)
    } catch (err) {
      console.error('Error refetching players:', err)
      setError('Failed to load players')
    } finally {
      setLoading(false)
    }
  }, [count, minGames])

  return { players, loading, error, refetch }
}

// Hook to fetch role players (for guessing games)
export function useRolePlayers(count: number = 30) {
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPlayers() {
      try {
        setLoading(true)
        const data = await getRolePlayers(8, 18, 15)
        setPlayers(data.slice(0, count).map(toGamePlayer))
        setError(null)
      } catch (err) {
        console.error('Error fetching role players:', err)
        setError('Failed to load players')
      } finally {
        setLoading(false)
      }
    }
    
    fetchPlayers()
  }, [count])

  return { players, loading, error }
}

// Hook to fetch star players (for comparison games)
export function useStarPlayers(minPPG: number = 18) {
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPlayers() {
      try {
        setLoading(true)
        const data = await getStarPlayers(minPPG)
        setPlayers(data.map(toGamePlayer))
        setError(null)
      } catch (err) {
        console.error('Error fetching star players:', err)
        setError('Failed to load players')
      } finally {
        setLoading(false)
      }
    }
    
    fetchPlayers()
  }, [minPPG])

  return { players, loading, error }
}

// Hook to fetch draft pools by position
export function useDraftPools() {
  const [pools, setPools] = useState<Record<string, GamePlayer[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPools() {
      try {
        setLoading(true)
        const data = await getDraftPlayerPools()
        
        // Convert each position's players
        const converted: Record<string, GamePlayer[]> = {}
        for (const [pos, players] of Object.entries(data)) {
          converted[pos] = players.map(toGamePlayer)
        }
        
        setPools(converted)
        setError(null)
      } catch (err) {
        console.error('Error fetching draft pools:', err)
        setError('Failed to load players')
      } finally {
        setLoading(false)
      }
    }
    
    fetchPools()
  }, [])

  return { pools, loading, error }
}

// Fallback players if Supabase fails - 2025-26 Season + 2010s Legends
export const FALLBACK_ROLE_PLAYERS: GamePlayer[] = [
  // Current Role Players (2025-26)
  { id: 1627826, name: 'Ivica Zubac', team: 'LAC', position: 'C', ppg: 11.7, rpg: 9.2, apg: 1.4, rating: 80 },
  { id: 1628966, name: 'Luguentz Dort', team: 'OKC', position: 'SG', ppg: 10.8, rpg: 3.8, apg: 1.8, rating: 78 },
  { id: 1628978, name: 'Donte DiVincenzo', team: 'MIN', position: 'SG', ppg: 10.4, rpg: 3.5, apg: 2.8, rating: 78 },
  { id: 1627832, name: 'Fred VanVleet', team: 'HOU', position: 'PG', ppg: 14.5, rpg: 3.8, apg: 6.5, rating: 83 },
  { id: 1629628, name: 'RJ Barrett', team: 'TOR', position: 'SF', ppg: 18.5, rpg: 5.4, apg: 3.0, rating: 82 },
  { id: 1628389, name: 'Bam Adebayo', team: 'MIA', position: 'C', ppg: 19.8, rpg: 10.2, apg: 3.9, rating: 87 },
  { id: 203935, name: 'Marcus Smart', team: 'LAL', position: 'PG', ppg: 14.2, rpg: 3.1, apg: 5.5, rating: 81 },
  { id: 1628969, name: 'Mikal Bridges', team: 'NYK', position: 'SF', ppg: 19.6, rpg: 4.5, apg: 3.2, rating: 84 },
  { id: 1628386, name: 'Jarrett Allen', team: 'CLE', position: 'C', ppg: 16.5, rpg: 10.8, apg: 1.5, rating: 85 },
  { id: 1630175, name: 'Cole Anthony', team: 'ORL', position: 'PG', ppg: 13.2, rpg: 4.8, apg: 5.2, rating: 79 },
  { id: 1629684, name: 'Franz Wagner', team: 'ORL', position: 'SF', ppg: 19.7, rpg: 5.3, apg: 3.7, rating: 85 },
  { id: 1630578, name: 'Alperen Sengun', team: 'HOU', position: 'C', ppg: 19.0, rpg: 10.3, apg: 5.0, rating: 86 },
  { id: 1628401, name: 'Derrick White', team: 'BOS', position: 'SG', ppg: 15.2, rpg: 4.2, apg: 5.2, rating: 83 },
  { id: 1629631, name: 'Darius Garland', team: 'CLE', position: 'PG', ppg: 21.6, rpg: 2.6, apg: 6.5, rating: 85 },
  { id: 1630559, name: 'Austin Reaves', team: 'LAL', position: 'SG', ppg: 15.9, rpg: 4.3, apg: 5.5, rating: 82 },
  // More Current Role Players (2025-26)
  { id: 1629636, name: 'Tyler Herro', team: 'MIA', position: 'SG', ppg: 20.8, rpg: 5.3, apg: 4.5, rating: 84 },
  { id: 1628398, name: 'OG Anunoby', team: 'NYK', position: 'SF', ppg: 14.7, rpg: 4.9, apg: 2.1, rating: 83 },
  { id: 203897, name: 'Zach LaVine', team: 'CHI', position: 'SG', ppg: 22.3, rpg: 4.5, apg: 3.8, rating: 86 },
  { id: 1630596, name: 'Scottie Barnes', team: 'TOR', position: 'SF', ppg: 19.5, rpg: 7.5, apg: 5.2, rating: 86 },
  { id: 1629627, name: 'Cam Johnson', team: 'BKN', position: 'SF', ppg: 14.5, rpg: 4.3, apg: 2.0, rating: 80 },
  { id: 1630532, name: 'Herb Jones', team: 'NOP', position: 'SF', ppg: 11.8, rpg: 3.9, apg: 2.0, rating: 81 },
  { id: 1630567, name: 'Ayo Dosunmu', team: 'CHI', position: 'SG', ppg: 9.2, rpg: 3.1, apg: 4.0, rating: 78 },
  { id: 1629634, name: 'Grant Williams', team: 'CHA', position: 'PF', ppg: 10.8, rpg: 4.8, apg: 2.5, rating: 77 },
  { id: 1629639, name: 'Keldon Johnson', team: 'SAS', position: 'SF', ppg: 15.2, rpg: 5.2, apg: 2.8, rating: 80 },
  { id: 1630531, name: 'Josh Giddey', team: 'CHI', position: 'PG', ppg: 12.3, rpg: 6.4, apg: 6.0, rating: 80 },
  // 2010s Role Players
  { id: 101106, name: 'Tony Parker', team: 'SAS', position: 'PG', ppg: 15.5, rpg: 2.7, apg: 5.6, rating: 86 },
  { id: 1884, name: 'Manu Ginobili', team: 'SAS', position: 'SG', ppg: 13.3, rpg: 3.5, apg: 3.8, rating: 85 },
  { id: 200765, name: 'Rajon Rondo', team: 'BOS', position: 'PG', ppg: 10.0, rpg: 4.5, apg: 8.0, rating: 84 },
  { id: 201565, name: 'Derrick Rose', team: 'MEM', position: 'PG', ppg: 7.5, rpg: 1.8, apg: 2.0, rating: 75 },
  { id: 200746, name: 'LaMarcus Aldridge', team: 'SAS', position: 'PF', ppg: 19.4, rpg: 8.2, apg: 2.0, rating: 86 },
  { id: 200757, name: 'JJ Redick', team: 'PHI', position: 'SG', ppg: 12.8, rpg: 2.0, apg: 2.4, rating: 80 },
  { id: 201572, name: 'Brook Lopez', team: 'MIL', position: 'C', ppg: 12.5, rpg: 4.5, apg: 1.5, rating: 82 },
  { id: 203084, name: 'Khris Middleton', team: 'MIL', position: 'SF', ppg: 18.5, rpg: 4.8, apg: 4.5, rating: 85 },
  { id: 201567, name: 'Kevin Love', team: 'CLE', position: 'PF', ppg: 16.0, rpg: 9.5, apg: 2.5, rating: 84 },
]

export const FALLBACK_STAR_PLAYERS: GamePlayer[] = [
  // Current Stars (2025-26)
  { id: 1629029, name: 'Luka Doncic', team: 'DAL', position: 'PG', ppg: 32.4, rpg: 8.6, apg: 8.0, rating: 96 },
  { id: 201939, name: 'Stephen Curry', team: 'GSW', position: 'PG', ppg: 26.4, rpg: 4.5, apg: 5.1, rating: 95 },
  { id: 203507, name: 'Giannis Antetokounmpo', team: 'MIL', position: 'PF', ppg: 30.4, rpg: 11.5, apg: 6.5, rating: 97 },
  { id: 203999, name: 'Nikola Jokic', team: 'DEN', position: 'C', ppg: 26.4, rpg: 12.4, apg: 9.0, rating: 98 },
  { id: 1628369, name: 'Jayson Tatum', team: 'BOS', position: 'SF', ppg: 26.9, rpg: 8.1, apg: 4.9, rating: 93 },
  { id: 203954, name: 'Joel Embiid', team: 'PHI', position: 'C', ppg: 33.1, rpg: 10.2, apg: 4.2, rating: 95 },
  { id: 2544, name: 'LeBron James', team: 'LAL', position: 'SF', ppg: 25.7, rpg: 7.3, apg: 8.3, rating: 94 },
  { id: 201142, name: 'Kevin Durant', team: 'PHX', position: 'SF', ppg: 29.1, rpg: 6.6, apg: 5.0, rating: 94 },
  { id: 1628983, name: 'Shai Gilgeous-Alexander', team: 'OKC', position: 'PG', ppg: 31.1, rpg: 5.5, apg: 6.2, rating: 93 },
  { id: 1630162, name: 'Anthony Edwards', team: 'MIN', position: 'SG', ppg: 25.9, rpg: 5.4, apg: 5.1, rating: 90 },
  { id: 1641705, name: 'Victor Wembanyama', team: 'SAS', position: 'C', ppg: 21.4, rpg: 10.6, apg: 3.9, rating: 89 },
  { id: 202681, name: 'Kyrie Irving', team: 'DAL', position: 'PG', ppg: 25.6, rpg: 5.0, apg: 5.2, rating: 90 },
  // 2010s Legends
  { id: 977, name: 'Kobe Bryant', team: 'LAL', position: 'SG', ppg: 25.0, rpg: 5.2, apg: 4.7, rating: 96 },
  { id: 1495, name: 'Tim Duncan', team: 'SAS', position: 'PF', ppg: 19.0, rpg: 10.8, apg: 3.0, rating: 95 },
  { id: 1718, name: 'Dirk Nowitzki', team: 'DAL', position: 'PF', ppg: 20.7, rpg: 7.5, apg: 2.4, rating: 93 },
  { id: 2546, name: 'Carmelo Anthony', team: 'DEN', position: 'SF', ppg: 22.5, rpg: 6.2, apg: 2.7, rating: 90 },
  { id: 2548, name: 'Dwyane Wade', team: 'MIA', position: 'SG', ppg: 22.0, rpg: 4.7, apg: 5.4, rating: 94 },
  { id: 2730, name: 'Dwight Howard', team: 'ORL', position: 'C', ppg: 17.4, rpg: 12.4, apg: 1.4, rating: 91 },
  { id: 1891, name: 'Ray Allen', team: 'MIA', position: 'SG', ppg: 18.9, rpg: 4.1, apg: 3.4, rating: 89 },
  { id: 708, name: 'Kevin Garnett', team: 'MIN', position: 'PF', ppg: 17.8, rpg: 10.0, apg: 3.7, rating: 93 },
  { id: 947, name: 'Shaquille ONeal', team: 'LAL', position: 'C', ppg: 23.7, rpg: 10.9, apg: 2.5, rating: 97 },
  { id: 1899, name: 'Allen Iverson', team: 'PHI', position: 'PG', ppg: 26.7, rpg: 3.7, apg: 6.2, rating: 94 },
]
