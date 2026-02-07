'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { QRCodeSVG } from 'qrcode.react'
import { 
  CrownIcon, 
  GamepadIcon, 
  HourglassIcon,
  CheckIcon,
  XIcon
} from '@/components/icons'
import { BasketballLoader } from '@/components/ui/BasketballLoader'

interface Player {
  id: string
  score: number
  answers: any[]
  username?: string
  avatar_url?: string
}

interface Room {
  id: string
  code: string
  host_id: string
  guest_id: string | null
  game_type: string
  question_count: number
  timer_duration: number
  max_players?: number
  status: 'waiting' | 'playing' | 'finished'
  players: Player[]
  questions?: any[]
  current_question?: number
}

function LobbyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomCode = searchParams.get('code')
  const isHost = searchParams.get('host') === 'true'

  // Use centralized auth store
  const { user } = useAuthStore()
  
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startingGame, setStartingGame] = useState(false)
  const [connected, setConnected] = useState(false)
  const [playerProfiles, setPlayerProfiles] = useState<Record<string, { username: string; avatar_url: string | null }>>({})

  // Fetch room data
  const fetchRoom = useCallback(async () => {
    if (!roomCode) return

    console.log('[Lobby] Fetching room:', roomCode)
    const { data, error } = await supabase
      .from('multiplayer_rooms')
      .select('*')
      .eq('code', roomCode)
      .single()

    if (error) {
      console.error('[Lobby] Error fetching room:', error)
      setError('Room not found or has expired')
      return
    }

    if (!data) {
      setError('Room not found')
      return
    }

    console.log('[Lobby] Room loaded, status:', data.status, 'guest_id:', data.guest_id)
    setRoom(data as Room)

    // If game started, redirect to game
    if (data.status === 'playing') {
      router.push(`/multiplayer/game?code=${roomCode}`)
    }
  }, [roomCode, router])

  // Fetch profiles for all players in the room
  useEffect(() => {
    if (!room?.players || room.players.length === 0) return

    const playerIds = room.players.map(p => p.id)
    // Only fetch IDs we don't already have
    const missingIds = playerIds.filter(id => !playerProfiles[id])
    if (missingIds.length === 0) return

    console.log('[Lobby] Fetching profiles for:', missingIds)
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .in('id', missingIds)

      if (data) {
        setPlayerProfiles(prev => {
          const updated = { ...prev }
          data.forEach(u => {
            updated[u.id] = { username: u.username, avatar_url: u.avatar_url }
          })
          return updated
        })
      }
    }
    fetchProfiles()
  }, [room?.players?.length])

  useEffect(() => {
    fetchRoom().then(() => setLoading(false))
  }, [fetchRoom])

  // Real-time subscription
  useEffect(() => {
    if (!roomCode) return

    console.log('[Lobby] Setting up real-time subscription for room:', roomCode)
    const channel = supabase
      .channel(`room:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'multiplayer_rooms',
          filter: `code=eq.${roomCode}`,
        },
        (payload) => {
          console.log('[Lobby] Real-time update received:', payload.eventType)
          const newRoom = payload.new as Room
          console.log('[Lobby] Updated room - status:', newRoom.status, 'guest_id:', newRoom.guest_id, 'players:', newRoom.players?.length)
          setRoom(newRoom)
          
          if (newRoom.status === 'playing') {
            router.push(`/multiplayer/game?code=${roomCode}`)
          }
        }
      )
      .subscribe((status) => {
        console.log('[Lobby] Subscription status:', status)
        setConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomCode, router])

  // Polling fallback — re-fetch room every 3s in case real-time isn't working
  useEffect(() => {
    if (!roomCode || !room) return

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('multiplayer_rooms')
        .select('*')
        .eq('code', roomCode)
        .single()

      if (data) {
        const updated = data as Room
        // Only update if something actually changed
        if (
          updated.status !== room.status ||
          updated.players?.length !== room.players?.length
        ) {
          console.log('[Lobby] Poll detected change - players:', updated.players?.length, 'status:', updated.status)
          setRoom(updated)
          if (updated.status === 'playing') {
            router.push(`/multiplayer/game?code=${roomCode}`)
          }
        }
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [roomCode, room?.status, room?.players?.length, router])

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleStartGame = async () => {
    if (!room || !isHost) return
    setStartingGame(true)
    setError(null)

    try {
      // Generate questions based on game type
      const questions = await generateQuestions(room.game_type, room.question_count)

      if (questions.length === 0) {
        setError('Failed to generate questions. Try again.')
        setStartingGame(false)
        return
      }

      const { error } = await supabase
        .from('multiplayer_rooms')
        .update({
          status: 'playing',
          questions,
          current_question: 0,
        })
        .eq('id', room.id)

      if (error) {
        console.error('Failed to start game:', error)
        setError('Failed to start game. Try again.')
      }
    } catch (err: any) {
      console.error('Failed to start game:', err)
      setError(err?.message || 'Failed to start game')
    } finally {
      setStartingGame(false)
    }
  }

  const handleLeaveRoom = async () => {
    if (!room || !user) return

    if (isHost) {
      // Delete room if host leaves
      await supabase
        .from('multiplayer_rooms')
        .delete()
        .eq('id', room.id)
    } else {
      // Remove this player from room
      const updatedPlayers = room.players.filter(p => p.id !== user.id)
      const updatePayload: any = { players: updatedPlayers }
      // Clear guest_id if this player was the guest
      if (room.guest_id === user.id) {
        // Set guest_id to the next non-host player, or null
        const nextGuest = updatedPlayers.find(p => p.id !== room.host_id)
        updatePayload.guest_id = nextGuest?.id || null
      }
      await supabase
        .from('multiplayer_rooms')
        .update(updatePayload)
        .eq('id', room.id)
    }

    router.push('/multiplayer')
  }

  const joinUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/multiplayer?join=${roomCode}` 
    : ''

  const gameNames: Record<string, string> = {
    'whos-that': "Who's That Role Player",
    'the-journey': 'The Journey',
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BasketballLoader size="lg" text="Loading lobby..." />
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-2">Room not found</p>
          {error && <p className="text-sm text-hot-pink mb-4">{error}</p>}
          <button
            onClick={() => router.push('/multiplayer')}
            className="px-6 py-3 bg-electric-lime text-gunmetal font-bold rounded-xl"
          >
            Back to Multiplayer
          </button>
        </div>
      </div>
    )
  }

  const canStart = (room.players?.length || 0) >= 2
  const maxPlayers = room.max_players || 5
  const emptySlots = Math.max(0, maxPlayers - (room.players?.length || 0))

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Connection Status */}
        <div className="flex justify-end mb-2">
          <div className={`flex items-center gap-2 text-xs px-3 py-1 rounded-full ${
            connected ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
            {connected ? 'Connected' : 'Connecting...'}
          </div>
        </div>

        {/* Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mb-4"
            >
              <div className="bg-hot-pink/20 border border-hot-pink/40 rounded-xl px-4 py-3 flex items-center gap-3">
                <XIcon size={16} className="text-hot-pink shrink-0" />
                <p className="text-sm text-hot-pink flex-1">{error}</p>
                <button onClick={() => setError(null)} className="text-hot-pink/60 hover:text-hot-pink">
                  <XIcon size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <h1 className="text-2xl font-display font-bold mb-1">
            {gameNames[room.game_type] || room.game_type}
          </h1>
          <p className="text-muted">
            {room.question_count} questions • {room.timer_duration}s per question
          </p>
        </motion.div>

        {/* Room Code */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-6 mb-6 text-center"
        >
          <p className="text-sm text-muted mb-2">Room Code</p>
          <button
            onClick={handleCopyCode}
            className="text-4xl font-mono font-bold tracking-widest text-electric-lime hover:text-green-400 transition-colors"
          >
            {roomCode}
          </button>
          <p className="text-xs text-muted mt-2">
            {copied ? <><CheckIcon size={12} className="inline mr-1" />Copied!</> : 'Click to copy'}
          </p>
        </motion.div>

        {/* QR Code */}
        {isHost && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6 mb-6 flex flex-col items-center"
          >
            <p className="text-sm text-muted mb-3">Scan to join</p>
            <div className="bg-white p-3 rounded-xl">
              <QRCodeSVG value={joinUrl} size={150} />
            </div>
          </motion.div>
        )}

        {/* Players */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 mb-6"
        >
          <h3 className="text-lg font-bold mb-4">
            Players ({room.players?.length || 0}/{maxPlayers})
          </h3>
          
          <div className="space-y-3">
            {/* Render all joined players */}
            {room.players?.map((player, index) => {
              const profile = playerProfiles[player.id]
              const isPlayerHost = player.id === room.host_id
              const displayName = profile?.username || player.username || (isPlayerHost ? 'Host' : `Player ${index + 1}`)
              const avatarUrl = profile?.avatar_url || null

              return (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3 p-3 bg-surface rounded-xl"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${
                        isPlayerHost ? 'bg-electric-lime/20' : 'bg-hot-pink/20'
                      }`}>
                        {isPlayerHost ? (
                          <CrownIcon className="text-electric-lime" size={20} />
                        ) : (
                          <GamepadIcon className="text-hot-pink" size={20} />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">{displayName}</p>
                    <p className="text-xs text-muted">{isPlayerHost ? 'Host' : `Player ${index + 1}`}</p>
                  </div>
                  <span className="text-electric-lime flex items-center gap-1">
                    <CheckIcon size={14} /> Ready
                  </span>
                </motion.div>
              )
            })}

            {/* Empty slots */}
            {Array.from({ length: emptySlots }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface/50 border border-dashed border-surface"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center">
                  <div className="w-full h-full bg-surface flex items-center justify-center">
                    <HourglassIcon className="text-muted" size={20} />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-muted">Waiting for player...</p>
                  <p className="text-xs text-muted">Open slot</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Actions */}
        <div className="space-y-3">
          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={!canStart || startingGame}
              className="w-full py-4 bg-electric-lime text-gunmetal font-bold rounded-xl hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {startingGame ? (
                <>
                  <span className="w-5 h-5 border-2 border-gunmetal/30 border-t-gunmetal rounded-full animate-spin" />
                  Starting...
                </>
              ) : canStart ? (
                `Start Game (${room.players?.length || 0} players)`
              ) : (
                'Waiting for opponent...'
              )}
            </button>
          )}

          {!isHost && (
            <div className="text-center p-4 bg-surface/50 rounded-xl">
              <p className="text-muted">Waiting for host to start the game...</p>
            </div>
          )}

          <button
            onClick={handleLeaveRoom}
            className="w-full py-3 bg-surface text-muted hover:text-hot-pink font-medium rounded-xl transition-colors"
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  )
}

