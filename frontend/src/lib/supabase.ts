import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for database tables
export interface Player {
  player_id: number
  full_name: string
  team_id: number
  team_abbreviation: string
  is_active: boolean
  position: string
  season_stats: {
    pts: number
    reb: number
    ast: number
    stl: number
    blk: number
    fg_pct: number
    fg3_pct: number
    ft_pct: number
    min: number
    gp: number
    mpg?: number
    rating?: number
    season?: string
  }
}

export interface User {
  id: string
  username: string
  avatar_url: string | null
  wins: number
  losses: number
  created_at: string
}

export interface Battle {
  battle_id: string
  user_id_1: string
  user_id_2: string | null
  winner_id: string | null
  user_team: object
  opponent_team: object
  user_score: number
  opponent_score: number
  created_at: string
}

export interface DraftTeam {
  team_id: string
  user_id: string
  pg_id: number
  sg_id: number
  sf_id: number
  pf_id: number
  c_id: number
  team_score: number
  created_at: string
}

// Draft Room for multiplayer
export interface DraftRoom {
  id: string
  code: string  // 6-character join code
  host_id: string
  guest_id: string | null
  status: 'waiting' | 'drafting' | 'completed'
  current_position: 'PG' | 'SG' | 'SF' | 'PF' | 'C'
  player_pool: any  // Shared players for both users
  host_picks: Record<string, number>  // position -> player_id
  guest_picks: Record<string, number>
  host_ready: boolean
  guest_ready: boolean
  winner_id: string | null
  created_at: string
}

// In-memory cache for players - persists for the entire session
let playersCache: Player[] | null = null

// Get all players with session caching (loads once per session)
async function getCachedPlayers(): Promise<Player[]> {
  // Return cached data if available (persists for entire session)
  if (playersCache) {
    return playersCache
  }
  
  // Fetch fresh data
  const { data, error } = await supabase
    .from('cached_players')
    .select('*')
  
  if (error) throw error
  
  playersCache = data as Player[]
  
  return playersCache
}

// Force refresh cache (call this if you need to reload players)
export function clearPlayersCache() {
  playersCache = null
}

// Helper functions - uses cache
export async function getPlayers(filters?: {
  team?: string
  position?: string
  minPPG?: number
}) {
  const allPlayers = await getCachedPlayers()
  
  let players = allPlayers
  
  if (filters?.team) {
    players = players.filter(p => p.team_abbreviation === filters.team)
  }
  if (filters?.position) {
    players = players.filter(p => p.position === filters.position)
  }
  if (filters?.minPPG) {
    players = players.filter(p => (p.season_stats?.pts || 0) >= filters.minPPG!)
  }
  
  return players
}

export async function getPlayerById(playerId: number) {
  // First check cache
  if (playersCache) {
    const cached = playersCache.find(p => p.player_id === playerId)
    if (cached) return cached
  }
  
  // Fallback to direct query
  const { data, error } = await supabase
    .from('cached_players')
    .select('*')
    .eq('player_id', playerId)
    .single()
  
  if (error) throw error
  return data as Player
}

