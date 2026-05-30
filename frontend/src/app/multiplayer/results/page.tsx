'use client'

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { saveGameScore } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useSessionDataStore } from '@/store/sessionDataStore'
import { api } from '@/lib/api'
import { TeamLogo } from '@/components/icons/TeamLogos'
import confetti from 'canvas-confetti'
import { sounds } from '@/lib/sounds'
import { useSettingsStore } from '@/store/settingsStore'
import { 
  TrophyIcon, 
  CrownIcon, 
  HandshakeIcon, 
  SadFaceIcon 
} from '@/components/icons'
import { BasketballLoader } from '@/components/ui/BasketballLoader'

interface Answer {
  questionId: number
  answer: string
  correct: boolean
  timeTaken: number
}

interface PlayerData {
  id: string
  score: number
  answers: Answer[]
  last_seen?: number
  finished?: boolean
}

interface Question {
  id: number
  playerId?: number
  name?: string
  team?: string
  position?: string
  stats?: { pts: number; reb: number; ast: number }
  teams?: string[]
  answer?: string
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
  players: PlayerData[]
  questions: Question[]
  current_question: number
  play_again_votes?: string[]
}

interface UserProfile {
  id: string
  username: string
  avatar_url?: string
}

const HEARTBEAT_INTERVAL_MS = 20000
const INACTIVE_TIMEOUT_MS = 90000
const AUTO_REMOVE_STORAGE_KEY = 'garu:autoRemoveInactive'

function ResultsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomCode = searchParams.get('code')

  // Use centralized auth store
  const { user } = useAuthStore()
  const { soundEnabled } = useSettingsStore()
  
  const [room, setRoom] = useState<Room | null>(null)
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({})
  const [loading, setLoading] = useState(true)
  const [statsSaved, setStatsSaved] = useState(false)
  const [playAgainVotes, setPlayAgainVotes] = useState<string[]>([])
  const [hasVoted, setHasVoted] = useState(false)
  const [connected, setConnected] = useState(false)
  const [autoRemoveInactive, setAutoRemoveInactive] = useState(true)
  const redirectingRef = useRef(false)
  const lastStatusRef = useRef<Room['status'] | null>(null)
  const leavingRef = useRef(false)
  const lastSeenRef = useRef<number | null>(null)

  const roomId = room?.id
  const roomStatus = room?.status
  const hostId = room?.host_id
  const userId = user?.id
  const isHost = !!userId && hostId === userId

  const fetchRoom = useCallback(async () => {
    if (!roomCode) return

    const { data, error } = await supabase
      .from('multiplayer_rooms')
      .select('*')
      .eq('code', roomCode)
      .single()

    if (error || !data) {
      router.push('/multiplayer')
      return
    }

    setRoom(data as Room)
    lastStatusRef.current = (data as Room).status

    // Initialize play again votes from room data
    if (data.play_again_votes && Array.isArray(data.play_again_votes)) {
      setPlayAgainVotes(data.play_again_votes)
      const currentUser = useAuthStore.getState().user
      if (currentUser && data.play_again_votes.includes(currentUser.id)) {
        setHasVoted(true)
      }
    }

    // Fetch profiles for all players in the players array
    const playerIds = (data.players || []).map((p: PlayerData) => p.id).filter(Boolean)
    if (playerIds.length === 0) {
      // Fallback: use host_id + guest_id
      playerIds.push(data.host_id)
      if (data.guest_id) playerIds.push(data.guest_id)
    }
    const { data: profilesData } = await supabase
      .from('users')
      .select('id, username, avatar_url')
      .in('id', playerIds)

    if (profilesData) {
      const profileMap: Record<string, UserProfile> = {}
      profilesData.forEach(p => {
        profileMap[p.id] = p
      })
      setProfiles(profileMap)
    }

    setLoading(false)

    // Trigger confetti for winner - use user from auth store
    const currentUser = useAuthStore.getState().user
    if (currentUser && data.players) {
      const sortedPlayers = [...data.players].sort((a: PlayerData, b: PlayerData) => b.score - a.score)
      if (sortedPlayers[0]?.id === currentUser.id) {
        setTimeout(() => {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          })
        }, 500)
        if (soundEnabled) {
          sounds.victory()
        }
      }

      // Save multiplayer result to game_scores (once per game)
      if (!statsSaved) {
        setStatsSaved(true)
        const myData = data.players.find((p: PlayerData) => p.id === currentUser.id)
        if (myData) {
          const gameTypeKey = `multiplayer-${data.game_type}` as 'multiplayer-whos-that' | 'multiplayer-the-journey'
          const correctCount = myData.answers.filter((a: Answer) => a.correct).length
          const totalTime = myData.answers.reduce((sum: number, a: Answer) => sum + a.timeTaken, 0)

          // Save to database
          await saveGameScore({
            game_type: gameTypeKey,
            score: myData.score,
            correct_answers: correctCount,
            questions_answered: data.question_count,
            time_taken: totalTime,
          })

          // Update local session store
          const { addGameToHistory, refreshStats } = useSessionDataStore.getState()
          addGameToHistory({
            id: `mp-${data.code}-${currentUser.id}`,
            gameType: gameTypeKey,
            score: myData.score,
            correctAnswers: correctCount,
            questionsAnswered: data.question_count,
            timeTaken: totalTime,
            createdAt: new Date().toISOString(),
          })
          // Refresh stats from DB to get accurate win/loss counts
          await refreshStats()
        }
      }
    }
  }, [roomCode, router, statsSaved, soundEnabled])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(AUTO_REMOVE_STORAGE_KEY)
    if (stored !== null) {
      setAutoRemoveInactive(stored === 'true')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(AUTO_REMOVE_STORAGE_KEY, String(autoRemoveInactive))
  }, [autoRemoveInactive])

  useEffect(() => {
    if (!room || !userId) return
    const me = room.players?.find(p => p.id === userId)
    if (typeof me?.last_seen === 'number') {
      lastSeenRef.current = me.last_seen
    }
  }, [room?.players, userId])

  const touchPresence = useCallback(async () => {
    if (!roomId || !userId) return

    const { data, error } = await supabase
      .from('multiplayer_rooms')
      .select('players, updated_at')
      .eq('id', roomId)
      .single()

    if (error || !data?.players) return

    const players = data.players as PlayerData[]
    if (!players.some(p => p.id === userId)) return

    const now = Date.now()
    const updatedPlayers = players.map(p =>
      p.id === userId ? { ...p, last_seen: now } : p
    )

    await supabase
      .from('multiplayer_rooms')
      .update({ players: updatedPlayers })
      .eq('id', roomId)
      .eq('updated_at', data.updated_at)
  }, [roomId, userId])

  const pruneInactivePlayers = useCallback(async () => {
    if (!roomId || !isHost || roomStatus !== 'finished') return

    const { data, error } = await supabase
      .from('multiplayer_rooms')
      .select('players, updated_at, host_id, guest_id, play_again_votes')
      .eq('id', roomId)
      .single()

    if (error || !data?.players) return

    const now = Date.now()
    const players = data.players as PlayerData[]
    const isInactive = (player: PlayerData) => {
      if (player.id === data.host_id) return false
      const lastSeen = typeof player.last_seen === 'number' ? player.last_seen : now
      return now - lastSeen > INACTIVE_TIMEOUT_MS
    }

    const filteredPlayers = players.filter(p => !isInactive(p))
    if (filteredPlayers.length === players.length) return

    const updatedVotes = (data.play_again_votes || []).filter((id: string) =>
      filteredPlayers.some(p => p.id === id)
    )

    const nextGuest = data.guest_id && filteredPlayers.some(p => p.id === data.guest_id)
      ? data.guest_id
      : filteredPlayers.find(p => p.id !== data.host_id)?.id || null

    await supabase
      .from('multiplayer_rooms')
      .update({ players: filteredPlayers, guest_id: nextGuest, play_again_votes: updatedVotes })
      .eq('id', roomId)
      .eq('updated_at', data.updated_at)
  }, [roomId, roomStatus, isHost])

  const handleKickPlayer = async (playerId: string) => {
    if (!roomId || !isHost || playerId === hostId) return

    const { data, error } = await supabase
      .from('multiplayer_rooms')
      .select('players, updated_at, host_id, guest_id, play_again_votes')
      .eq('id', roomId)
      .single()

    if (error || !data?.players) return

    const players = (data.players as PlayerData[]).filter(p => p.id !== playerId)
    const updatedVotes = (data.play_again_votes || []).filter((id: string) =>
      players.some(p => p.id === id)
    )
    const nextGuest = data.guest_id && players.some(p => p.id === data.guest_id)
      ? data.guest_id
      : players.find(p => p.id !== data.host_id)?.id || null

    await supabase
      .from('multiplayer_rooms')
      .update({ players, guest_id: nextGuest, play_again_votes: updatedVotes })
      .eq('id', roomId)
      .eq('updated_at', data.updated_at)
  }

  useEffect(() => {
    // No need for local auth - using centralized auth store
    fetchRoom()
  }, [fetchRoom])

  useEffect(() => {
    if (!roomId || !userId) return

    touchPresence()
    const interval = setInterval(() => {
      touchPresence()
    }, HEARTBEAT_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [roomId, userId, touchPresence])

  useEffect(() => {
    if (!autoRemoveInactive || !isHost || !roomId || roomStatus !== 'finished') return

    pruneInactivePlayers()
    const interval = setInterval(() => {
      pruneInactivePlayers()
    }, 10000)

    return () => clearInterval(interval)
  }, [autoRemoveInactive, isHost, roomId, roomStatus, pruneInactivePlayers])

  useEffect(() => {
    const handleReconnect = () => {
      if (document.visibilityState === 'visible') {
        fetchRoom()
      }
    }

    const handleOnline = () => {
      fetchRoom()
    }

    document.addEventListener('visibilitychange', handleReconnect)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleReconnect)
      window.removeEventListener('online', handleOnline)
    }
  }, [fetchRoom])

  // Real-time subscription for play again votes
  useEffect(() => {
    if (!roomCode) return

    const channel = supabase
      .channel(`results:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'multiplayer_rooms',
          filter: `code=eq.${roomCode}`,
        },
        (payload) => {
          const updatedRoom = payload.new as Room

          setRoom(updatedRoom)
          const previousStatus = lastStatusRef.current
          lastStatusRef.current = updatedRoom.status
          
          // Track play again votes
          if (updatedRoom.play_again_votes) {
            setPlayAgainVotes(updatedRoom.play_again_votes)
          }

          // If room was reset to playing, redirect all players to game
          if (
            updatedRoom.status === 'playing' &&
            previousStatus === 'finished' &&
            !redirectingRef.current
          ) {
            redirectingRef.current = true
            router.push(`/multiplayer/game?code=${roomCode}`)
          }
        }
      )
      .subscribe((status) => {
        const isConnected = status === 'SUBSCRIBED'
        setConnected(isConnected)
        if (isConnected) {
          fetchRoom()
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomCode, router, fetchRoom])

  useEffect(() => {
    if (!room || !userId) return
    if (!room.players?.some(p => p.id === userId)) {
      if (!leavingRef.current) {
        const now = Date.now()
        const lastSeen = lastSeenRef.current
        const wasInactive = typeof lastSeen === 'number' && now - lastSeen > INACTIVE_TIMEOUT_MS
        const notice = wasInactive
          ? 'You were removed from the room due to inactivity.'
          : 'You were removed from the room by the host.'
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('garu:mpExitNotice', notice)
        }
      }
      router.push('/multiplayer')
    }
  }, [room?.players, userId, router])

  // Check if all players have voted to play again → reset room
  useEffect(() => {
    if (!room || !user || playAgainVotes.length === 0) return
    
    const totalPlayers = room.players?.length || 0
    if (playAgainVotes.length >= totalPlayers && totalPlayers > 0) {
      // All players voted — host resets the room
      if (user.id === room.host_id && !redirectingRef.current) {
        const resetRoom = async () => {
          redirectingRef.current = true
          // Reset the room: generate new questions and restart with same settings
          const questions = await generateQuestions(room.game_type, room.question_count)
          const resetPlayers = room.players.map(p => ({
            id: p.id,
            score: 0,
            answers: [],
            finished: false,
            username: profiles[p.id]?.username || '',
            last_seen: Date.now(),
          }))

          await supabase
            .from('multiplayer_rooms')
            .update({
              status: 'playing',
              questions,
              current_question: 0,
              play_again_votes: [],
              players: resetPlayers,
            })
            .eq('id', room.id)

          // Host navigates directly into the new game
          router.push(`/multiplayer/game?code=${roomCode}`)
        }
        resetRoom()
      }
      // Non-host players will be redirected via real-time when status changes to 'playing'
    }
  }, [playAgainVotes, room, user, profiles, roomCode, router])

  const playAgain = async () => {
    if (!room || !user || hasVoted) return

    // Verify session
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) {
      router.push('/multiplayer')
      return
    }

    setHasVoted(true)

    // Re-fetch current votes from DB to avoid race conditions
    const { data: freshRoom } = await supabase
      .from('multiplayer_rooms')
      .select('play_again_votes')
      .eq('id', room.id)
      .single()

    const currentVotes: string[] = (freshRoom?.play_again_votes as string[]) || []
    if (!currentVotes.includes(user.id)) {
      const newVotes = [...currentVotes, user.id]
      setPlayAgainVotes(newVotes)

      await supabase
        .from('multiplayer_rooms')
        .update({ play_again_votes: newVotes })
        .eq('id', room.id)
    }
  }

  const backToMenu = () => {
    leavingRef.current = true
    router.push('/multiplayer')
  }

  if (loading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BasketballLoader size="lg" text="Loading results..." />
      </div>
    )
  }

  if (room.status !== 'finished') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BasketballLoader size="lg" text="Waiting for others..." />
      </div>
    )
  }

  const sortedPlayers = [...(room.players || [])].sort((a, b) => b.score - a.score)
  const winner = sortedPlayers[0]
  const isTie = sortedPlayers.length >= 2 && sortedPlayers[0]?.score === sortedPlayers[1]?.score
  const isWinner = user && winner?.id === user.id

  // Get wrong answers for current user
  const myAnswers = room.players?.find(p => p.id === user?.id)?.answers || []
  const wrongAnswers = myAnswers.filter(a => !a.correct)
  const wrongQuestions = wrongAnswers.map(wa => {
    const question = room.questions.find(q => q.id === wa.questionId)
    return { ...question, userAnswer: wa.answer }
  })

  return (
    <div className="min-h-screen py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            {isTie ? (
              <HandshakeIcon className="text-electric-lime" size={36} />
            ) : isWinner ? (
              <TrophyIcon className="text-electric-lime" size={36} />
            ) : (
              <SadFaceIcon className="text-hot-pink" size={36} />
            )}
            <h1 className="text-3xl font-bold">
              {isTie ? "It's a Tie!" : isWinner ? 'You Won!' : 'You Lost!'}
            </h1>
          </div>
          <p className="text-muted">
            {room.game_type === 'the-journey' ? 'The Journey' : "Who's That Role Player"}
          </p>
          {!connected && (
            <p className="text-xs text-muted mt-2">Reconnecting...</p>
          )}
        </motion.div>

        {/* Score Cards */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className={`grid gap-4 mb-8 ${
            sortedPlayers.length <= 2 ? 'grid-cols-2' : 
            sortedPlayers.length === 3 ? 'grid-cols-3' : 
            'grid-cols-2 sm:grid-cols-3'
          }`}
        >
          {sortedPlayers.map((player, index) => {
            const profile = profiles[player.id]
            const isCurrentUser = player.id === user?.id
            const correctCount = player.answers.filter(a => a.correct).length
            const ordinal = index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}th`

            return (
              <div
                key={player.id}
                className={`glass rounded-2xl p-4 text-center ${
                  index === 0 && !isTie ? 'ring-2 ring-electric-lime' : ''
                } ${isCurrentUser ? 'bg-gunmetal/80' : ''}`}
              >
                {index === 0 && !isTie ? (
                  <div className="flex justify-center mb-2">
                    <CrownIcon className="text-electric-lime" size={28} />
                  </div>
                ) : (
                  <p className="text-xs text-muted mb-2">{ordinal}</p>
                )}
                <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-electric-lime to-blue-500 flex items-center justify-center text-2xl font-bold">
                      {profile?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-lg mb-1">
                  {profile?.username || 'Unknown'}
                  {isCurrentUser && <span className="text-muted text-sm"> (You)</span>}
                </h3>
                {isHost && player.id !== hostId && (
                  <button
                    onClick={() => handleKickPlayer(player.id)}
                    className="mt-1 text-xs px-2 py-1 rounded-lg border border-hot-pink/40 text-hot-pink hover:bg-hot-pink/10 transition-colors"
                  >
                    Kick
                  </button>
                )}
                <p className="text-3xl font-bold text-electric-lime mb-2">
                  {player.score}
                </p>
                <p className="text-sm text-muted">
                  {correctCount}/{room.question_count} correct
                </p>
              </div>
            )
          })}
        </motion.div>

        {/* Wrong Answers Section */}
        {wrongQuestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <h2 className="text-xl font-bold mb-4">Questions You Missed</h2>
            <div className="space-y-3">
              {wrongQuestions.map((q, index) => (
                <div key={index} className="glass rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    {room.game_type === 'the-journey' ? (
                      <div className="flex items-center gap-1">
                        {q?.teams?.slice(0, 3).map((team, i) => (
                          <div key={i} className="w-8 h-8">
                            <TeamLogo team={team} size={32} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gunmetal overflow-hidden">
                        <img
                          src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${q?.playerId}.png`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-bold text-electric-lime">
                        {room.game_type === 'the-journey' ? q?.answer : q?.name}
                      </p>
                      <p className="text-sm text-muted">
                        Your answer: <span className="text-hot-pink">{q?.userAnswer || '(no answer)'}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Stats Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl p-4 mb-8"
        >
          <h2 className="text-lg font-bold mb-4">Your Stats</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-electric-lime">
                {myAnswers.filter(a => a.correct).length}
              </p>
              <p className="text-xs text-muted">Correct</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-hot-pink">
                {wrongAnswers.length}
              </p>
              <p className="text-xs text-muted">Wrong</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {myAnswers.length > 0 
                  ? (myAnswers.reduce((sum, a) => sum + a.timeTaken, 0) / myAnswers.length).toFixed(1)
                  : '0'
                }s
              </p>
              <p className="text-xs text-muted">Avg Time</p>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-3"
        >
          {isHost && (
            <div className="flex items-center justify-between gap-4 p-4 bg-surface/50 rounded-xl">
              <div>
                <p className="text-sm font-semibold">Auto-remove inactive players</p>
                <p className="text-xs text-muted">Removes idle players after ~90s</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoRemoveInactive}
                onClick={() => setAutoRemoveInactive(prev => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoRemoveInactive ? 'bg-electric-lime/70' : 'bg-surface'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoRemoveInactive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
          <button
            onClick={playAgain}
            disabled={hasVoted}
            className={`w-full py-4 font-bold rounded-xl transition-colors ${
              hasVoted 
                ? 'bg-electric-lime/50 text-gunmetal cursor-default' 
                : 'bg-electric-lime text-gunmetal hover:bg-green-400'
            }`}
          >
            {hasVoted 
              ? `Play Again (${playAgainVotes.length}/${room.players?.length || 0}) — Waiting...`
              : playAgainVotes.length > 0
                ? `Play Again (${playAgainVotes.length}/${room.players?.length || 0})`
                : 'Play Again'
            }
          </button>
          <button
            onClick={backToMenu}
            className="w-full py-4 bg-surface text-ghost-white font-bold rounded-xl hover:bg-gunmetal transition-colors"
          >
            Back to Menu
          </button>
        </motion.div>
      </div>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <BasketballLoader size="lg" text="Loading..." />
      </div>
    }>
      <ResultsContent />
    </Suspense>
  )
}

// Generate questions based on game type
async function generateQuestions(gameType: string, count: number): Promise<any[]> {
  if (gameType === 'whos-that') {
    const { data: players } = await supabase
      .from('cached_players')
      .select('player_id, full_name, team_abbreviation, position, season_stats')

    if (!players || players.length === 0) {
      return Array.from({ length: count }, (_, i) => ({
        id: i,
        playerId: 203999,
        name: 'Nikola Jokic',
        team: 'DEN',
        position: 'C',
        stats: { pts: 26.4, reb: 12.4, ast: 9.0 },
      }))
    }

    const rolePlayers = players.filter(p => {
      const pts = p.season_stats?.pts || 0
      return pts >= 8 && pts <= 20
    })

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
    try {
      const response = await Promise.race([
        api.getJourneyPlayers(Math.max(count * 2, 30), 2),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Journey API timeout')), 8000)
        ),
      ])

      if (response?.players && response.players.length > 0) {
        const shuffled = [...response.players].sort(() => Math.random() - 0.5)
        return shuffled.slice(0, count).map((p, i) => ({
          id: i,
          teams: p.teams,
          answer: p.name,
          playerId: p.id,
        }))
      }
    } catch (err) {
      console.error('[Results] Failed to fetch journey players from API, using fallback:', err)
    }

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
