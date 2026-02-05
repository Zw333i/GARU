'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { CompareIcon, ArrowLeftIcon, ArrowRightIcon } from '@/components/icons'
import { sounds } from '@/lib/sounds'
import { useSettingsStore } from '@/store/settingsStore'
import { useKeyboardControls } from '@/hooks/useKeyboardControls'
import { useStarPlayers, FALLBACK_STAR_PLAYERS, GamePlayer } from '@/hooks/useGamePlayers'
import { supabase, saveGameScore } from '@/lib/supabase'
import { BasketballLoader } from '@/components/ui/BasketballLoader'

// Silhouette image URL
const SILHOUETTE_URL = 'https://th.bing.com/th/id/R.2855dc2b9d9f849e227dbe9f73642b27?rik=%2bcUVqCXHhW1S%2bA&riu=http%3a%2f%2fgetdrawings.com%2fimg%2fmale-silhouette-head-31.png&ehk=yxlY0knr%2bEmdM%2baGFVqzo0zaLgigbwObIl%2bXINZzWJ0%3d&risl=&pid=ImgRaw&r=0'

interface Comparison {
  playerA: GamePlayer
  playerB: GamePlayer
}

// Generate matchups with SIMILAR statlines for harder comparisons
function generateMatchups(players: GamePlayer[], count: number = 5): Comparison[] {
  if (players.length < 2) return []
  
  // Calculate total stats for each player
  const playersWithTotal = players.map(p => ({
    player: p,
    total: p.ppg + p.rpg + p.apg
  }))
  
  // Sort by total stats
  playersWithTotal.sort((a, b) => b.total - a.total)
  
  const matchups: Comparison[] = []
  const usedIndices = new Set<number>()
  
  // Find pairs with similar stats (within 5 points of combined stats)
  for (let i = 0; i < playersWithTotal.length && matchups.length < count; i++) {
    if (usedIndices.has(i)) continue
    
    // Find a similar player
    for (let j = i + 1; j < playersWithTotal.length; j++) {
      if (usedIndices.has(j)) continue
      
      const diff = Math.abs(playersWithTotal[i].total - playersWithTotal[j].total)
      
      // Match players within 5 combined stat points for close matchups
      if (diff <= 5) {
        matchups.push({
          playerA: playersWithTotal[i].player,
          playerB: playersWithTotal[j].player,
        })
        usedIndices.add(i)
        usedIndices.add(j)
        break
      }
    }
  }
  
  // If we don't have enough close matchups, add random pairs
  if (matchups.length < count) {
    const remaining = playersWithTotal
      .filter((_, i) => !usedIndices.has(i))
      .sort(() => Math.random() - 0.5)
    
    for (let i = 0; i < remaining.length - 1 && matchups.length < count; i += 2) {
      matchups.push({
        playerA: remaining[i].player,
        playerB: remaining[i + 1].player,
      })
    }
  }
  
  // Shuffle final matchups order
  return matchups.sort(() => Math.random() - 0.5)
}

