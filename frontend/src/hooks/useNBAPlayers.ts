/**
 * NBA Players Hook - Fetches live player data from backend
 * Uses the LeagueDashPlayerStats endpoint for 2025-26 season data
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export interface NBAPlayer {
  id: number
  name: string
  team: string
  position: string
  rating: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  fg_pct: number
  fg3_pct: number
  ft_pct: number
  gp: number
  mpg: number
  age?: number
  season: string
}

interface UseNBAPlayersOptions {
  autoFetch?: boolean
  limit?: number
  minPPG?: number
  team?: string
  position?: string
}

interface UseNBAPlayersResult {
  players: NBAPlayer[]
  loading: boolean
  error: string | null
  season: string
  refetch: (forceRefresh?: boolean) => Promise<void>
  getStars: (minPPG?: number) => Promise<NBAPlayer[]>
  getRolePlayers: (count?: number) => Promise<NBAPlayer[]>
  searchPlayers: (query: string) => Promise<NBAPlayer[]>
  getPlayersByPosition: (position: string, limit?: number, forDraft?: boolean) => Promise<NBAPlayer[]>
  getTeamRoster: (team: string) => Promise<NBAPlayer[]>
  getTopPlayers: (count?: number) => Promise<NBAPlayer[]>
}

export function useNBAPlayers(options: UseNBAPlayersOptions = {}): UseNBAPlayersResult {
  const { autoFetch = true, limit = 100, minPPG, team, position } = options
  
  const [players, setPlayers] = useState<NBAPlayer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [season, setSeason] = useState('2025-26')

  const fetchPlayers = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await api.getPlayers({
        limit,
        minPPG,
        team,
        position,
        refresh: forceRefresh,
      })
      
      setPlayers(response.players)
      setSeason(response.season)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch players')
      console.error('Failed to fetch NBA players:', err)
    } finally {
      setLoading(false)
    }
  }, [limit, minPPG, team, position])

  const getStars = useCallback(async (minPPG = 20): Promise<NBAPlayer[]> => {
    try {
      const response = await api.getStars(minPPG)
      return response.players
    } catch (err) {
      console.error('Failed to fetch stars:', err)
      return []
    }
  }, [])

  const getRolePlayers = useCallback(async (count = 30): Promise<NBAPlayer[]> => {
    try {
      const response = await api.getRolePlayers(count)
      return response.players
    } catch (err) {
      console.error('Failed to fetch role players:', err)
      return []
    }
  }, [])

  const searchPlayers = useCallback(async (query: string): Promise<NBAPlayer[]> => {
    try {
      const response = await api.searchPlayers(query)
      return response.players
    } catch (err) {
      console.error('Failed to search players:', err)
      return []
    }
  }, [])

  const getPlayersByPosition = useCallback(async (
    position: string,
    limit = 5,
    forDraft = false
  ): Promise<NBAPlayer[]> => {
    try {
      const response = await api.getPlayersByPosition(position, limit, forDraft)
      return response.players
    } catch (err) {
      console.error('Failed to fetch players by position:', err)
      return []
    }
  }, [])

  const getTeamRoster = useCallback(async (team: string): Promise<NBAPlayer[]> => {
    try {
      const response = await api.getTeamRoster(team)
      return response.players
    } catch (err) {
      console.error('Failed to fetch team roster:', err)
      return []
    }
  }, [])

  const getTopPlayers = useCallback(async (count = 50): Promise<NBAPlayer[]> => {
    try {
      const response = await api.getTopPlayers(count)
      return response.players
    } catch (err) {
      console.error('Failed to fetch top players:', err)
      return []
    }
  }, [])

  useEffect(() => {
    if (autoFetch) {
      fetchPlayers()
    }
  }, [autoFetch, fetchPlayers])

  return {
    players,
    loading,
    error,
    season,
    refetch: fetchPlayers,
    getStars,
    getRolePlayers,
    searchPlayers,
    getPlayersByPosition,
    getTeamRoster,
    getTopPlayers,
  }
}

/**
 * Get NBA player headshot URL
 */
export function getPlayerHeadshotUrl(playerId: number): string {
  return `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`
}

/**
 * Get team logo URL
 */
export function getTeamLogoUrl(teamAbbr: string): string {
  const teamCodeMap: Record<string, string> = {
    'ATL': '1610612737',
    'BOS': '1610612738',
    'BKN': '1610612751',
    'CHA': '1610612766',
    'CHI': '1610612741',
    'CLE': '1610612739',
    'DAL': '1610612742',
    'DEN': '1610612743',
    'DET': '1610612765',
    'GSW': '1610612744',
    'HOU': '1610612745',
    'IND': '1610612754',
    'LAC': '1610612746',
    'LAL': '1610612747',
    'MEM': '1610612763',
    'MIA': '1610612748',
    'MIL': '1610612749',
    'MIN': '1610612750',
    'NOP': '1610612740',
    'NYK': '1610612752',
    'OKC': '1610612760',
    'ORL': '1610612753',
    'PHI': '1610612755',
    'PHX': '1610612756',
    'POR': '1610612757',
    'SAC': '1610612758',
    'SAS': '1610612759',
    'TOR': '1610612761',
    'UTA': '1610612762',
    'WAS': '1610612764',
  }
  
  const teamId = teamCodeMap[teamAbbr.toUpperCase()] || teamAbbr
  return `https://cdn.nba.com/logos/nba/${teamId}/primary/L/logo.svg`
}

/**
 * Format player stats for display
 */
export function formatPlayerStats(player: NBAPlayer): string {
  return `${player.pts.toFixed(1)} PPG | ${player.reb.toFixed(1)} RPG | ${player.ast.toFixed(1)} APG`
}
