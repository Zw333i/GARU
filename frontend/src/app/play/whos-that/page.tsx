'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { sounds } from '@/lib/sounds'
import { useSettingsStore } from '@/store/settingsStore'
import { useKeyboardControls } from '@/hooks/useKeyboardControls'
import { useRolePlayers, FALLBACK_ROLE_PLAYERS, GamePlayer } from '@/hooks/useGamePlayers'
import { supabase, saveGameScore, incrementRolePlayerGuesses } from '@/lib/supabase'
import { SearchIcon, CheckIcon, XIcon, ArrowRightIcon, ArrowLeftIcon } from '@/components/icons'
import { BasketballLoader } from '@/components/ui/BasketballLoader'
import { useSessionDataStore } from '@/store/sessionDataStore'
import { checkGuess } from '@/lib/nameMatch'

// Timer icon component
const TimerIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
)

// Question count options
const QUESTION_OPTIONS = [5, 10, 30] as const
type QuestionCount = typeof QUESTION_OPTIONS[number]

// Timer duration per question (in seconds)
const TIMER_DURATION = 15

export default function WhosThatPage() {
  const { soundEnabled } = useSettingsStore()
  const { players: supabasePlayers, loading, error } = useRolePlayers(50)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Use Supabase players or fallback
  const allPlayers = supabasePlayers.length > 0 ? supabasePlayers : FALLBACK_ROLE_PLAYERS
  
  // Game setup state
  const [gameStarted, setGameStarted] = useState(false)
  const [questionCount, setQuestionCount] = useState<QuestionCount>(5)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION)
  
  const [currentPlayer, setCurrentPlayer] = useState<GamePlayer | null>(null)
  const [guess, setGuess] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(1)
  const [usedPlayers, setUsedPlayers] = useState<number[]>([])
  const [revealedHints, setRevealedHints] = useState(1)
  const [gameOver, setGameOver] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [gameStartTime, setGameStartTime] = useState<number>(0)


  const hints = currentPlayer ? [
    `Plays for the ${currentPlayer.team}`,
    `Averages ${currentPlayer.ppg.toFixed(1)} PPG`,
    `Position: ${currentPlayer.position}`,
  ] : []

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  // Timer logic
  useEffect(() => {
    if (!gameStarted || !timerEnabled || revealed || gameOver) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up!
          clearInterval(timerRef.current!)
          timerRef.current = null
          handleTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [gameStarted, timerEnabled, revealed, gameOver, round])

  const handleTimeUp = useCallback(() => {
    if (!currentPlayer || revealed) return
    setTimedOut(true)
    setIsCorrect(false)
    setRevealed(true)
    if (soundEnabled) sounds.wrong()
  }, [currentPlayer, revealed, soundEnabled])

  // Initialize first player when game starts
  useEffect(() => {
    if (gameStarted && allPlayers.length > 0 && !currentPlayer) {
      const player = allPlayers[Math.floor(Math.random() * allPlayers.length)]
      setCurrentPlayer(player)
      setUsedPlayers([player.id])
      setTimeLeft(TIMER_DURATION)
    }
  }, [gameStarted, allPlayers, currentPlayer])

  const startGame = () => {
    const player = allPlayers[Math.floor(Math.random() * allPlayers.length)]
    setCurrentPlayer(player)
    setUsedPlayers([player.id])
    setGameStarted(true)
    setTimeLeft(TIMER_DURATION)
    setGameStartTime(Date.now())
    setCorrectCount(0)
    if (soundEnabled) sounds.click()
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // Keyboard controls: Enter = submit first, then next
  useKeyboardControls({
    onEnter: () => {
      if (!gameStarted || gameOver) return
      
      if (revealed) {
        // Answer shown, Enter = next
        nextRound()
      } else if (guess.trim()) {
        // Answer not shown, Enter = submit (only if there's input)
        handleGuess()
      }
    },
    onSpace: () => {
      // Space = reveal hint (only when not answered yet)
      if (gameStarted && !revealed && !gameOver && revealedHints < 3) {
        revealHint()
      }
    },
    enabled: true,
  })

  const getRandomPlayer = () => {
    const available = allPlayers.filter(p => !usedPlayers.includes(p.id))
    if (available.length === 0) {
      // Reset pool but exclude current player
      const filtered = allPlayers.filter(p => p.id !== currentPlayer?.id)
      return filtered[Math.floor(Math.random() * filtered.length)]
    }
    return available[Math.floor(Math.random() * available.length)]
  }

  const handleGuess = () => {
    if (!currentPlayer || !guess.trim()) return
    
    const correct = checkGuess(guess, currentPlayer.name)
    setIsCorrect(correct)
    setTimedOut(false)
    
    if (correct) {
      // Bonus points for faster answers when timer is enabled
      let points = 100 - (revealedHints - 1) * 20
      if (timerEnabled) {
        // Add time bonus: up to 50 extra points based on remaining time
        const timeBonus = Math.floor((timeLeft / TIMER_DURATION) * 50)
        points += timeBonus
      }
      setScore(prev => prev + points)
      setCorrectCount(prev => prev + 1)
      if (soundEnabled) sounds.correct()
    } else {
      if (soundEnabled) sounds.wrong()
    }
    setRevealed(true)
  }

  // Save game score to database
  const saveScore = async (finalScore: number, finalCorrect: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const timeTaken = Math.floor((Date.now() - gameStartTime) / 1000)
        await saveGameScore({
          user_id: user.id,
          game_type: 'whos-that',
          score: finalScore,
          questions_answered: questionCount,
          correct_answers: finalCorrect,
          time_taken: timeTaken,
        })
        // Track role player achievement
        if (finalCorrect > 0) {
          await incrementRolePlayerGuesses(user.id, finalCorrect)
        }
        // Refresh session cache so profile/stats reflect new data
        await useSessionDataStore.getState().refreshStats()
      }
    } catch (err) {
      console.warn('Failed to save score:', err)
    }
  }

  const nextRound = () => {
    if (round >= questionCount) {
      setGameOver(true)
      if (soundEnabled) sounds.victory()
      // Save score when game ends — correctCount already updated by handleGuess
      saveScore(score, correctCount)
      return
    }
    
    const player = getRandomPlayer()
    setCurrentPlayer(player)
    setUsedPlayers(prev => [...prev, player.id])
    setGuess('')
    setRevealed(false)
    setIsCorrect(false)
    setRevealedHints(1)
    setRound(round + 1)
    setTimeLeft(TIMER_DURATION)
    setTimedOut(false)
    if (soundEnabled) sounds.click()
    
    // Focus input for next round
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const revealHint = () => {
    if (revealedHints < 3) {
      setRevealedHints(revealedHints + 1)
      if (soundEnabled) sounds.reveal()
    }
  }

  const resetGame = () => {
    setCurrentPlayer(null)
    setUsedPlayers([])
    setGuess('')
    setRevealed(false)
    setIsCorrect(false)
    setRevealedHints(1)
    setRound(1)
    setScore(0)
    setGameOver(false)
    setGameStarted(false)
    setTimeLeft(TIMER_DURATION)
    setTimedOut(false)
    setCorrectCount(0)
    setGameStartTime(0)
    if (soundEnabled) sounds.click()
  }

  // Loading state with basketball loader animation
  if (loading && supabasePlayers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BasketballLoader size="lg" text="Loading players..." />
      </div>
    )
  }

  // Game setup screen
  if (!gameStarted) {
    return (
      <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
        <div className="flex items-center justify-between mb-6">
          <Link href="/play" className="flex items-center gap-2 text-muted hover:text-ghost-white transition-colors">
            <ArrowLeftIcon size={20} />
            <span>Back to Games</span>
          </Link>
        </div>

        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-8"
          >
            <div className="text-center mb-8">
              <SearchIcon className="text-electric-lime mx-auto mb-4" size={48} />
              <h1 className="text-3xl font-display font-bold mb-2">Who&apos;s That Player?</h1>
              <p className="text-muted">Guess NBA players based on hints</p>
            </div>

            {/* Question count selection */}
            <div className="mb-6">
              <label className="block text-sm text-muted uppercase tracking-wide mb-3">
                Number of Questions
              </label>
              <div className="grid grid-cols-3 gap-3">
                {QUESTION_OPTIONS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setQuestionCount(count)}
                    className={`py-3 px-4 rounded-xl font-bold transition-all ${
                      questionCount === count
                        ? 'bg-electric-lime text-deep-void'
                        : 'bg-gunmetal text-ghost-white hover:bg-surface'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Timer toggle */}
            <div className="mb-8">
              <label className="block text-sm text-muted uppercase tracking-wide mb-3">
                Timer Mode
              </label>
              <button
                onClick={() => setTimerEnabled(!timerEnabled)}
                className={`w-full py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 ${
                  timerEnabled
                    ? 'bg-hot-pink text-ghost-white'
                    : 'bg-gunmetal text-ghost-white hover:bg-surface'
                }`}
              >
                <TimerIcon size={20} />
                {timerEnabled ? `Timer ON (${TIMER_DURATION}s per question)` : 'Timer OFF (No time limit)'}
              </button>
              {timerEnabled && (
                <p className="text-xs text-muted mt-2 text-center">
                  Answer faster for bonus points!
                </p>
              )}
            </div>

            {/* Start button */}
            <button
              onClick={startGame}
              className="w-full py-4 bg-electric-lime text-deep-void font-bold text-lg rounded-xl hover:bg-green-400 transition-colors"
            >
              Start Game
            </button>
          </motion.div>
        </div>
      </div>
    )
  }

  if (!currentPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">No players available</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/play" className="flex items-center gap-2 text-muted hover:text-ghost-white transition-colors">
          <ArrowLeftIcon size={20} />
          <span>Back to Games</span>
        </Link>
        <div className="flex items-center gap-4">
          {/* Timer display */}
          {timerEnabled && !revealed && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
              timeLeft <= 5 ? 'bg-hot-pink/20 text-hot-pink animate-pulse' : 'bg-surface text-ghost-white'
            }`}>
              <TimerIcon size={16} />
              <span className="font-bold tabular-nums">{timeLeft}s</span>
            </div>
          )}
          <span className="text-muted">Round {round}/{questionCount}</span>
          <span className="text-electric-lime font-bold">{score} pts</span>
        </div>
      </div>

      {/* Data source indicator */}
      {error && (
        <div className="max-w-2xl mx-auto mb-4 text-center text-xs text-muted">
          Using offline player data
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {!gameOver ? (
          <>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-center mb-8 flex items-center justify-center gap-3">
              <SearchIcon className="text-electric-lime" size={32} />
              Who&apos;s That Player?
            </h1>

            {/* Game Card */}
        <motion.div layout className="glass rounded-2xl p-6 md:p-8">
          {/* Player Image */}
          <div className="relative w-48 h-48 mx-auto mb-6">
            <div className="w-full h-full rounded-2xl bg-gunmetal overflow-hidden border-4 border-surface">
              <img
                src={`https://cdn.nba.com/headshots/nba/latest/260x190/${currentPlayer.id}.png`}
                alt="Mystery Player"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${currentPlayer.id}.png`
                }}
              />
            </div>
          </div>

          {/* Hints */}
          <div className="space-y-2 mb-6">
            <h3 className="text-sm text-muted uppercase tracking-wide">Hints</h3>
            {hints.slice(0, revealedHints).map((hint, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-ghost-white bg-gunmetal px-4 py-2 rounded-lg"
              >
                {hint}
              </motion.p>
            ))}
            {!revealed && revealedHints < 3 && (
              <button
                onClick={revealHint}
                className="text-sm text-electric-lime hover:underline"
              >
                Reveal another hint (-20 pts) [Space]
              </button>
            )}
          </div>

          {/* Input or Result */}
          <AnimatePresence mode="wait">
            {!revealed ? (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder="Type player name..."
                  className="w-full px-4 py-3 bg-gunmetal border border-surface rounded-xl text-ghost-white placeholder-muted focus:outline-none focus:border-electric-lime transition-colors"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                
                <button
                  onClick={handleGuess}
                  disabled={guess.trim().length < 2}
                  className="w-full py-3 bg-electric-lime text-deep-void font-bold rounded-xl hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Guess
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className={`p-4 rounded-xl text-center ${
                  isCorrect
                    ? 'bg-electric-lime/20 border border-electric-lime'
                    : 'bg-hot-pink/20 border border-hot-pink'
                }`}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {isCorrect ? (
                      <CheckIcon className="text-electric-lime" size={28} />
                    ) : (
                      <XIcon className="text-hot-pink" size={28} />
                    )}
                    <p className={`text-xl font-bold ${isCorrect ? 'text-electric-lime' : 'text-hot-pink'}`}>
                      {isCorrect ? 'Correct!' : timedOut ? "Time's Up!" : 'Wrong!'}
                    </p>
                  </div>
                  <p className="text-ghost-white mt-1">
                    It was <span className="font-bold">{currentPlayer.name}</span>
                  </p>
                </div>

                <button
                  onClick={nextRound}
                  className="w-full py-3 bg-surface text-ghost-white font-bold rounded-xl hover:bg-muted/30 transition-colors flex items-center justify-center gap-2"
                >
                  {round >= questionCount ? 'See Results' : 'Next Player'}
                  <ArrowRightIcon size={20} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
          </>
        ) : (
          /* Game Over Screen */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-8 text-center"
          >
            <h2 className="text-3xl font-display font-bold mb-4">Game Complete!</h2>
            <p className="text-5xl font-display font-bold text-electric-lime mb-2">{score} points</p>
            <p className="text-muted mb-6">
              {correctCount}/{questionCount} correct{timerEnabled ? ' • Timer mode' : ''}
            </p>
            
            {/* Stats Summary */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-surface rounded-xl p-4">
                <p className="text-muted text-sm mb-1">Accuracy</p>
                <p className="text-2xl font-bold text-electric-lime">
                  {questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0}%
                </p>
              </div>
              <div className="bg-surface rounded-xl p-4">
                <p className="text-muted text-sm mb-1">Avg Time</p>
                <p className="text-2xl font-bold">
                  {gameStartTime > 0 ? Math.round((Date.now() - gameStartTime) / 1000 / questionCount) : 0}s
                </p>
              </div>
            </div>

            <p className="text-muted mb-6">
              {score >= questionCount * 80 ? 'Ball Knower!' : 
               score >= questionCount * 50 ? 'Great job! Keep practicing!' : 
               score >= questionCount * 30 ? 'Casual? hmmm...' : 
               'Keep at it! Practice makes perfect!'}
            </p>
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={resetGame}
                className="px-6 py-3 bg-electric-lime text-deep-void font-bold rounded-xl"
              >
                Play Again
              </button>
              <Link
                href="/play"
                className="px-6 py-3 bg-surface text-ghost-white font-bold rounded-xl"
              >
                Back to Games
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
