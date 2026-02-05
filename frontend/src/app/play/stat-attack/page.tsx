'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { 
  LightningIcon, 
  TargetIcon, 
  FireIcon, 
  CheckIcon, 
  XIcon, 
  TrophyIcon,
  ArrowLeftIcon,
  ArrowRightIcon
} from '@/components/icons'
import { sounds } from '@/lib/sounds'
import { useSettingsStore } from '@/store/settingsStore'
import { useKeyboardControls } from '@/hooks/useKeyboardControls'
import { supabase, saveGameScore } from '@/lib/supabase'
import { BasketballLoader } from '@/components/ui/BasketballLoader'
import { usePlayersStore, CachedPlayer } from '@/store/playersStore'

// Stats to guess
const statCategories = [
  { key: 'pts', label: 'PTS', unit: 'Per game' },
  { key: 'reb', label: 'REB', unit: 'Per game' },
  { key: 'ast', label: 'AST', unit: 'Per game' },
  { key: 'fg_pct', label: 'FG%', unit: 'Percentage' },
  { key: 'fg3_pct', label: '3P%', unit: 'Percentage' },
]

interface StatPlayer {
  id: number
  name: string
  stats: Record<string, number>
}

interface Round {
  player: StatPlayer
  stat: typeof statCategories[0]
  userGuess: number | null
  actualValue: number
  difference: number | null
}

// Convert cached player to StatPlayer
function toStatPlayer(player: CachedPlayer): StatPlayer {
  return {
    id: player.id,
    name: player.name,
    stats: {
      pts: player.ppg || 0,
      reb: player.rpg || 0,
      ast: player.apg || 0,
      fg_pct: player.fg_pct || 0,
      fg3_pct: player.fg3_pct || 0,
    }
  }
}

// Fallback players
const FALLBACK_PLAYERS: StatPlayer[] = [
  { id: 203999, name: 'Nikola Jokic', stats: { pts: 26.4, reb: 12.4, ast: 9.0, fg_pct: 58.3, fg3_pct: 35.9 } },
  { id: 1629029, name: 'Luka Doncic', stats: { pts: 32.4, reb: 8.6, ast: 8.0, fg_pct: 48.7, fg3_pct: 38.2 } },
  { id: 203507, name: 'Giannis Antetokounmpo', stats: { pts: 30.4, reb: 11.5, ast: 6.5, fg_pct: 61.1, fg3_pct: 27.4 } },
  { id: 1628369, name: 'Jayson Tatum', stats: { pts: 26.9, reb: 8.1, ast: 4.9, fg_pct: 47.1, fg3_pct: 37.6 } },
  { id: 201939, name: 'Stephen Curry', stats: { pts: 26.4, reb: 4.5, ast: 5.1, fg_pct: 45.0, fg3_pct: 40.8 } },
  { id: 2544, name: 'LeBron James', stats: { pts: 25.7, reb: 7.3, ast: 8.3, fg_pct: 54.0, fg3_pct: 41.0 } },
  { id: 1628983, name: 'Shai Gilgeous-Alexander', stats: { pts: 31.1, reb: 5.5, ast: 6.2, fg_pct: 53.5, fg3_pct: 35.3 } },
  { id: 203954, name: 'Joel Embiid', stats: { pts: 33.1, reb: 10.2, ast: 4.2, fg_pct: 52.9, fg3_pct: 38.8 } },
]

