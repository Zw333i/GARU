/**
 * Players Store - Session-based caching for NBA player data
 * Fetches players ONCE per session and caches them in memory
 * Persists to sessionStorage so data survives page refreshes within the same session
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

// Player interface for cached data
export interface CachedPlayer {
  id: number
  name: string
  team: string
  position: string
  ppg: number
  rpg: number
  apg: number
  stl?: number
  blk?: number
  fg_pct?: number
  fg3_pct?: number
  ft_pct?: number
  gp?: number
  mpg?: number
  rating?: number
}

interface PlayersState {
  // Data
  players: CachedPlayer[]
  stars: CachedPlayer[]        // Players with 20+ PPG
  rolePlayers: CachedPlayer[]  // Players with 8-18 PPG
  
  // Status flags
  isLoaded: boolean
  isLoading: boolean
  lastFetchedAt: number | null
  error: string | null
  
  // Actions
  fetchPlayers: () => Promise<void>
  getPlayerById: (id: number) => CachedPlayer | undefined
  getRandomPlayers: (count: number, minGames?: number) => CachedPlayer[]
  searchPlayers: (query: string) => CachedPlayer[]
  reset: () => void
}

// Fallback players for when Supabase is unavailable
const FALLBACK_PLAYERS: CachedPlayer[] = [
  // Current Stars (2025-26)
  { id: 203999, name: 'Nikola Jokic', team: 'DEN', position: 'C', ppg: 27.5, rpg: 13.1, apg: 10.2, rating: 99 },
  { id: 1629029, name: 'Luka Doncic', team: 'DAL', position: 'PG', ppg: 28.8, rpg: 8.3, apg: 7.8, rating: 98 },
  { id: 203507, name: 'Giannis Antetokounmpo', team: 'MIL', position: 'PF', ppg: 31.5, rpg: 12.0, apg: 6.1, rating: 98 },
  { id: 1628369, name: 'Jayson Tatum', team: 'BOS', position: 'SF', ppg: 27.8, rpg: 9.0, apg: 5.5, rating: 95 },
  { id: 201939, name: 'Stephen Curry', team: 'GSW', position: 'PG', ppg: 25.8, rpg: 4.4, apg: 5.3, rating: 96 },
  { id: 203954, name: 'Joel Embiid', team: 'PHI', position: 'C', ppg: 27.3, rpg: 8.6, apg: 3.8, rating: 95 },
  { id: 2544, name: 'LeBron James', team: 'LAL', position: 'SF', ppg: 24.2, rpg: 7.1, apg: 8.0, rating: 94 },
  { id: 201142, name: 'Kevin Durant', team: 'PHX', position: 'SF', ppg: 27.1, rpg: 6.6, apg: 4.3, rating: 95 },
  { id: 1628983, name: 'Shai Gilgeous-Alexander', team: 'OKC', position: 'PG', ppg: 31.4, rpg: 5.5, apg: 6.0, rating: 97 },
  { id: 1630162, name: 'Anthony Edwards', team: 'MIN', position: 'SG', ppg: 27.2, rpg: 5.8, apg: 4.5, rating: 94 },
  { id: 1629630, name: 'Ja Morant', team: 'MEM', position: 'PG', ppg: 24.8, rpg: 5.4, apg: 8.5, rating: 92 },
  { id: 1627759, name: 'Jaylen Brown', team: 'BOS', position: 'SG', ppg: 24.5, rpg: 5.8, apg: 4.0, rating: 91 },
  { id: 202681, name: 'Kyrie Irving', team: 'DAL', position: 'PG', ppg: 25.6, rpg: 5.0, apg: 5.2, rating: 92 },
  { id: 1641705, name: 'Victor Wembanyama', team: 'SAS', position: 'C', ppg: 21.4, rpg: 10.6, apg: 3.9, rating: 93 },
  { id: 1628973, name: 'Jalen Brunson', team: 'NYK', position: 'PG', ppg: 26.3, rpg: 3.8, apg: 7.2, rating: 91 },
  { id: 203081, name: 'Damian Lillard', team: 'MIL', position: 'PG', ppg: 25.1, rpg: 4.2, apg: 7.0, rating: 92 },
  { id: 1626164, name: 'Devin Booker', team: 'PHX', position: 'SG', ppg: 27.5, rpg: 4.8, apg: 7.2, rating: 93 },
  { id: 1629027, name: 'Trae Young', team: 'ATL', position: 'PG', ppg: 26.8, rpg: 3.0, apg: 11.2, rating: 91 },
  { id: 1628378, name: 'Donovan Mitchell', team: 'CLE', position: 'SG', ppg: 27.5, rpg: 4.2, apg: 5.5, rating: 92 },
  { id: 1630595, name: 'Cade Cunningham', team: 'DET', position: 'PG', ppg: 24.2, rpg: 4.8, apg: 8.0, rating: 90 },
  
  // Role Players (2025-26)
  { id: 1628389, name: 'Bam Adebayo', team: 'MIA', position: 'C', ppg: 20.5, rpg: 10.8, apg: 5.2, rating: 88 },
  { id: 1627734, name: 'Domantas Sabonis', team: 'SAC', position: 'C', ppg: 20.1, rpg: 14.2, apg: 8.5, rating: 89 },
  { id: 1628386, name: 'Jarrett Allen', team: 'CLE', position: 'C', ppg: 17.2, rpg: 11.0, apg: 1.8, rating: 85 },
  { id: 1628969, name: 'Mikal Bridges', team: 'NYK', position: 'SF', ppg: 19.6, rpg: 4.5, apg: 3.2, rating: 84 },
  { id: 1628401, name: 'Derrick White', team: 'BOS', position: 'SG', ppg: 15.2, rpg: 4.2, apg: 5.2, rating: 82 },
  { id: 1627826, name: 'Ivica Zubac', team: 'LAC', position: 'C', ppg: 11.7, rpg: 9.2, apg: 1.4, rating: 78 },
  { id: 1628966, name: 'Luguentz Dort', team: 'OKC', position: 'SG', ppg: 10.8, rpg: 3.8, apg: 1.8, rating: 76 },
  { id: 1629684, name: 'Franz Wagner', team: 'ORL', position: 'SF', ppg: 19.7, rpg: 5.3, apg: 3.7, rating: 86 },
  { id: 1630578, name: 'Alperen Sengun', team: 'HOU', position: 'C', ppg: 19.0, rpg: 10.3, apg: 5.0, rating: 87 },
  { id: 1630224, name: 'Jalen Green', team: 'HOU', position: 'SG', ppg: 22.1, rpg: 5.2, apg: 3.5, rating: 86 },
  
  // 2010s Legends
  { id: 977, name: 'Kobe Bryant', team: 'LAL', position: 'SG', ppg: 25.0, rpg: 5.2, apg: 4.7, rating: 96 },
  { id: 1495, name: 'Tim Duncan', team: 'SAS', position: 'PF', ppg: 19.0, rpg: 10.8, apg: 3.0, rating: 95 },
  { id: 1718, name: 'Dirk Nowitzki', team: 'DAL', position: 'PF', ppg: 20.7, rpg: 7.5, apg: 2.4, rating: 93 },
  { id: 2546, name: 'Carmelo Anthony', team: 'DEN', position: 'SF', ppg: 22.5, rpg: 6.2, apg: 2.7, rating: 90 },
  { id: 2548, name: 'Dwyane Wade', team: 'MIA', position: 'SG', ppg: 22.0, rpg: 4.7, apg: 5.4, rating: 93 },
  { id: 101108, name: 'Chris Paul', team: 'SAS', position: 'PG', ppg: 8.5, rpg: 3.5, apg: 7.2, rating: 82 },
]

// Session storage adapter (survives page refresh, clears on browser close)
const sessionStorageAdapter = {
  getItem: (name: string): string | null => {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(name)
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(name, value)
  },
  removeItem: (name: string): void => {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(name)
  },
}

export const usePlayersStore = create<PlayersState>()(
  persist(
    (set, get) => ({
      players: [],
      stars: [],
      rolePlayers: [],
      isLoaded: false,
      isLoading: false,
      lastFetchedAt: null,
      error: null,

      fetchPlayers: async () => {
        const state = get()
        
        // Skip if already loaded or currently loading
        if (state.isLoaded || state.isLoading) {
          console.log('📦 Players already cached, skipping fetch')
          return
        }

        set({ isLoading: true, error: null })
        console.log('🏀 Fetching players from database...')

        try {
          const { data, error } = await supabase
            .from('cached_players')
            .select('player_id, full_name, team_abbreviation, position, season_stats, rating')
            .order('season_stats->pts', { ascending: false })
            .limit(500)

          if (error) {
            console.warn('Database unavailable, using fallback:', error.message)
            const stars = FALLBACK_PLAYERS.filter(p => p.ppg >= 20)
            const rolePlayers = FALLBACK_PLAYERS.filter(p => p.ppg >= 8 && p.ppg < 18)
            set({
              players: FALLBACK_PLAYERS,
              stars,
              rolePlayers,
              isLoaded: true,
              isLoading: false,
              lastFetchedAt: Date.now(),
            })
            return
          }

          if (data && data.length > 0) {
            interface DBPlayer {
              player_id: number
              full_name: string
              team_abbreviation: string | null
              position: string | null
              rating?: number
              season_stats: {
                pts?: number
                reb?: number
                ast?: number
                stl?: number
                blk?: number
                fg_pct?: number
                fg3_pct?: number
                ft_pct?: number
                gp?: number
                mpg?: number
              } | null
            }
            
            const mappedPlayers: CachedPlayer[] = (data as DBPlayer[]).map(p => ({
              id: p.player_id,
              name: p.full_name,
              team: p.team_abbreviation || '',
              position: p.position || 'N/A',
              ppg: p.season_stats?.pts || 0,
              rpg: p.season_stats?.reb || 0,
              apg: p.season_stats?.ast || 0,
              stl: p.season_stats?.stl,
              blk: p.season_stats?.blk,
              fg_pct: p.season_stats?.fg_pct,
              fg3_pct: p.season_stats?.fg3_pct,
              ft_pct: p.season_stats?.ft_pct,
              gp: p.season_stats?.gp,
              mpg: p.season_stats?.mpg,
              rating: p.rating,
            }))

            const stars = mappedPlayers.filter(p => p.ppg >= 20)
            const rolePlayers = mappedPlayers.filter(p => p.ppg >= 8 && p.ppg < 18)

            console.log(`✅ Cached ${mappedPlayers.length} players (${stars.length} stars, ${rolePlayers.length} role players)`)
            
            set({
              players: mappedPlayers,
              stars,
              rolePlayers,
              isLoaded: true,
              isLoading: false,
              lastFetchedAt: Date.now(),
            })
          } else {
            // No data in DB, use fallback
            const stars = FALLBACK_PLAYERS.filter(p => p.ppg >= 20)
            const rolePlayers = FALLBACK_PLAYERS.filter(p => p.ppg >= 8 && p.ppg < 18)
            set({
              players: FALLBACK_PLAYERS,
              stars,
              rolePlayers,
              isLoaded: true,
              isLoading: false,
              lastFetchedAt: Date.now(),
            })
          }
        } catch (err) {
          console.error('Error fetching players:', err)
          // Use fallback on error
          const stars = FALLBACK_PLAYERS.filter(p => p.ppg >= 20)
          const rolePlayers = FALLBACK_PLAYERS.filter(p => p.ppg >= 8 && p.ppg < 18)
          set({
            players: FALLBACK_PLAYERS,
            stars,
            rolePlayers,
            isLoaded: true,
            isLoading: false,
            lastFetchedAt: Date.now(),
            error: err instanceof Error ? err.message : 'Failed to fetch players',
          })
        }
      },

      getPlayerById: (id: number) => {
        return get().players.find(p => p.id === id)
      },

      getRandomPlayers: (count: number, minGames = 10) => {
        const { players } = get()
        const eligible = players.filter(p => (p.gp || 0) >= minGames || p.ppg > 0)
        const shuffled = [...eligible].sort(() => Math.random() - 0.5)
        return shuffled.slice(0, count)
      },

      searchPlayers: (query: string) => {
        if (query.length < 2) return []
        const { players } = get()
        const lower = query.toLowerCase()
        return players.filter(p => p.name.toLowerCase().includes(lower))
      },

      reset: () => {
        set({
          players: [],
          stars: [],
          rolePlayers: [],
          isLoaded: false,
          isLoading: false,
          lastFetchedAt: null,
          error: null,
        })
      },
    }),
    {
      name: 'garu-players-session',
      storage: createJSONStorage(() => sessionStorageAdapter),
      // Only persist the data, not the loading states
      partialize: (state) => ({
        players: state.players,
        stars: state.stars,
        rolePlayers: state.rolePlayers,
        isLoaded: state.isLoaded,
        lastFetchedAt: state.lastFetchedAt,
      }),
    }
  )
)