// Get random players for games (uses cache)
export async function getRandomPlayers(count: number = 10, minGames?: number) {
  const allPlayers = await getCachedPlayers()
  
  let players = allPlayers
  
  // Filter by minimum games played if specified
  if (minGames) {
    players = players.filter(p => p.season_stats?.gp >= minGames)
  }
  
  // Shuffle and take count
  const shuffled = [...players].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// Get star players (high PPG) - uses cache
export async function getStarPlayers(minPPG: number = 20) {
  const allPlayers = await getCachedPlayers()
  
  const players = allPlayers.filter(
    p => (p.season_stats?.pts || 0) >= minPPG
  )
  
  return players.sort((a, b) => (b.season_stats?.pts || 0) - (a.season_stats?.pts || 0))
}

// Get role players (medium PPG, for guessing games) - uses cache
export async function getRolePlayers(minPPG: number = 8, maxPPG: number = 18, minGames: number = 15) {
  const allPlayers = await getCachedPlayers()
  
  const players = allPlayers.filter(p => {
    const pts = p.season_stats?.pts || 0
    const gp = p.season_stats?.gp || 0
    return pts >= minPPG && pts <= maxPPG && gp >= minGames
  })
  
  return [...players].sort(() => Math.random() - 0.5)
}

// Get players by position for draft - uses cache
export async function getPlayersByPosition(position: string, count: number = 5) {
  const allPlayers = await getCachedPlayers()
  
  const players = allPlayers.filter(p => p.position === position)
  
  // Sort by rating and return top count
  return players
    .sort((a, b) => (b.season_stats?.rating || 0) - (a.season_stats?.rating || 0))
    .slice(0, count)
}

// Get all players for draft pools (grouped by position) - uses cache
export async function getDraftPlayerPools() {
  const allPlayers = await getCachedPlayers()
  
  // Group by position and sort each group by rating
  const pools: Record<string, Player[]> = {
    PG: [],
    SG: [],
    SF: [],
    PF: [],
    C: []
  }
  
  for (const player of allPlayers) {
    const pos = player.position
    if (pos in pools) {
      pools[pos].push(player)
    }
  }
  
  // Sort each position by rating and take top 10
  for (const pos of Object.keys(pools)) {
    pools[pos] = pools[pos]
      .sort((a, b) => (b.season_stats?.rating || 0) - (a.season_stats?.rating || 0))
      .slice(0, 10)
  }
  
  return pools
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()
  
  if (error) throw error
  return data as User
}

export async function saveBattleResult(battle: Omit<Battle, 'battle_id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('battles')
    .insert(battle)
    .select()
    .single()
  
  if (error) throw error
  return data as Battle
}

export async function getUserBattles(userId: string) {
  const { data, error } = await supabase
    .from('battles')
    .select('*')
    .eq('user_id_1', userId)
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (error) throw error
  return data as Battle[]
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// ========== DRAFT ROOM FUNCTIONS ==========

// Generate a random 6-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // Exclude confusing chars like O, 0, I, 1
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Create a new draft room (host)
export async function createDraftRoom(hostId: string, playerPool: any): Promise<DraftRoom> {
  const code = generateRoomCode()
  
  const { data, error } = await supabase
    .from('draft_rooms')
    .insert({
      code,
      host_id: hostId,
      status: 'waiting',
      current_position: 'PG',
      player_pool: playerPool,
      host_picks: {},
      guest_picks: {},
      host_ready: false,
      guest_ready: false,
    })
    .select()
    .single()
  
  if (error) throw error
  return data as DraftRoom
}

// Join a draft room by code (guest)
export async function joinDraftRoom(code: string, guestId: string): Promise<DraftRoom> {
  // First find the room
  const { data: room, error: findError } = await supabase
    .from('draft_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('status', 'waiting')
    .single()
  
  if (findError || !room) {
    throw new Error('Room not found or already started')
  }
  
  if (room.host_id === guestId) {
    throw new Error('Cannot join your own room')
  }
  
  // Update room with guest
  const { data, error } = await supabase
    .from('draft_rooms')
    .update({
      guest_id: guestId,
      status: 'drafting',
    })
    .eq('id', room.id)
    .select()
    .single()
  
  if (error) throw error
  return data as DraftRoom
}

// Get draft room by ID
export async function getDraftRoom(roomId: string): Promise<DraftRoom | null> {
  const { data, error } = await supabase
    .from('draft_rooms')
    .select('*')
    .eq('id', roomId)
    .single()
  
  if (error) return null
  return data as DraftRoom
}

// Get draft room by code
export async function getDraftRoomByCode(code: string): Promise<DraftRoom | null> {
  const { data, error } = await supabase
    .from('draft_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()
  
  if (error) return null
  return data as DraftRoom
}

// Make a draft pick
export async function makeDraftPick(
  roomId: string,
  userId: string,
  position: string,
  playerId: number
): Promise<void> {
  // Get current room
  const room = await getDraftRoom(roomId)
  if (!room) throw new Error('Room not found')
  
  const isHost = room.host_id === userId
  const picksField = isHost ? 'host_picks' : 'guest_picks'
  const readyField = isHost ? 'host_ready' : 'guest_ready'
  
  const currentPicks = isHost ? room.host_picks : room.guest_picks
  const newPicks = { ...currentPicks, [position]: playerId }
  
  // Check if all positions are filled
  const positions = ['PG', 'SG', 'SF', 'PF', 'C']
  const allPicked = positions.every(pos => pos in newPicks)
  
  const { error } = await supabase
    .from('draft_rooms')
    .update({
      [picksField]: newPicks,
      [readyField]: allPicked,
    })
    .eq('id', roomId)
  
  if (error) throw error
}

// Mark player as ready / advance position
export async function advanceDraftPosition(roomId: string): Promise<void> {
  const room = await getDraftRoom(roomId)
  if (!room) throw new Error('Room not found')
  
  const positions: Array<'PG' | 'SG' | 'SF' | 'PF' | 'C'> = ['PG', 'SG', 'SF', 'PF', 'C']
  const currentIndex = positions.indexOf(room.current_position)
  
  if (currentIndex < positions.length - 1) {
    const { error } = await supabase
      .from('draft_rooms')
      .update({
        current_position: positions[currentIndex + 1],
      })
      .eq('id', roomId)
    
    if (error) throw error
  }
}

// Complete draft and calculate winner
export async function completeDraft(roomId: string, playerPool: any): Promise<{ winnerId: string | null; hostScore: number; guestScore: number }> {
  const room = await getDraftRoom(roomId)
  if (!room) throw new Error('Room not found')
  
  // Calculate scores
  const calculateScore = (picks: Record<string, number>) => {
    let score = 0
    Object.entries(picks).forEach(([position, playerId]) => {
      const allPlayers = Object.values(playerPool).flat() as any[]
      const player = allPlayers.find((p) => p.id === playerId)
      if (player) {
        score += (player.rating || 0) + (player.pts || 0) + (player.reb || 0) + (player.ast || 0)
      }
    })
    return score
  }
  
  const hostScore = calculateScore(room.host_picks)
  const guestScore = calculateScore(room.guest_picks)
  const winnerId = hostScore > guestScore ? room.host_id : 
                   guestScore > hostScore ? room.guest_id : null
  
  const { error } = await supabase
    .from('draft_rooms')
    .update({
      status: 'completed',
      winner_id: winnerId,
    })
    .eq('id', roomId)
  
  if (error) throw error
  
  return { winnerId, hostScore, guestScore }
}

// Subscribe to draft room changes (real-time)
export function subscribeToDraftRoom(
  roomId: string,
  callback: (room: DraftRoom) => void
) {
  return supabase
    .channel(`draft_room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'draft_rooms',
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        callback(payload.new as DraftRoom)
      }
    )
    .subscribe()
}

// Clean up old draft rooms (older than 1 hour)
export async function cleanupOldRooms(): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  
  await supabase
    .from('draft_rooms')
    .delete()
    .lt('created_at', oneHourAgo)
    .neq('status', 'drafting')
}

// ========== GAME SCORE FUNCTIONS ==========

export interface GameScore {
  id?: string
  user_id: string
  game_type: 'whos-that' | 'blind-comparison' | 'the-journey' | 'draft-arena' | 'stat-attack'
  score: number
  questions_answered?: number
  correct_answers?: number
  time_taken?: number  // in seconds
  created_at?: string
}

// Save a game score
export async function saveGameScore(score: Omit<GameScore, 'id' | 'created_at'>): Promise<GameScore | null> {
  try {
    const { data, error } = await supabase
      .from('game_scores')
      .insert(score)
      .select()
      .single()
    
    if (error) {
      console.warn('Failed to save game score:', error.message)
      return null
    }
    
    // Also update user stats
    await updateUserStats(score.user_id, score.score, score.correct_answers || 0, score.questions_answered || 0)
    
    // Trigger achievements
    await checkFirstStepsAchievement(score.user_id)
    
    // Get updated user streak for streak achievement
    const { data: user } = await supabase
      .from('users')
      .select('current_streak')
      .eq('id', score.user_id)
      .single()
    
    if (user?.current_streak) {
      await checkStreakAchievement(score.user_id, user.current_streak)
    }
    
    // Track game-specific achievements
    if (score.game_type === 'draft-arena') {
      if ((score.correct_answers || 0) >= (score.questions_answered || 0) / 2) {
        await updateAchievementProgress(score.user_id, 'draft_king', 1)
      }
    }
    
    // Track role player guesses for guess-based games
    if (['whos-that', 'the-journey', 'blind-comparison', 'stat-attack'].includes(score.game_type)) {
      if ((score.correct_answers || 0) > 0) {
        await updateAchievementProgress(score.user_id, 'role_player_expert', score.correct_answers || 0)
      }
    }
    
    return data as GameScore
  } catch {
    return null
  }
}

import { calculateLevel } from '@/lib/xpUtils'

// Update user stats after a game
export async function updateUserStats(
  userId: string, 
  xpGained: number,
  correctAnswers: number,
  totalQuestions: number
): Promise<void> {
  try {
    // First get current user stats
    const { data: user } = await supabase
      .from('users')
      .select('xp, level, wins, losses, current_streak, best_streak, games_played')
      .eq('id', userId)
      .single()
    
    if (!user) return
    
    // Calculate new values
    const newXP = (user.xp || 0) + xpGained
    const newLevel = calculateLevel(newXP) // Use proper scaling XP system
    const isWin = totalQuestions > 0 && correctAnswers >= totalQuestions / 2
    const newWins = (user.wins || 0) + (isWin ? 1 : 0)
    const newLosses = (user.losses || 0) + (isWin ? 0 : 1)
    const newStreak = isWin ? (user.current_streak || 0) + 1 : 0
    const newBestStreak = Math.max(user.best_streak || 0, newStreak)
    const newGamesPlayed = (user.games_played || 0) + 1
    
    // Update user
    await supabase
      .from('users')
      .update({
        xp: newXP,
        level: newLevel,
        wins: newWins,
        losses: newLosses,
        current_streak: newStreak,
        best_streak: newBestStreak,
        games_played: newGamesPlayed,
      })
      .eq('id', userId)
  } catch (err) {
    console.warn('Failed to update user stats:', err)
  }
}

// Get user's game history
export async function getUserGameHistory(userId: string, limit: number = 10): Promise<GameScore[]> {
  const { data, error } = await supabase
    .from('game_scores')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) return []
  return data as GameScore[]
}

// Get leaderboard for a specific game type
export async function getLeaderboard(gameType?: string, limit: number = 10) {
  let query = supabase
    .from('game_scores')
    .select('*, users!inner(username, avatar_url)')
    .order('score', { ascending: false })
    .limit(limit)
  
  if (gameType) {
    query = query.eq('game_type', gameType)
  }
  
  const { data, error } = await query
  
  if (error) return []
  return data
}

// ========== ACHIEVEMENTS SYSTEM ==========

export interface Achievement {
  id: string
  name: string
  description: string
  type: 'first_steps' | 'streak_master' | 'draft_king' | 'role_player_expert' | 'stat_nerd' | 'perfect_week'
  threshold: number  // Number required to unlock
}

export interface UserAchievement {
  id?: string
  user_id: string
  achievement_type: string
  progress: number
  unlocked: boolean
  unlocked_at?: string
}

// Achievement definitions
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_steps', name: 'First Steps', description: 'Complete your first game', type: 'first_steps', threshold: 1 },
  { id: 'streak_master', name: 'Streak Master', description: 'Get a 5-day streak', type: 'streak_master', threshold: 5 },
  { id: 'draft_king', name: 'Draft King', description: 'Win 10 draft battles', type: 'draft_king', threshold: 10 },
  { id: 'role_player_expert', name: 'Role Player Expert', description: 'Correctly guess 50 role players', type: 'role_player_expert', threshold: 50 },
  { id: 'stat_nerd', name: 'Stat Nerd', description: 'View 100 shot charts', type: 'stat_nerd', threshold: 100 },
  { id: 'perfect_week', name: 'Perfect Week', description: 'Complete all daily challenges for a week', type: 'perfect_week', threshold: 7 },
]

// Get user's achievements
export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
  try {
    const { data, error } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
    
    if (error) throw error
    return data as UserAchievement[]
  } catch {
    // Return empty array with default progress if table doesn't exist
    return []
  }
}

// Update achievement progress
export async function updateAchievementProgress(
  userId: string,
  achievementType: string,
  incrementBy: number = 1
): Promise<boolean> {
  try {
    // Get current progress
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .eq('achievement_type', achievementType)
      .single()
    
    const achievement = ACHIEVEMENTS.find(a => a.type === achievementType)
    if (!achievement) return false
    
    const currentProgress = existing?.progress || 0
    const newProgress = currentProgress + incrementBy
    const nowUnlocked = newProgress >= achievement.threshold
    
    if (existing) {
      // Update existing record
      await supabase
        .from('user_achievements')
        .update({
          progress: newProgress,
          unlocked: nowUnlocked || existing.unlocked,
          unlocked_at: nowUnlocked && !existing.unlocked ? new Date().toISOString() : existing.unlocked_at
        })
        .eq('user_id', userId)
        .eq('achievement_type', achievementType)
    } else {
      // Insert new record
      await supabase
        .from('user_achievements')
        .insert({
          user_id: userId,
          achievement_type: achievementType,
          progress: newProgress,
          unlocked: nowUnlocked,
          unlocked_at: nowUnlocked ? new Date().toISOString() : null
        })
    }
    
    // Return true if newly unlocked
    return nowUnlocked && (!existing || !existing.unlocked)
  } catch (err) {
    console.warn('Failed to update achievement:', err)
    return false
  }
}

// Check and unlock first_steps achievement (first game completed)
export async function checkFirstStepsAchievement(userId: string): Promise<boolean> {
  return await updateAchievementProgress(userId, 'first_steps', 1)
}

// Check streak achievement (called when streak is updated)
export async function checkStreakAchievement(userId: string, currentStreak: number): Promise<boolean> {
  try {
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .eq('achievement_type', 'streak_master')
      .single()
    
    if (existing?.unlocked) return false
    
    if (currentStreak >= 5) {
      await supabase
        .from('user_achievements')
        .upsert({
          user_id: userId,
          achievement_type: 'streak_master',
          progress: currentStreak,
          unlocked: true,
          unlocked_at: new Date().toISOString()
        })
      return true
    }
    return false
  } catch {
    return false
  }
}

// Increment stat views (for Stat Nerd achievement)
export async function incrementStatViews(userId: string): Promise<boolean> {
  return await updateAchievementProgress(userId, 'stat_nerd', 1)
}

// Increment role player guesses (for Role Player Expert achievement)
export async function incrementRolePlayerGuesses(userId: string, count: number = 1): Promise<boolean> {
  return await updateAchievementProgress(userId, 'role_player_expert', count)
}

// Increment draft battle wins (for Draft King achievement)
export async function incrementDraftBattleWins(userId: string): Promise<boolean> {
  return await updateAchievementProgress(userId, 'draft_king', 1)
}
