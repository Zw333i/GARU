'use client'

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { saveGameScore } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useSessionDataStore } from '@/store/sessionDataStore'
import { TeamLogo } from '@/components/icons/TeamLogos'
import confetti from 'canvas-confetti'
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
  guest_id: string
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

function ResultsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomCode = searchParams.get('code')

  // Use centralized auth store
  const { user } = useAuthStore()
  
  const [room, setRoom] = useState<Room | null>(null)
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({})
  const [loading, setLoading] = useState(true)
  const [statsSaved, setStatsSaved] = useState(false)
  const [playAgainVotes, setPlayAgainVotes] = useState<string[]>([])
  const [hasVoted, setHasVoted] = useState(false)
  const redirectingRef = useRef(false)

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
            user_id: currentUser.id,
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
  }, [roomCode, router, statsSaved])

  useEffect(() => {
    // No need for local auth - using centralized auth store
    fetchRoom()
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
          
          // Track play again votes
          if (updatedRoom.play_again_votes) {
            setPlayAgainVotes(updatedRoom.play_again_votes)
          }

          // If room was reset to waiting, redirect all players to lobby
          if (updatedRoom.status === 'waiting' && !redirectingRef.current) {
            redirectingRef.current = true
            router.push(`/multiplayer/lobby?code=${roomCode}`)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomCode, router])

  // Polling fallback for play again votes
  useEffect(() => {
    if (!roomCode || !room) return

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('multiplayer_rooms')
        .select('play_again_votes, status')
        .eq('code', roomCode)
        .single()

      if (data) {
        if (data.play_again_votes) {
          setPlayAgainVotes(data.play_again_votes)
        }
        if (data.status === 'waiting' && !redirectingRef.current) {
          redirectingRef.current = true
          router.push(`/multiplayer/lobby?code=${roomCode}`)
        }
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [roomCode, room?.id, router])

  // Check if all players have voted to play again → reset room
  useEffect(() => {
    if (!room || !user || playAgainVotes.length === 0) return
    
    const totalPlayers = room.players?.length || 0
    if (playAgainVotes.length >= totalPlayers && totalPlayers > 0) {
      // All players voted — host resets the room
      if (user.id === room.host_id && !redirectingRef.current) {
        const resetRoom = async () => {
          redirectingRef.current = true
          // Reset the room: clear questions, scores, and set status back to waiting
          const resetPlayers = room.players.map(p => ({
            id: p.id,
            score: 0,
            answers: [],
            username: profiles[p.id]?.username || '',
          }))

          await supabase
            .from('multiplayer_rooms')
            .update({
              status: 'waiting',
              questions: null,
              current_question: 0,
              play_again_votes: [],
              players: resetPlayers,
            })
            .eq('id', room.id)

          // Host navigates to lobby
          router.push(`/multiplayer/lobby?code=${roomCode}&host=true`)
        }
        resetRoom()
      }
      // Non-host players will be redirected via real-time/polling when status changes to 'waiting'
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
    router.push('/multiplayer')
  }

  if (loading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BasketballLoader size="lg" text="Loading results..." />
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
