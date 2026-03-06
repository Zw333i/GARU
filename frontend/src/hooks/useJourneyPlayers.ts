'use client'

import { useState, useEffect, useCallback } from 'react'
import { api, JourneyPlayer } from '@/lib/api'
import { supabase } from '@/lib/supabase'

interface UseJourneyPlayersResult {
  players: JourneyPlayer[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  getRandomPlayer: () => JourneyPlayer | null
}

export function useJourneyPlayers(count: number = 30, minTeams: number = 3): UseJourneyPlayersResult {
  const [players, setPlayers] = useState<JourneyPlayer[]>([])
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlayers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Primary: read directly from Supabase (no backend needed)
      const { data, error: sbError } = await supabase
        .from('journey_players')
        .select('player_id, player_name, teams, current_team')
        .limit(count * 2)

      if (!sbError && data && data.length > 0) {
        // Filter to players with enough teams, shuffle, take count
        const mapped: JourneyPlayer[] = data
          .map(row => ({
            id: row.player_id as number,
            name: row.player_name as string,
            teams: (row.teams as string[]) ?? [],
            current_team: (row.current_team as string) ?? 'FA',
          }))
          .filter(p => p.teams.length >= minTeams)
          .sort(() => Math.random() - 0.5)
          .slice(0, count)

        if (mapped.length > 0) {
          setPlayers(mapped)
          setUsedIndices(new Set())
          return
        }
      }

      // Fallback: backend API (requires server running)
      const response = await api.getJourneyPlayers(count, minTeams)
      setPlayers(response.players)
      setUsedIndices(new Set())
    } catch (err) {
      console.error('Error fetching journey players:', err)
      setError(err instanceof Error ? err.message : 'Failed to load players')
    } finally {
      setLoading(false)
    }
  }, [count, minTeams])

  useEffect(() => {
    fetchPlayers()
  }, [fetchPlayers])

  const getRandomPlayer = useCallback((): JourneyPlayer | null => {
    if (players.length === 0) return null
    
    // Get available indices
    const availableIndices = players
      .map((_, i) => i)
      .filter(i => !usedIndices.has(i))
    
    // If all used, reset
    if (availableIndices.length === 0) {
      setUsedIndices(new Set())
      const randomIndex = Math.floor(Math.random() * players.length)
      setUsedIndices(new Set([randomIndex]))
      return players[randomIndex]
    }
    
    // Pick random from available
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
    setUsedIndices(prev => new Set([...prev, randomIndex]))
    return players[randomIndex]
  }, [players, usedIndices])

  return {
    players,
    loading,
    error,
    refetch: fetchPlayers,
    getRandomPlayer,
  }
}