export default function StatAttackPage() {
  const { soundEnabled } = useSettingsStore()
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Use session-cached players
  const { players: cachedPlayers, isLoaded, isLoading: playersLoading, fetchPlayers, getRandomPlayers } = usePlayersStore()
  
  const [players, setPlayers] = useState<StatPlayer[]>(FALLBACK_PLAYERS)
  const [loading, setLoading] = useState(true)
  const [round, setRound] = useState(1)
  const [maxRounds] = useState(5)
  const [currentPlayer, setCurrentPlayer] = useState<StatPlayer | null>(null)
  const [currentStat, setCurrentStat] = useState(statCategories[0])
  const [userGuess, setUserGuess] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [rounds, setRounds] = useState<Round[]>([])
  const [gameOver, setGameOver] = useState(false)
  const [usedPlayers, setUsedPlayers] = useState<number[]>([])
  const [correctCount, setCorrectCount] = useState(0)
  const [gameStartTime, setGameStartTime] = useState(Date.now())

  // Save score when game ends
  const saveScore = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const duration = Math.floor((Date.now() - gameStartTime) / 1000)
        await saveGameScore({
          user_id: user.id,
          game_type: 'stat-attack',
          score: score,
          correct_answers: correctCount,
          questions_answered: maxRounds,
          time_taken: duration
        })
      }
    } catch (err) {
      console.error('Error saving score:', err)
    }
  }

  // Load players from session cache
  useEffect(() => {
    if (!isLoaded && !playersLoading) {
      fetchPlayers()
    }
  }, [isLoaded, playersLoading, fetchPlayers])

  // Convert cached players to game format
  useEffect(() => {
    if (isLoaded && cachedPlayers.length > 0) {
      // Get random players from cache
      const randomPlayers = getRandomPlayers(20, 10)
      if (randomPlayers.length > 0) {
        setPlayers(randomPlayers.map(toStatPlayer))
      }
      setLoading(false)
    }
  }, [isLoaded, cachedPlayers, getRandomPlayers])

  // Initialize first round when players load
  useEffect(() => {
    if (players.length > 0 && !currentPlayer) {
      initRound()
    }
  }, [players])

  // Keyboard controls: Enter = submit first, then next
  useKeyboardControls({
    onEnter: () => {
      if (gameOver) {
        restartGame()
      } else if (showResult) {
        // Answer shown, Enter = next
        nextRound()
      } else if (userGuess) {
        // Answer not shown, Enter = submit
        handleSubmit()
      }
    },
    enabled: true,
  })

  const initRound = () => {
    // Get unused player
    const available = players.filter(p => !usedPlayers.includes(p.id))
    const randomPlayer = available.length > 0 
      ? available[Math.floor(Math.random() * available.length)]
      : players[Math.floor(Math.random() * players.length)]
    
    const randomStat = statCategories[Math.floor(Math.random() * statCategories.length)]
    
    setCurrentPlayer(randomPlayer)
    setCurrentStat(randomStat)
    setUsedPlayers(prev => [...prev, randomPlayer.id])
    setUserGuess('')
    setShowResult(false)
    
    // Focus input
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleSubmit = () => {
    if (!currentPlayer || !userGuess) return

    const guess = parseFloat(userGuess)
    const actual = currentPlayer.stats[currentStat.key] || 0
    const difference = Math.abs(guess - actual)
    
    // Calculate points (max 100, minus difference)
    const points = Math.max(0, 100 - Math.round(difference * 5))
    setScore(prev => prev + points)

    const roundData: Round = {
      player: currentPlayer,
      stat: currentStat,
      userGuess: guess,
      actualValue: actual,
      difference
    }
    setRounds(prev => [...prev, roundData])
    setShowResult(true)
    
    // Close guess counts as correct (within 2)
    if (difference < 2) {
      setCorrectCount(prev => prev + 1)
      if (soundEnabled) sounds.correct()
    } else {
      if (soundEnabled) sounds.wrong()
    }
  }

  const nextRound = () => {
    if (round >= maxRounds) {
      setGameOver(true)
      saveScore()
      if (soundEnabled) sounds.victory()
    } else {
      setRound(prev => prev + 1)
      initRound()
      if (soundEnabled) sounds.click()
    }
  }

  const restartGame = () => {
    setRound(1)
    setScore(0)
    setRounds([])
    setUsedPlayers([])
    setGameOver(false)
    setCorrectCount(0)
    setGameStartTime(Date.now())
    initRound()
    if (soundEnabled) sounds.click()
  }

  const getAccuracyIcon = (diff: number) => {
    if (diff < 0.5) return <TargetIcon size={48} className="text-electric-lime" />
    if (diff < 2) return <FireIcon size={48} className="text-orange-400" />
    if (diff < 5) return <CheckIcon size={48} className="text-green-400" />
    if (diff < 10) return <XIcon size={48} className="text-yellow-400" />
    return <XIcon size={48} className="text-hot-pink" />
  }

  const getAccuracyLabel = (diff: number) => {
    if (diff < 0.5) return 'PERFECT!'
    if (diff < 2) return 'So close!'
    if (diff < 5) return 'Good guess!'
    if (diff < 10) return 'Not bad'
    return 'Way off!'
  }

  // Loading state with basketball loader animation
  if (loading && !currentPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BasketballLoader size="lg" text="Loading players..." />
      </div>
    )
  }

  if (!currentPlayer) return null

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/play" className="text-muted hover:text-ghost-white transition-colors flex items-center gap-1">
          <ArrowLeftIcon size={16} /> Back to Play
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-muted">Round {round}/{maxRounds}</span>
          <span className="text-electric-lime font-bold">{score} pts</span>
        </div>
      </div>

      {!gameOver ? (
        <>
          <motion.div
            key={round}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto"
          >
            <h1 className="text-3xl font-display font-bold text-center mb-2 flex items-center justify-center gap-2">
              Stat Attack <LightningIcon size={28} className="text-yellow-400" />
            </h1>
            <p className="text-muted text-center mb-8">
              Guess the player&apos;s stat as close as possible!
            </p>

            {/* Player Card */}
            <div className="glass rounded-2xl p-6 text-center mb-6">
              <div className="w-24 h-24 mx-auto rounded-full bg-surface overflow-hidden mb-4">
                <img
                  src={`https://cdn.nba.com/headshots/nba/latest/260x190/${currentPlayer.id}.png`}
                  alt={currentPlayer.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <h2 className="text-2xl font-bold mb-4">{currentPlayer.name}</h2>
              
              <div className="bg-surface rounded-xl p-4">
                <p className="text-muted text-sm mb-2">What is their average:</p>
                <p className="text-4xl font-display font-bold text-electric-lime">
                  {currentStat.label}
                </p>
                <p className="text-muted text-xs mt-2">
                  ({currentStat.unit})
                </p>
              </div>
            </div>

            {/* Input */}
            {!showResult ? (
              <div className="space-y-4">
                <input
                  ref={inputRef}
                  type="number"
                  step="0.1"
                  value={userGuess}
                  onChange={(e) => setUserGuess(e.target.value)}
                  placeholder="Enter your guess..."
                  className="w-full px-6 py-4 bg-surface border border-gunmetal rounded-xl text-ghost-white text-center text-2xl font-bold focus:border-electric-lime outline-none"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!userGuess}
                  className="w-full py-4 bg-electric-lime text-deep-void font-bold rounded-xl disabled:opacity-50"
                >
                  Submit Guess
                </button>
              </div>
            ) : (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass rounded-2xl p-6 text-center"
                >
                  <div className="flex justify-center mb-4">
                    {getAccuracyIcon(rounds[rounds.length - 1]?.difference || 0)}
                  </div>
                  <p className={`text-2xl font-bold mb-4 ${
                    (rounds[rounds.length - 1]?.difference || 0) < 2 ? 'text-electric-lime' : 'text-hot-pink'
                  }`}>
                    {getAccuracyLabel(rounds[rounds.length - 1]?.difference || 0)}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-surface rounded-lg p-3">
                      <p className="text-muted text-xs">Your Guess</p>
                      <p className="text-xl font-bold">{userGuess}</p>
                    </div>
                    <div className="bg-surface rounded-lg p-3">
                      <p className="text-muted text-xs">Actual</p>
                      <p className="text-xl font-bold text-electric-lime">
                        {currentPlayer.stats[currentStat.key]?.toFixed(1)}
                      </p>
                    </div>
                  </div>

                  <p className="text-muted mb-4">
                    Off by {rounds[rounds.length - 1]?.difference?.toFixed(1)}
                  </p>

                  <button
                    onClick={nextRound}
                    className="w-full py-3 bg-electric-lime text-deep-void font-bold rounded-xl flex items-center justify-center gap-2"
                  >
                    {round >= maxRounds ? 'See Results' : 'Next Round'}
                    <ArrowRightIcon size={20} />
                  </button>
                </motion.div>
              </AnimatePresence>
            )}
          </motion.div>

          {/* Progress bar */}
          <div className="fixed bottom-24 left-0 right-0 px-4">
            <div className="max-w-lg mx-auto">
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-electric-lime"
                  initial={{ width: 0 }}
                  animate={{ width: `${(round / maxRounds) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg mx-auto glass rounded-2xl p-8 text-center"
        >
          <h2 className="text-3xl font-display font-bold mb-4">Game Complete!</h2>
          <p className="text-5xl font-display font-bold text-electric-lime mb-2">
            {score} points
          </p>
          <p className="text-muted mb-6">{correctCount}/{maxRounds} close guesses</p>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-surface rounded-xl p-4">
              <p className="text-muted text-sm mb-1">Accuracy</p>
              <p className="text-2xl font-bold text-electric-lime">
                {maxRounds > 0 ? Math.round((correctCount / maxRounds) * 100) : 0}%
              </p>
            </div>
            <div className="bg-surface rounded-xl p-4">
              <p className="text-muted text-sm mb-1">Avg Time</p>
              <p className="text-2xl font-bold">
                {gameStartTime > 0 ? Math.round((Date.now() - gameStartTime) / 1000 / maxRounds) : 0}s
              </p>
            </div>
          </div>

          <p className="text-muted mb-6">
            {score >= 400 ? '🏆 Stat Master!' : 
             score >= 250 ? '🌟 Great knowledge!' : 
             score >= 100 ? '📚 Keep studying those stats!' : 
             '💪 Practice makes perfect!'}
          </p>

          {/* Round breakdown */}
          <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
            {rounds.map((r, i) => (
              <div key={i} className="bg-surface rounded-lg p-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6">{getAccuracyIcon(r.difference || 0)}</div>
                  <span className="font-medium">{r.player.name}</span>
                </div>
                <div className="text-right text-xs">
                  <span className="text-muted">{r.stat.label}: </span>
                  <span className={r.difference! < 2 ? 'text-electric-lime' : 'text-muted'}>
                    {r.userGuess} → {r.actualValue.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={restartGame}
              className="flex-1 py-3 bg-electric-lime text-deep-void font-bold rounded-xl"
            >
              Play Again
            </button>
            <Link
              href="/play"
              className="flex-1 py-3 bg-surface text-ghost-white font-bold rounded-xl text-center"
            >
              Back to Games
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  )
}
