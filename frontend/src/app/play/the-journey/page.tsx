'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { sounds } from '@/lib/sounds'
import { useSettingsStore } from '@/store/settingsStore'
import { useKeyboardControls } from '@/hooks/useKeyboardControls'
import { useJourneyPlayers } from '@/hooks/useJourneyPlayers'
import { TeamLogo } from '@/components/icons/TeamLogos'
import { PlayerImage } from '@/components/ui/PlayerImage'
import { BasketballLoader } from '@/components/ui/BasketballLoader'
import { JourneyIcon, CheckIcon, XIcon, ArrowRightIcon, ArrowLeftIcon } from '@/components/icons'
import { supabase, saveGameScore } from '@/lib/supabase'
import { useSessionDataStore } from '@/store/sessionDataStore'
import { JourneyPlayer } from '@/lib/api'
import { checkGuess } from '@/lib/nameMatch'

export default function JourneyPage() {
  const { soundEnabled } = useSettingsStore()
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Use database hook for journey players
  const { players, loading, error, getRandomPlayer } = useJourneyPlayers(50, 3)
  
  const [currentPlayer, setCurrentPlayer] = useState<JourneyPlayer | null>(null)
  const [guess, setGuess] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(1)
  const [visibleTeams, setVisibleTeams] = useState(1)
  const [gameOver, setGameOver] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [gameStartTime, setGameStartTime] = useState(Date.now())
  const [roundStartTime, setRoundStartTime] = useState(Date.now())
  const [answerTimes, setAnswerTimes] = useState<number[]>([])

  // Initialize first player when data loads
  useEffect(() => {
    if (players.length > 0 && !currentPlayer) {
      const player = getRandomPlayer()
      if (player) {
        setCurrentPlayer(player)
        setVisibleTeams(1)
        setRoundStartTime(Date.now()) // Start timing for first round
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    }
  }, [players, currentPlayer, getRandomPlayer])

  // Save score when game ends
  const saveScore = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const duration = Math.floor((Date.now() - gameStartTime) / 1000)
        await saveGameScore({
          user_id: user.id,
          game_type: 'the-journey',
          score: score,
          correct_answers: correctCount,
          questions_answered: 5,
          time_taken: duration
        })
        // Refresh session cache so profile/stats reflect new data
        await useSessionDataStore.getState().refreshStats()
      }
    } catch (err) {
      console.error('Error saving score:', err)
    }
  }

  // Keyboard controls: Enter = submit/next
  useKeyboardControls({
    onEnter: () => {
      if (gameOver) {
        window.location.reload()
      } else if (revealed) {
        nextRound()
      } else if (guess) {
        handleGuess()
      }
    },
    enabled: true,
  })

  useEffect(() => {
    // Animate teams appearing one by one
    if (currentPlayer && !revealed && visibleTeams < currentPlayer.teams.length) {
      const timer = setTimeout(() => {
        setVisibleTeams(v => v + 1)
        if (soundEnabled) sounds.reveal()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [visibleTeams, currentPlayer, revealed, soundEnabled])

  const handleGuess = () => {
    if (!currentPlayer) return
    
    // Track time taken for this answer
    const timeTaken = Math.round((Date.now() - roundStartTime) / 1000)
    setAnswerTimes(prev => [...prev, timeTaken])
    
    const correct = checkGuess(guess, currentPlayer.name)
    setIsCorrect(correct)
    if (correct) {
      setScore(prev => prev + 100)
      setCorrectCount(prev => prev + 1)
      if (soundEnabled) sounds.correct()
    } else {
      if (soundEnabled) sounds.wrong()
    }
    // Set guess to correct answer after reveal so it shows in the result
    setGuess(currentPlayer.name)
    setRevealed(true)
  }

  const nextRound = () => {
    if (round >= 5) {
      setGameOver(true)
      saveScore()
      if (soundEnabled) sounds.victory()
      return
    }
    
    const player = getRandomPlayer()
    if (player) {
      setCurrentPlayer(player)
      setGuess('')
      setRevealed(false)
      setIsCorrect(false)
      setVisibleTeams(1)
      setRound(round + 1)
      setRoundStartTime(Date.now()) // Reset timer for new round
      if (soundEnabled) sounds.click()
      // Focus input for next round
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const restartGame = () => {
    const player = getRandomPlayer()
    if (player) {
      setCurrentPlayer(player)
      setGuess('')
      setRevealed(false)
      setIsCorrect(false)
      setVisibleTeams(1)
      setRound(1)
      setScore(0)
      setGameOver(false)
      setCorrectCount(0)
      setGameStartTime(Date.now())
      setRoundStartTime(Date.now())
      setAnswerTimes([])
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BasketballLoader size="lg" text="Loading journeys..." />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
          <XIcon className="text-hot-pink mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold mb-2">Failed to Load</h2>
          <p className="text-muted mb-4">{error}</p>
          <Link 
            href="/play" 
            className="px-6 py-3 bg-electric-lime text-deep-void font-bold rounded-xl inline-block"
          >
            Back to Games
          </Link>
        </div>
      </div>
    )
  }

  // No current player yet
  if (!currentPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BasketballLoader size="lg" text="Setting up game..." />
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
          <span className="text-muted">Round {round}/5</span>
          <span className="text-electric-lime font-bold">{score} pts</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-center mb-2 flex items-center justify-center gap-3">
          <JourneyIcon className="text-blue-400" size={32} />
          The Journey
        </h1>
        <p className="text-center text-muted mb-2">
          Guess which player took this career path
        </p>
        <p className="text-center text-xs text-muted/70 mb-8">
          Draft team → Current team 
        </p>

        {!gameOver ? (
          <motion.div className="glass rounded-2xl p-6 md:p-8">
            {/* Team Path with SVG Logos */}
            <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap mb-6">
              {currentPlayer.teams.map((team, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0, rotateY: 180 }}
                  animate={{ 
                    opacity: i < visibleTeams ? 1 : 0.2, 
                    scale: i < visibleTeams ? 1 : 0.7,
                    rotateY: i < visibleTeams ? 0 : 180
                  }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="flex items-center"
                >
                  <div className={`w-14 h-14 md:w-16 md:h-16 rounded-xl bg-gunmetal border-2 flex items-center justify-center overflow-hidden ${
                    i === 0 ? 'border-electric-lime' : i === currentPlayer.teams.length - 1 ? 'border-blue-400' : 'border-surface'
                  }`}>
                    <TeamLogo team={team} size={40} />
                  </div>
                  {i < currentPlayer.teams.length - 1 && (
                    <ArrowRightIcon className="text-muted mx-1 md:mx-2" size={16} />
                  )}
                </motion.div>
              ))}
            </div>

            {/* Team Labels */}
            <div className="flex justify-center gap-2 md:gap-4 mb-6 text-xs">
              {currentPlayer.teams.slice(0, visibleTeams).map((team, i) => (
                <motion.span 
                  key={i} 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`px-2 py-1 rounded ${
                    i === 0 ? 'bg-electric-lime/20 text-electric-lime' : 
                    i === visibleTeams - 1 && visibleTeams === currentPlayer.teams.length ? 'bg-blue-400/20 text-blue-400' : 
                    'bg-surface text-muted'
                  }`}
                >
                  {team} {i === 0 && '(Draft)'}
                </motion.span>
              ))}
            </div>

            {/* Guess Input or Result */}
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
                    placeholder="Type your guess..."
                    className="w-full px-4 py-3 bg-gunmetal border border-surface rounded-xl text-ghost-white placeholder-muted focus:outline-none focus:border-electric-lime transition-colors"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                  <button
                    onClick={handleGuess}
                    disabled={!guess || guess.length < 2}
                    className="w-full py-3 bg-electric-lime text-deep-void font-bold rounded-xl hover:bg-green-400 transition-colors disabled:opacity-50"
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
                        {isCorrect ? 'Correct!' : 'Wrong!'}
                      </p>
                    </div>
                    <p className="text-ghost-white mt-1">
                      It was <span className="font-bold">{currentPlayer.name}</span>
                    </p>
                  </div>

                  {/* Show player image after reveal */}
                  <div className="flex justify-center">
                    <div className="w-24 h-24 rounded-full bg-surface overflow-hidden border-2 border-electric-lime">
                      <PlayerImage
                        playerId={currentPlayer.id}
                        playerName={currentPlayer.name}
                        size="lg"
                        className="w-full h-full"
                      />
                    </div>
                  </div>

                  <button
                    onClick={nextRound}
                    className="w-full py-3 bg-surface text-ghost-white font-bold rounded-xl hover:bg-muted/30 transition-colors flex items-center justify-center gap-2"
                  >
                    {round >= 5 ? 'See Results' : 'Next Journey'}
                    <ArrowRightIcon size={20} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* Game Over Screen */
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-8 text-center"
          >
            <h2 className="text-3xl font-display font-bold mb-4">Game Complete!</h2>
            <p className="text-5xl font-display font-bold text-electric-lime mb-2">{score} points</p>
            <p className="text-muted mb-6">{correctCount}/5 correct</p>
            
            {/* Stats Summary */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-surface rounded-xl p-4">
                <p className="text-muted text-sm mb-1">Accuracy</p>
                <p className="text-2xl font-bold text-electric-lime">
                  {Math.round((correctCount / 5) * 100)}%
                </p>
              </div>
              <div className="bg-surface rounded-xl p-4">
                <p className="text-muted text-sm mb-1">Avg Time</p>
                <p className="text-2xl font-bold">
                  {answerTimes.length > 0 ? Math.round(answerTimes.reduce((a, b) => a + b, 0) / answerTimes.length) : 0}s
                </p>
              </div>
            </div>

            <p className="text-muted mb-8">
              {score >= 400 ? 'Ball Knower #Wowzers' : 
               score >= 300 ? 'Great knowledge!' : 
               score >= 200 ? 'Casual?' : 
               'Keep practicing!'}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={restartGame}
                className="px-8 py-3 bg-electric-lime text-deep-void font-bold rounded-xl"
              >
                Play Again
              </button>
              <Link
                href="/play"
                className="px-8 py-3 bg-surface text-ghost-white font-bold rounded-xl"
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
