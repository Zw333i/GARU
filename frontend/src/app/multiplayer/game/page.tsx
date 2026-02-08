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
  const [answers, setAnswers] = useState<PlayerData['answers']>([])
  const [showResult, setShowResult] = useState(false)
  const [questionStartTime, setQuestionStartTime] = useState<number>(0)
  const [connected, setConnected] = useState(false)

  // Ref to avoid stale closure in timer
  const answeredRef = React.useRef(answered)
  answeredRef.current = answered

  // Ref for auto-advance timer so Enter key can cancel it
  const autoAdvanceTimerRef = React.useRef<number | null>(null)

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
    setCurrentQ(data.current_question || 0)
    setTimeLeft(data.timer_duration)
    setQuestionStartTime(Date.now())
    setLoading(false)
  }, [roomCode, router])

  useEffect(() => {
    // No need for local auth - using centralized auth store
    fetchRoom()
  }, [fetchRoom])

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
        setConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomCode, router])

  // Polling fallback for game status changes
  useEffect(() => {
    if (!roomCode || !room) return

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('multiplayer_rooms')
        .select('status, players')
        .eq('code', roomCode)
        .single()

      if (data?.status === 'finished') {
        router.push(`/multiplayer/results?code=${roomCode}`)
      }
      if (data?.players) {
        setRoom(prev => prev ? { ...prev, players: data.players } : prev)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [roomCode, room?.id, router])

  // Timer countdown
  useEffect(() => {
    if (loading || !room || answered || showResult) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          // Use timeout to avoid calling handleSubmit during render
          setTimeout(() => {
            if (!answeredRef.current) handleSubmit(true)
          }, 0)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, room, answered, showResult, currentQ])

  const handleSubmit = async (timeout = false) => {
    if (answered || !room || !user) return

    const question = room.questions[currentQ]
    const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000)
    
    let correct = false
    const answerToCheck = room.game_type === 'the-journey' ? question.answer : question.name

    if (!timeout && guess.trim()) {
      correct = checkGuess(guess, answerToCheck || '')
    }

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
      correct ? sounds.correct() : sounds.wrong()
    }

    // Update player score in database
    const updatedPlayers = room.players.map(p => {
      if (p.id === user.id) {
        return {
          ...p,
          score: p.score + pointsEarned,
          answers: [...p.answers, newAnswer],
        }
      }
      return p
    })

    await supabase
      .from('multiplayer_rooms')
      .update({ players: updatedPlayers })
      .eq('id', room.id)

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
    setShowResult(false)
    setTimeLeft(room.timer_duration)
    setQuestionStartTime(Date.now())

    // Update current question in database (host only)
    if (user?.id === room.host_id) {
      await supabase
        .from('multiplayer_rooms')
        .update({ current_question: nextQ })
        .eq('id', room.id)
    }
  }

  const finishGame = async () => {
    if (!room || !user) return

    // Mark game as finished (host only)
    if (user.id === room.host_id) {
      await supabase
        .from('multiplayer_rooms')
        .update({ status: 'finished' })
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
          </div>
          <div className="flex items-center gap-4">
            <div className="text-lg font-bold text-electric-lime">
              {score} pts
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${
              timeLeft <= 5 ? 'bg-hot-pink text-white animate-pulse' : 'bg-surface'
            }`}>
              {timeLeft}
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
          className="glass rounded-2xl p-6 mb-6"
        >
          {isJourney ? (
            // The Journey - Show team logos
            <div>
              <h2 className="text-lg font-bold text-center mb-6">
                Guess the player from their career path
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
                Draft team → Current team
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
                {isCorrect ? <><CheckIcon size={24} /> Correct!</> : <><XIcon size={24} /> Wrong!</>}
              </p>
              <p className="text-lg">
                {isJourney ? question.answer : question.name}
              </p>
              {isCorrect && (
                <p className="text-sm text-electric-lime mt-2">
                  +{100 + Math.floor((timeLeft / room.timer_duration) * 50)} points!
                </p>
              )}
              <p className="text-xs text-muted mt-3 animate-pulse">Press Enter to continue</p>
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
