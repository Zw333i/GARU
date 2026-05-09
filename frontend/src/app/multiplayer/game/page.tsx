'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { TeamLogo } from '@/components/icons/TeamLogos'
import { CheckIcon, XIcon } from '@/components/icons'
import { BasketballLoader } from '@/components/ui/BasketballLoader'
import { sounds } from '@/lib/sounds'
import { useSettingsStore } from '@/store/settingsStore'
import { checkGuess } from '@/lib/nameMatch'

interface Question {
  id: number
  playerId: number
  name: string
  team?: string
  position?: string
  stats?: { pts: number; reb: number; ast: number }
  teams?: string[]
  answer?: string
}

interface PlayerData {
  id: string
  score: number
  answers: { questionId: number; answer: string; correct: boolean; timeTaken: number }[]
  finished?: boolean
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
  updated_at?: string
}

const ROOM_FETCH_RETRIES = 6

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function GameContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomCode = searchParams.get('code')
  const { soundEnabled } = useSettingsStore()

  // Use centralized auth store
  const { user } = useAuthStore()
  
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentQ, setCurrentQ] = useState(0)
  const [guess, setGuess] = useState('')
  const [answered, setAnswered] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [score, setScore] = useState(0)
  const [correctStreak, setCorrectStreak] = useState(0)
  const [answers, setAnswers] = useState<PlayerData['answers']>([])
  const [showResult, setShowResult] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [questionStartTime, setQuestionStartTime] = useState<number>(0)
  const [connected, setConnected] = useState(false)
  const initializedRef = React.useRef(false)
  const timerEndRef = React.useRef<number | null>(null)

  // Ref to avoid stale closure in timer
  const answeredRef = React.useRef(answered)
  answeredRef.current = answered

  // Ref for auto-advance timer so Enter key can cancel it
  const autoAdvanceTimerRef = React.useRef<number | null>(null)
  const warningPlayedRef = React.useRef(false)
  const warmupDoneRef = React.useRef(false)

  // Global keyboard handler for Enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return

      // If showing result, advance to next question immediately
      if (showResult && room) {
        e.preventDefault()
        // Cancel auto-advance timer
        if (autoAdvanceTimerRef.current) {
          clearTimeout(autoAdvanceTimerRef.current)
          autoAdvanceTimerRef.current = null
        }
        if (currentQ < room.questions.length - 1) {
          nextQuestion()
        } else {
          finishGame()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResult, room, currentQ])

  // Fetch room
  const fetchRoom = useCallback(async () => {
    if (!roomCode) return

    for (let attempt = 1; attempt <= ROOM_FETCH_RETRIES; attempt++) {
      const { data, error } = await supabase
        .from('multiplayer_rooms')
        .select('*')
        .eq('code', roomCode)
        .maybeSingle()

      if (data) {
        setRoom(data as Room)
        if (!initializedRef.current) {
          setCurrentQ(0)
          setTimeLeft(data.timer_duration)
          setQuestionStartTime(Date.now())
          timerEndRef.current = Date.now() + data.timer_duration * 1000
          warningPlayedRef.current = false
          setLoading(false)
          initializedRef.current = true
        }
        return
      }

      if (error) {
        console.warn('[Game] Initial fetch failed:', error)
      }

      if (attempt < ROOM_FETCH_RETRIES) {
        await sleep(300)
      }
    }

    router.push('/multiplayer')
  }, [roomCode, router])

  useEffect(() => {
    // No need for local auth - using centralized auth store
    fetchRoom()
  }, [fetchRoom])

  useEffect(() => {
    const handleWarmUp = () => {
      if (warmupDoneRef.current) return
      warmupDoneRef.current = true
      void sounds.warmUp()
    }

    window.addEventListener('pointerdown', handleWarmUp)
    window.addEventListener('keydown', handleWarmUp)

    return () => {
      window.removeEventListener('pointerdown', handleWarmUp)
      window.removeEventListener('keydown', handleWarmUp)
    }
  }, [])

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

  useEffect(() => {
    if (!soundEnabled || !room || room.status !== 'playing') return
    sounds.startGameMusicLoop()
    return () => {
      sounds.stopGameMusicLoop()
    }
  }, [soundEnabled, room?.id, room?.status])

  // Real-time subscription for game updates
  useEffect(() => {
    if (!roomCode) return

    const channel = supabase
      .channel(`game:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'multiplayer_rooms',
          filter: `code=eq.${roomCode}`,
        },
        (payload) => {
          const newRoom = payload.new as Room
          setRoom(newRoom)

          if (newRoom.status === 'finished') {
            router.push(`/multiplayer/results?code=${roomCode}`)
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

  // Preload multiple upcoming questions' images for instant display
  useEffect(() => {
    if (room && room.game_type === 'who-that') {
      // Preload all questions' images
      room.questions.forEach(q => {
        if (q?.playerId) {
          const img = new Image()
          img.src = `https://cdn.nba.com/headshots/nba/latest/1040x760/${q.playerId}.png`
        }
      })
    }
  }, [room?.id])

  // Timer countdown
  useEffect(() => {
    if (loading || !room || answered || showResult) return

    if (!timerEndRef.current) {
      timerEndRef.current = Date.now() + room.timer_duration * 1000
    }

    const tick = () => {
      const remainingMs = Math.max(0, (timerEndRef.current || 0) - Date.now())
      const next = Math.ceil(remainingMs / 1000)

      setTimeLeft((prev) => (prev === next ? prev : next))

      if (next <= 5 && next > 0 && !warningPlayedRef.current && soundEnabled) {
        warningPlayedRef.current = true
        sounds.warning()
      }

      if (next <= 0) {
        // Use timeout to avoid calling handleSubmit during render
        setTimeout(() => {
          if (!answeredRef.current) handleSubmit(true)
        }, 0)
      }
    }

    const timer = window.setInterval(tick, 200)
    tick()

    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, room, answered, showResult, currentQ, soundEnabled])

  const handleSubmit = async (timeout = false) => {
    if (answered || !room || !user) return

    const question = room.questions[currentQ]
    const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000)
    
    let correct = false
    const answerToCheck = room.game_type === 'the-journey' ? question.answer : question.name

    if (!timeout && guess.trim()) {
      correct = checkGuess(guess, answerToCheck || '')
    }

    setTimedOut(timeout)
    setAnswered(true)
    setIsCorrect(correct)
    setShowResult(true)

    // Calculate points (bonus for speed)
    const basePoints = correct ? 100 : 0
    const speedBonus = correct ? Math.floor((timeLeft / room.timer_duration) * 50) : 0
    const pointsEarned = basePoints + speedBonus

    setScore((prev) => prev + pointsEarned)

    const newAnswer = {
      questionId: question.id,
      answer: guess,
      correct,
      timeTaken,
    }
    setAnswers((prev) => [...prev, newAnswer])

    // Play sound
    if (soundEnabled) {
      if (correct) {
        const nextStreak = correctStreak + 1
        setCorrectStreak(nextStreak)
        sounds.gameCorrect(nextStreak, currentQ >= room.questions.length - 1)
      } else {
        setCorrectStreak(0)
        sounds.gameWrong()
      }
    } else if (correct) {
      setCorrectStreak((prev) => prev + 1)
    } else {
      setCorrectStreak(0)
    }

    // Update score with optimistic concurrency to reduce overwrite races for 2-5 players.
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: freshRoom, error: freshRoomError } = await supabase
        .from('multiplayer_rooms')
        .select('players, updated_at')
        .eq('id', room.id)
        .single()

      if (freshRoomError || !freshRoom) {
        break
      }

      const players = (freshRoom.players || []) as PlayerData[]
      const updatedPlayers = players.map(p => {
        if (p.id === user.id) {
          return {
            ...p,
            score: p.score + pointsEarned,
            answers: [...(p.answers || []), newAnswer],
          }
        }
        return p
      })

      const { data: writeResult, error: writeError } = await supabase
        .from('multiplayer_rooms')
        .update({ players: updatedPlayers })
        .eq('id', room.id)
        .eq('updated_at', freshRoom.updated_at)
        .select('id, players, updated_at')
        .maybeSingle()

      if (writeError) {
        break
      }

      if (writeResult) {
        setRoom(prev => prev ? {
          ...prev,
          players: writeResult.players as PlayerData[],
          updated_at: writeResult.updated_at as string,
        } : prev)
        break
      }
    }

    // Set up for manual advance via Enter key (auto-advance after 5s as fallback)
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      if (currentQ < room.questions.length - 1) {
        nextQuestion()
      } else {
        finishGame()
      }
    }, 5000)
  }

  const nextQuestion = async () => {
    if (!room) return

    const nextQ = currentQ + 1
    setCurrentQ(nextQ)
    setGuess('')
    setAnswered(false)
    setIsCorrect(null)
    setTimedOut(false)
    setShowResult(false)
    setTimeLeft(room.timer_duration)
    setQuestionStartTime(Date.now())
    timerEndRef.current = Date.now() + room.timer_duration * 1000
    warningPlayedRef.current = false

  }

  const finishGame = async () => {
    if (!room || !user) return

    sounds.stopGameMusicLoop()

    // Update this player's finished flag, and complete the room when all players are done.
    const { data: freshRoom } = await supabase
      .from('multiplayer_rooms')
      .select('players')
      .eq('id', room.id)
      .single()

    if (freshRoom?.players) {
      const updatedPlayers = (freshRoom.players as PlayerData[]).map((p) =>
        p.id === user.id ? { ...p, finished: true } : p
      )

      const allFinished = updatedPlayers.every((p) =>
        (p.answers?.length || 0) >= room.questions.length || p.finished
      )

      await supabase
        .from('multiplayer_rooms')
        .update({
          players: updatedPlayers,
          status: allFinished ? 'finished' : room.status,
        })
        .eq('id', room.id)
    }

    router.push(`/multiplayer/results?code=${roomCode}`)
  }

  if (loading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BasketballLoader size="lg" text="Loading game..." />
      </div>
    )
  }

  const question = room.questions[currentQ]
  const isJourney = room.game_type === 'the-journey'

  return (
    <div className="min-h-screen py-4 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
            <span className="text-sm text-muted">
              Question {currentQ + 1}/{room.questions.length}
            </span>
            {!connected && (
              <span className="text-xs text-muted">Reconnecting...</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-lg font-bold text-electric-lime">
              {score} pts
            </div>
            <div className="flex flex-col items-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${
                timeLeft <= 5 ? 'bg-hot-pink text-white animate-pulse' : 'bg-surface'
              }`}>
                {timeLeft}
              </div>
              {!connected && (
                <span className="text-[10px] text-muted mt-1">Syncing timer...</span>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-surface rounded-full mb-6 overflow-hidden">
          <motion.div
            className="h-full bg-electric-lime"
            initial={{ width: '100%' }}
            animate={{ width: `${(timeLeft / room.timer_duration) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Question Content */}
        <motion.div
          key={currentQ}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          className="card-neon rounded-2xl p-8 mb-6"
        >
          {isJourney ? (
            // The Journey - Show team logos
            <div>
              <h2 className="text-lg font-bold text-center mb-6">
                <span>THE </span>
                <span className="text-electric-lime">JOURNEY</span>
              </h2>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {question.teams?.map((team, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-16 h-16 bg-surface rounded-xl flex items-center justify-center">
                      <TeamLogo team={team} size={48} />
                    </div>
                    {i < (question.teams?.length || 0) - 1 && (
                      <span className="text-muted text-2xl">→</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-center text-muted text-sm mt-4">
                First team → Current team
              </p>
            </div>
          ) : (
            // Who's That - Show blurred image + stats
            <div>
              <h2 className="text-lg font-bold text-center mb-4">
                Name this player!
              </h2>
              
              <div className="flex justify-center mb-4">
                <div 
                  className="w-40 h-40 rounded-2xl bg-gunmetal overflow-hidden"
                >
                  <img
                    src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${question.playerId}.png`}
                    alt="NBA Player"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-surface rounded-xl p-3">
                  <p className="text-2xl font-bold">{question.stats?.pts.toFixed(1)}</p>
                  <p className="text-xs text-muted">PPG</p>
                </div>
                <div className="bg-surface rounded-xl p-3">
                  <p className="text-2xl font-bold">{question.stats?.reb.toFixed(1)}</p>
                  <p className="text-xs text-muted">RPG</p>
                </div>
                <div className="bg-surface rounded-xl p-3">
                  <p className="text-2xl font-bold">{question.stats?.ast.toFixed(1)}</p>
                  <p className="text-xs text-muted">APG</p>
                </div>
              </div>

              <p className="text-center text-muted text-sm mt-3">
                {question.team} • {question.position}
              </p>
            </div>
          )}
        </motion.div>

        {/* Answer Input */}
        <AnimatePresence mode="wait">
          {!showResult ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-3"
            >
              <input
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="Type player name..."
                className="w-full px-4 py-4 bg-gunmetal border border-surface rounded-xl text-ghost-white placeholder-muted focus:outline-none focus:border-electric-lime transition-colors text-lg"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                autoComplete="off"
                autoFocus
              />
              <button
                onClick={() => handleSubmit()}
                className="w-full py-4 bg-electric-lime text-gunmetal font-bold rounded-xl hover:bg-green-400 transition-colors"
              >
                Submit
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-6 rounded-2xl text-center ${
                isCorrect 
                  ? 'bg-electric-lime/20 border-2 border-electric-lime' 
                  : 'bg-hot-pink/20 border-2 border-hot-pink'
              }`}
            >
              <p className={`text-2xl font-bold mb-2 flex items-center justify-center gap-2 ${isCorrect ? 'text-electric-lime' : 'text-hot-pink'}`}>
                {isCorrect ? <><CheckIcon size={24} /> Correct!</> : <><XIcon size={24} /> {timedOut ? "Time's Up!" : 'Wrong!'}</>}
              </p>
              <p className="text-lg">
                {isJourney ? question.answer : question.name}
              </p>
              {isCorrect && (
                <p className="text-sm text-electric-lime mt-2">
                  +{100 + Math.floor((timeLeft / room.timer_duration) * 50)} points!
                </p>
              )}
              <p className="text-xs text-muted mt-3 animate-pulse">
                Press Enter to continue
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <BasketballLoader size="lg" text="Loading..." />
      </div>
    }>
      <GameContent />
    </Suspense>
  )
}
