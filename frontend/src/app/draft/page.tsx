'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useDraftStore } from '@/store/draftStore'
import { SwordsIcon, TrophyIcon, HeartIcon, ArrowLeftIcon, UsersIcon, BotIcon } from '@/components/icons'
import { sounds } from '@/lib/sounds'
import { useSettingsStore } from '@/store/settingsStore'
import { useKeyboardControls } from '@/hooks/useKeyboardControls'

// Mock player pools by position - CORRECT NBA PLAYER IDs for headshots
const playerPools = {
  PG: [
    { id: 1629029, name: 'Luka Doncic', team: 'DAL', rating: 96, pts: 32.4, reb: 8.6, ast: 8.0 },
    { id: 201939, name: 'Stephen Curry', team: 'GSW', rating: 95, pts: 26.4, reb: 4.5, ast: 5.1 },
    { id: 203081, name: 'Damian Lillard', team: 'MIL', rating: 91, pts: 24.3, reb: 4.4, ast: 7.3 },
    { id: 1628983, name: 'Shai Gilgeous-Alexander', team: 'OKC', rating: 93, pts: 31.1, reb: 5.5, ast: 6.2 },
    { id: 1630169, name: 'Tyrese Haliburton', team: 'IND', rating: 88, pts: 20.1, reb: 3.9, ast: 10.9 },
  ],
  SG: [
    { id: 1628969, name: 'Devin Booker', team: 'PHX', rating: 91, pts: 27.1, reb: 4.5, ast: 6.9 },
    { id: 1628973, name: 'Jalen Brunson', team: 'NYK', rating: 88, pts: 28.7, reb: 3.5, ast: 6.7 },
    { id: 1628378, name: 'Donovan Mitchell', team: 'CLE', rating: 89, pts: 28.3, reb: 4.0, ast: 6.1 },
    { id: 1630162, name: 'Anthony Edwards', team: 'MIN', rating: 90, pts: 25.9, reb: 5.4, ast: 5.1 },
    { id: 203078, name: 'Bradley Beal', team: 'PHX', rating: 84, pts: 18.2, reb: 4.4, ast: 5.0 },
  ],
  SF: [
    { id: 2544, name: 'LeBron James', team: 'LAL', rating: 94, pts: 25.7, reb: 7.3, ast: 8.3 },
    { id: 1628369, name: 'Jayson Tatum', team: 'BOS', rating: 93, pts: 26.9, reb: 8.1, ast: 4.9 },
    { id: 201142, name: 'Kevin Durant', team: 'PHX', rating: 94, pts: 29.1, reb: 6.6, ast: 5.0 },
    { id: 1631094, name: 'Paolo Banchero', team: 'ORL', rating: 87, pts: 22.6, reb: 6.9, ast: 5.4 },
    { id: 1629628, name: 'RJ Barrett', team: 'TOR', rating: 82, pts: 18.5, reb: 5.4, ast: 3.0 },
  ],
  PF: [
    { id: 203507, name: 'Giannis Antetokounmpo', team: 'MIL', rating: 97, pts: 30.4, reb: 11.5, ast: 6.5 },
    { id: 1630567, name: 'Scottie Barnes', team: 'TOR', rating: 86, pts: 19.9, reb: 8.2, ast: 6.1 },
    { id: 203110, name: 'Draymond Green', team: 'GSW', rating: 80, pts: 8.6, reb: 7.2, ast: 6.0 },
    { id: 1629627, name: 'Zion Williamson', team: 'NOP', rating: 89, pts: 22.9, reb: 5.8, ast: 5.0 },
    { id: 1630596, name: 'Evan Mobley', team: 'CLE', rating: 85, pts: 15.7, reb: 9.4, ast: 3.2 },
  ],
  C: [
    { id: 203999, name: 'Nikola Jokic', team: 'DEN', rating: 98, pts: 26.4, reb: 12.4, ast: 9.0 },
    { id: 203954, name: 'Joel Embiid', team: 'PHI', rating: 95, pts: 33.1, reb: 10.2, ast: 4.2 },
    { id: 1628389, name: 'Bam Adebayo', team: 'MIA', rating: 87, pts: 19.3, reb: 10.4, ast: 3.9 },
    { id: 1627826, name: 'Ivica Zubac', team: 'LAC', rating: 80, pts: 11.7, reb: 9.2, ast: 1.4 },
    { id: 1631096, name: 'Chet Holmgren', team: 'OKC', rating: 84, pts: 16.5, reb: 7.9, ast: 2.4 },
  ],
}