// Generate questions based on game type
async function generateQuestions(gameType: string, count: number): Promise<any[]> {
  if (gameType === 'whos-that') {
    // Fetch role players from database
    const { data: players } = await supabase
      .from('cached_players')
      .select('player_id, full_name, team_abbreviation, position, season_stats')
    
    if (!players || players.length === 0) {
      // Fallback players
      return Array.from({ length: count }, (_, i) => ({
        id: i,
        playerId: 203999,
        name: 'Nikola Jokic',
        team: 'DEN',
        position: 'C',
        stats: { pts: 26.4, reb: 12.4, ast: 9.0 },
      }))
    }

    // Filter role players (8-20 PPG)
    const rolePlayers = players.filter(p => {
      const pts = p.season_stats?.pts || 0
      return pts >= 8 && pts <= 20
    })

    // Shuffle and pick
    const shuffled = [...rolePlayers].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count).map((p, i) => ({
      id: i,
      playerId: p.player_id,
      name: p.full_name,
      team: p.team_abbreviation,
      position: p.position,
      stats: {
        pts: p.season_stats?.pts || 0,
        reb: p.season_stats?.reb || 0,
        ast: p.season_stats?.ast || 0,
      },
    }))
  }

  if (gameType === 'the-journey') {
    // Hardcoded journey data
    const journeys = [
      { teams: ['CLE', 'MIA', 'CLE', 'LAL'], answer: 'LeBron James', id: 2544 },
      { teams: ['OKC', 'GSW', 'BKN', 'PHX'], answer: 'Kevin Durant', id: 201142 },
      { teams: ['OKC', 'HOU', 'BKN', 'PHI', 'LAC'], answer: 'James Harden', id: 201935 },
      { teams: ['SAS', 'TOR', 'LAC'], answer: 'Kawhi Leonard', id: 202695 },
      { teams: ['IND', 'OKC', 'LAC', 'PHI'], answer: 'Paul George', id: 202331 },
      { teams: ['CLE', 'BOS', 'BKN', 'DAL'], answer: 'Kyrie Irving', id: 202681 },
      { teams: ['CHI', 'MIN', 'PHI', 'MIA'], answer: 'Jimmy Butler', id: 202710 },
      { teams: ['TOR', 'SAS', 'CHI', 'SAC'], answer: 'DeMar DeRozan', id: 201942 },
      { teams: ['GSW', 'DAL'], answer: 'Klay Thompson', id: 202691 },
      { teams: ['POR', 'MIL'], answer: 'Damian Lillard', id: 203081 },
      { teams: ['PHI', 'NOP', 'MIL', 'BOS'], answer: 'Jrue Holiday', id: 201950 },
      { teams: ['TOR', 'IND'], answer: 'Pascal Siakam', id: 1627783 },
      { teams: ['GSW'], answer: 'Stephen Curry', id: 201939 },
      { teams: ['MIL'], answer: 'Giannis Antetokounmpo', id: 203507 },
      { teams: ['DEN'], answer: 'Nikola Jokic', id: 203999 },
    ]

    const shuffled = [...journeys].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count).map((j, i) => ({
      id: i,
      teams: j.teams,
      answer: j.answer,
      playerId: j.id,
    }))
  }

  return []
}

export default function LobbyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <BasketballLoader size="lg" text="Loading..." />
      </div>
    }>
      <LobbyContent />
    </Suspense>
  )
}
