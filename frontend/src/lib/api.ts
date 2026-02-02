/**
 * API Client for GARU Backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean>
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options

    let url = `${this.baseUrl}${endpoint}`

    // Add query parameters
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
      const queryString = searchParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }))
      throw new Error(error.detail || error.message || 'Request failed')
    }

    return response.json()
  }

  // Players
  async getPlayers(filters?: { team?: string; position?: string; minPPG?: number; limit?: number; refresh?: boolean }) {
    return this.request<{ players: any[]; count: number; season: string }>('/api/players/', { params: filters as any })
  }

  async refreshPlayers() {
    return this.request<{ message: string; count: number; season: string }>('/api/players/refresh')
  }

  async getStars(minPPG: number = 20) {
    return this.request<{ players: any[]; count: number; season: string; criteria: string }>('/api/players/stars', { params: { min_ppg: minPPG } })
  }

  async getTopPlayers(count: number = 50) {
    return this.request<{ players: any[]; count: number; season: string }>(`/api/players/top/${count}`)
  }

  async getPlayer(playerId: number) {
    return this.request<{ player: any; season: string }>(`/api/players/${playerId}`)
  }

  async getRandomPlayers(count: number = 1) {
    return this.request<{ players: any[]; season: string }>('/api/players/random', { params: { count } })
  }

  async getRolePlayers(count: number = 30) {
    return this.request<{ players: any[]; count: number; season: string; criteria: string }>('/api/players/role-players', { params: { count } })
  }

  async getDailyPlayer() {
    return this.request<{ player: any; date: string; season: string }>('/api/players/daily')
  }

  async searchPlayers(query: string) {
    return this.request<{ players: any[]; count: number; query: string; season: string }>(`/api/players/search/${query}`)
  }

  async getPlayersByPosition(position: string, limit: number = 5, forDraft: boolean = false) {
    return this.request<{ players: any[]; position: string; count: number; season: string }>(`/api/players/by-position/${position}`, { params: { limit, for_draft: forDraft } })
  }

  async getTeams() {
    return this.request<{ teams: any[]; count: number }>('/api/players/teams')
  }

  async getTeamRoster(teamAbbr: string) {
    return this.request<{ team: string; players: any[]; count: number; season: string }>(`/api/players/team/${teamAbbr}`)
  }

  // Games
  async getDailyChallenge() {
    return this.request<{ challenge: any; date: string }>('/api/games/daily-challenge')
  }

  async checkGuess(playerId: number, guess: string) {
    return this.request<{ correct: boolean; answer: string; player_id: number; points_earned: number }>(
      '/api/games/check-guess',
      { method: 'POST', params: { player_id: playerId, guess } }
    )
  }

  async getRandomJourney() {
    return this.request<{ teams: string[]; hint: string }>('/api/games/journey/random')
  }

  async checkJourneyGuess(teams: string[], guess: string) {
    return this.request<any>('/api/games/journey/check', {
      method: 'POST',
      body: JSON.stringify({ teams, guess }),
    })
  }

  async getRandomComparison() {
    return this.request<{ player_a: any; player_b: any; comparison_id: number }>('/api/games/comparison/random')
  }

  async revealComparison(comparisonId: number, choice: string) {
    return this.request<any>('/api/games/comparison/reveal', {
      method: 'POST',
      params: { comparison_id: comparisonId, choice },
    })
  }

  async calculateBattle(userTeam: object, opponentTeam: object) {
    return this.request<{ user_score: number; opponent_score: number; winner: string; margin: number }>(
      '/api/games/battle/calculate',
      { method: 'POST', body: JSON.stringify({ user_team: userTeam, opponent_team: opponentTeam }) }
    )
  }

  // Stats
  async getStatGlossary(category?: string) {
    return this.request<{ stats: any[]; count: number }>('/api/stats/glossary', { params: category ? { category } : {} })
  }

  async getStatDefinition(abbr: string) {
    return this.request<any>(`/api/stats/glossary/${abbr}`)
  }

  async getShotChart(playerId: number) {
    return this.request<{ player_id: number; shots: any[]; stats: any }>(`/api/stats/shot-chart/${playerId}`)
  }

  async getStatLeaders(stat: string = 'pts', limit: number = 10) {
    return this.request<{ stat: string; leaders: any[] }>('/api/stats/leaders', { params: { stat, limit } })
  }

  async getTeamStats(teamAbbr: string) {
    return this.request<any>(`/api/stats/team/${teamAbbr}`)
  }

  async comparePlayers(playerAId: number, playerBId: number) {
    return this.request<any>('/api/stats/compare', { params: { player_a_id: playerAId, player_b_id: playerBId } })
  }

  // Health check
  async healthCheck() {
    return this.request<{ status: string; app: string; version: string }>('/')
  }
}

export const api = new ApiClient(API_BASE_URL)