const positions = ['PG', 'SG', 'SF', 'PF', 'C'] as const
type Position = typeof positions[number]

// Boss team for AI opponent
const bossTeam = {
  PG: playerPools.PG[0],
  SG: playerPools.SG[3],
  SF: playerPools.SF[2],
  PF: playerPools.PF[0],
  C: playerPools.C[0],
}

export default function DraftPage() {
  const { soundEnabled } = useSettingsStore()
  const [mode, setMode] = useState<'select' | 'solo'>('select')
  const [phase, setPhase] = useState<'draft' | 'battle' | 'result'>('draft')
  const [currentPosition, setCurrentPosition] = useState<Position>('PG')
  const [draftedTeam, setDraftedTeam] = useState<{ [key in Position]?: typeof playerPools.PG[0] }>({})
  const [availablePlayers, setAvailablePlayers] = useState(playerPools.PG)

  // Keyboard controls
  useKeyboardControls({
    onEnter: () => {
      if (phase === 'battle') {
        setPhase('result')
      }
    },
    onNumber: (num) => {
      if (mode === 'solo' && phase === 'draft' && availablePlayers[num - 1]) {
        handleDraft(availablePlayers[num - 1])
      }
    },
    enabled: mode === 'solo',
  })

  const handleDraft = (player: typeof playerPools.PG[0]) => {
    if (soundEnabled) sounds.click()
    const newTeam = { ...draftedTeam, [currentPosition]: player }
    setDraftedTeam(newTeam)

    const currentIndex = positions.indexOf(currentPosition)
    if (currentIndex < positions.length - 1) {
      const nextPosition = positions[currentIndex + 1]
      setCurrentPosition(nextPosition)
      setAvailablePlayers(playerPools[nextPosition])
    } else {
      setPhase('battle')
    }
  }

  const calculateTeamScore = (team: typeof draftedTeam) => {
    return Object.values(team).reduce((sum, player) => {
      if (!player) return sum
      return sum + player.rating + player.pts + player.reb + player.ast
    }, 0)
  }

  const userScore = calculateTeamScore(draftedTeam)
  const bossScore = calculateTeamScore(bossTeam)
  const userWins = userScore > bossScore

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-muted hover:text-ghost-white transition-colors flex items-center gap-1">
          <ArrowLeftIcon size={16} /> Back to Home
        </Link>
        <span className="text-electric-lime font-bold">5v5 Draft Battle</span>
      </div>

      <AnimatePresence mode="wait">
        {/* MODE SELECT */}
        {mode === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-2xl mx-auto"
          >
            <h1 className="text-3xl font-display font-bold text-center mb-8 flex items-center justify-center gap-2">
              <SwordsIcon size={32} className="text-hot-pink" /> Draft Arena
            </h1>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Solo vs AI */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMode('solo')}
                className="glass rounded-2xl p-8 text-center hover:border-electric-lime transition-all border border-transparent"
              >
                <div className="w-20 h-20 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
                  <BotIcon size={40} className="text-electric-lime" />
                </div>
                <h2 className="text-2xl font-display font-bold mb-2">Solo Battle</h2>
                <p className="text-muted">Challenge the AI Boss Team</p>
              </motion.button>

              {/* Multiplayer */}
              <Link href="/draft/multiplayer">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="glass rounded-2xl p-8 text-center hover:border-hot-pink transition-all border border-transparent h-full"
                >
                  <div className="w-20 h-20 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
                    <UsersIcon size={40} className="text-hot-pink" />
                  </div>
                  <h2 className="text-2xl font-display font-bold mb-2">Multiplayer</h2>
                  <p className="text-muted">Battle a friend in real-time</p>
                </motion.div>
              </Link>
            </div>
          </motion.div>
        )}

        {mode === 'solo' && phase === 'draft' && (
          <motion.div
            key="draft"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="max-w-4xl mx-auto">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-center mb-2 flex items-center justify-center gap-2">
                <SwordsIcon size={28} className="text-hot-pink" /> Build Your Team
              </h1>
              
              {/* Position Progress */}
              <div className="flex justify-center gap-2 mb-8">
                {positions.map((pos) => (
                  <div
                    key={pos}
                    className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm transition-all ${
                      draftedTeam[pos]
                        ? 'bg-electric-lime text-deep-void'
                        : pos === currentPosition
                        ? 'bg-surface border-2 border-electric-lime text-ghost-white'
                        : 'bg-gunmetal text-muted'
                    }`}
                  >
                    {pos}
                  </div>
                ))}
              </div>

              {/* Current Position Label */}
              <h2 className="text-xl font-display text-center mb-6">
                Select your <span className="text-electric-lime">{currentPosition}</span>
              </h2>

              {/* Player Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availablePlayers.map((player) => (
                  <motion.button
                    key={player.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDraft(player)}
                    className="glass rounded-xl p-4 text-left hover:border-electric-lime transition-all border border-transparent"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gunmetal overflow-hidden">
                        <img
                          src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.id}.png`}
                          alt={player.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-bold">{player.name}</p>
                        <p className="text-sm text-muted">{player.team}</p>
                      </div>
                      <span className="ml-auto text-2xl font-display font-bold text-electric-lime">
                        {player.rating}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span><span className="text-muted">PTS:</span> {player.pts}</span>
                      <span><span className="text-muted">REB:</span> {player.reb}</span>
                      <span><span className="text-muted">AST:</span> {player.ast}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {mode === 'solo' && phase === 'battle' && (
          <motion.div
            key="battle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-4xl mx-auto text-center"
          >
            <h1 className="text-3xl font-display font-bold mb-8 flex items-center justify-center gap-2">
              <SwordsIcon size={32} className="text-hot-pink" /> Battle Time!
            </h1>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* User Team */}
              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-4 text-electric-lime">Your Team</h2>
                <div className="space-y-2">
                  {positions.map((pos) => (
                    <div key={pos} className="flex items-center justify-between bg-gunmetal rounded-lg p-2">
                      <span className="text-muted w-8">{pos}</span>
                      <span className="flex-1">{draftedTeam[pos]?.name}</span>
                      <span className="text-electric-lime font-bold">{draftedTeam[pos]?.rating}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-2xl font-display font-bold">
                  Score: <span className="text-electric-lime">{userScore.toFixed(1)}</span>
                </p>
              </div>

              {/* Boss Team */}
              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-4 text-hot-pink">Boss Team</h2>
                <div className="space-y-2">
                  {positions.map((pos) => (
                    <div key={pos} className="flex items-center justify-between bg-gunmetal rounded-lg p-2">
                      <span className="text-muted w-8">{pos}</span>
                      <span className="flex-1">{bossTeam[pos]?.name}</span>
                      <span className="text-hot-pink font-bold">{bossTeam[pos]?.rating}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-2xl font-display font-bold">
                  Score: <span className="text-hot-pink">{bossScore.toFixed(1)}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setPhase('result')}
              className="px-12 py-4 bg-electric-lime text-deep-void font-bold rounded-xl text-xl animate-glow"
            >
              BATTLE!
            </button>
          </motion.div>
        )}

        {mode === 'solo' && phase === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className={`flex justify-center mb-4 ${userWins ? 'animate-float' : ''}`}>
              {userWins ? (
                <TrophyIcon size={80} className="text-yellow-400" />
              ) : (
                <HeartIcon size={80} className="text-hot-pink" />
              )}
            </div>
            <h1 className={`text-4xl font-display font-bold mb-4 ${
              userWins ? 'text-electric-lime' : 'text-hot-pink'
            }`}>
              {userWins ? 'VICTORY!' : 'DEFEAT'}
            </h1>
            <p className="text-xl text-muted mb-8">
              {userWins 
                ? `You won by ${(userScore - bossScore).toFixed(1)} points!`
                : `You lost by ${(bossScore - userScore).toFixed(1)} points.`
              }
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setMode('select')
                  setPhase('draft')
                  setCurrentPosition('PG')
                  setDraftedTeam({})
                  setAvailablePlayers(playerPools.PG)
                }}
                className="px-8 py-3 bg-electric-lime text-deep-void font-bold rounded-xl"
              >
                Play Again
              </button>
              <Link
                href="/"
                className="px-8 py-3 bg-surface text-ghost-white font-bold rounded-xl"
              >
                Home
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