export default function BlindComparisonPage() {
  const { soundEnabled } = useSettingsStore()
  const { players: supabasePlayers, loading, error } = useStarPlayers(15)
  
  // Use Supabase players or fallback
  const allPlayers = supabasePlayers.length >= 2 ? supabasePlayers : FALLBACK_STAR_PLAYERS
  
  const [matchups, setMatchups] = useState<Comparison[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<'A' | 'B' | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [gameStartTime, setGameStartTime] = useState(0)
  
  const currentComparison = matchups[currentIndex]
  const round = currentIndex + 1

  // Save score when game ends
  const saveScore = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const duration = Math.floor((Date.now() - gameStartTime) / 1000)
        const isWin = score >= 300 // 3+ correct out of 5
        await saveGameScore({
          user_id: user.id,
          game_type: 'blind-comparison',
          score: score,
          correct_answers: correctCount,
          questions_answered: 5,
          time_taken: duration
        })
      }
    } catch (err) {
      console.error('Error saving score:', err)
    }
  }

  // Generate matchups when players load
  useEffect(() => {
    if (allPlayers.length >= 2) {
      setMatchups(generateMatchups(allPlayers, 5))
      setGameStartTime(Date.now())
    }
  }, [allPlayers])

  // Keyboard controls: Enter = submit selection when not revealed, next when revealed
  useKeyboardControls({
    onEnter: () => {
      if (gameOver) return
      if (revealed) {
        nextRound()
      }
      // If not revealed and no selection, do nothing (Enter is for next only after selection)
    },
    onArrowLeft: () => {
      if (!revealed && !gameOver) handleSelect('A')
    },
    onArrowRight: () => {
      if (!revealed && !gameOver) handleSelect('B')
    },
    onNumber: (num) => {
      if (!revealed && !gameOver) {
        if (num === 1) handleSelect('A')
        if (num === 2) handleSelect('B')
      }
    },
    enabled: true,
  })

  const handleSelect = (choice: 'A' | 'B') => {
    if (!currentComparison) return
    
    setSelected(choice)
    setRevealed(true)
    
    // Higher combined stats wins (PPG + RPG + APG)
    const aTotal = currentComparison.playerA.ppg + currentComparison.playerA.rpg + currentComparison.playerA.apg
    const bTotal = currentComparison.playerB.ppg + currentComparison.playerB.rpg + currentComparison.playerB.apg
    const winner = aTotal >= bTotal ? 'A' : 'B'
    
    if (choice === winner) {
      setScore(score + 100)
      setCorrectCount(prev => prev + 1)
      if (soundEnabled) sounds.correct()
    } else {
      if (soundEnabled) sounds.wrong()
    }
  }

  const nextRound = () => {
    if (currentIndex >= matchups.length - 1) {
      setGameOver(true)
      saveScore()
      if (soundEnabled) sounds.victory()
      return
    }
    
    setCurrentIndex(currentIndex + 1)
    setSelected(null)
    setRevealed(false)
    if (soundEnabled) sounds.click()
  }

  const resetGame = () => {
    setMatchups(generateMatchups(allPlayers, 5))
    setCurrentIndex(0)
    setSelected(null)
    setRevealed(false)
    setScore(0)
    setGameOver(false)
    setCorrectCount(0)
    setGameStartTime(Date.now())
    if (soundEnabled) sounds.click()
  }

  // Loading state
  if (loading && supabasePlayers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BasketballLoader size="lg" text="Loading players..." />
      </div>
    )
  }

  if (!currentComparison) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BasketballLoader size="md" text="Loading matchups..." />
      </div>
    )
  }

  const StatCard = ({ player, label, isRevealed }: { player: GamePlayer, label: string, isRevealed: boolean }) => (
    <motion.button
      whileHover={!revealed ? { scale: 1.02 } : {}}
      whileTap={!revealed ? { scale: 0.98 } : {}}
      onClick={() => !revealed && handleSelect(label as 'A' | 'B')}
      disabled={revealed}
      className={`flex-1 glass rounded-2xl p-6 transition-all ${
        !revealed ? 'hover:border-electric-lime cursor-pointer' : ''
      } ${
        revealed && selected === label
          ? 'border-2 border-electric-lime glow-lime'
          : 'border border-surface'
      }`}
    >
      {/* Player Image - Silhouette before reveal, actual image after */}
      <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden bg-gunmetal">
        {isRevealed ? (
          <motion.img
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.id}.png`}
            alt={player.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = SILHOUETTE_URL
            }}
          />
        ) : (
          <img
            src={SILHOUETTE_URL}
            alt="Mystery Player"
            className="w-full h-full object-contain p-2 invert opacity-50"
          />
        )}
      </div>

      <div className="text-center mb-4">
        <span className="text-3xl font-display font-bold">Player {label}</span>
        <span className="text-sm text-muted ml-2">[{label === 'A' ? '1 or ←' : '2 or →'}]</span>
        {isRevealed && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2"
          >
            <p className="font-bold text-lg text-electric-lime">{player.name}</p>
            <p className="text-sm text-muted">{player.team}</p>
          </motion.div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-surface">
          <span className="text-muted">PPG</span>
          <span className="font-bold text-xl">{player.ppg.toFixed(1)}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-surface">
          <span className="text-muted">RPG</span>
          <span className="font-bold text-xl">{player.rpg.toFixed(1)}</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-muted">APG</span>
          <span className="font-bold text-xl">{player.apg.toFixed(1)}</span>
        </div>
      </div>
    </motion.button>
  )

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/play" className="text-muted hover:text-ghost-white transition-colors flex items-center gap-1">
          <ArrowLeftIcon size={16} /> Back to Games
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-muted">Round {round}/{matchups.length}</span>
          <span className="text-electric-lime font-bold">{score} pts</span>
        </div>
      </div>

      {/* Data source indicator */}
      {error && (
        <div className="max-w-4xl mx-auto mb-4 text-center text-xs text-muted">
          Using offline player data
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-center mb-2 flex items-center justify-center gap-2">
          <CompareIcon size={28} className="text-hot-pink" /> Who Would You Rather Have?
        </h1>
        <p className="text-center text-muted mb-8">
          Two stat lines. No names. Pick your player!
        </p>

        {!gameOver ? (
          <>
            {/* Comparison Cards */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <StatCard player={currentComparison.playerA} label="A" isRevealed={revealed} />
              
              <div className="flex items-center justify-center">
                <span className="text-2xl font-bold text-muted">VS</span>
              </div>
              
              <StatCard player={currentComparison.playerB} label="B" isRevealed={revealed} />
            </div>

            {/* Result / Next */}
            <AnimatePresence>
              {revealed && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <p className="text-lg mb-4">
                    You picked{' '}
                    <span className="text-electric-lime font-bold">
                      {selected === 'A' ? currentComparison.playerA.name : currentComparison.playerB.name}
                    </span>
                  </p>
                  <button
                    onClick={nextRound}
                    className="px-8 py-3 bg-surface text-ghost-white font-bold rounded-xl hover:bg-muted/30 transition-colors flex items-center gap-2 mx-auto"
                  >
                    {currentIndex >= matchups.length - 1 ? 'See Results' : 'Next Comparison'}
                    <ArrowRightIcon size={20} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
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
                  {gameStartTime > 0 ? Math.round((Date.now() - gameStartTime) / 1000 / 5) : 0}s
                </p>
              </div>
            </div>

            <p className="text-muted mb-6">
              {score >= 400 ? '🏆 You know your stars!' : 
               score >= 300 ? '🌟 Great eye for talent!' :
               '📚 Keep studying those stats!'}
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
