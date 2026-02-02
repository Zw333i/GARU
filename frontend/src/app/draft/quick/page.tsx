'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { LightningIcon, BasketballIcon, TrophyIcon, HeartIcon, ArrowLeftIcon } from '@/components/icons'
import { sounds } from '@/lib/sounds'

// Quick match: auto-generate teams and battle immediately
const allPlayers = [
  { id: 201566, name: 'Luka Doncic', team: 'DAL', position: 'PG', rating: 96, pts: 32.4, reb: 8.6, ast: 8.0 },
  { id: 201939, name: 'Stephen Curry', team: 'GSW', position: 'PG', rating: 95, pts: 26.4, reb: 4.5, ast: 5.1 },
  { id: 1629029, name: 'Shai Gilgeous-Alexander', team: 'OKC', position: 'PG', rating: 93, pts: 31.1, reb: 5.5, ast: 6.2 },
  { id: 1627750, name: 'Ja Morant', team: 'MEM', position: 'PG', rating: 88, pts: 25.1, reb: 5.6, ast: 8.1 },
  { id: 1628973, name: 'Jalen Brunson', team: 'NYK', position: 'PG', rating: 88, pts: 28.7, reb: 3.5, ast: 6.7 },
  
  { id: 1627627, name: 'Anthony Edwards', team: 'MIN', position: 'SG', rating: 90, pts: 25.9, reb: 5.4, ast: 5.1 },
  { id: 1628378, name: 'Donovan Mitchell', team: 'CLE', position: 'SG', rating: 89, pts: 28.3, reb: 4.0, ast: 6.1 },
  { id: 203954, name: 'Devin Booker', team: 'PHX', position: 'SG', rating: 91, pts: 27.1, reb: 4.5, ast: 6.9 },
  { id: 201935, name: 'James Harden', team: 'LAC', position: 'SG', rating: 85, pts: 16.6, reb: 5.1, ast: 8.5 },
  
  { id: 2544, name: 'LeBron James', team: 'LAL', position: 'SF', rating: 94, pts: 25.7, reb: 7.3, ast: 8.3 },
  { id: 1628369, name: 'Jayson Tatum', team: 'BOS', position: 'SF', rating: 93, pts: 26.9, reb: 8.1, ast: 4.9 },
  { id: 201142, name: 'Kevin Durant', team: 'PHX', position: 'SF', rating: 94, pts: 29.1, reb: 6.6, ast: 5.0 },
  { id: 202710, name: 'Jimmy Butler', team: 'MIA', position: 'SF', rating: 87, pts: 20.8, reb: 5.3, ast: 5.0 },
  
  { id: 203507, name: 'Giannis Antetokounmpo', team: 'MIL', position: 'PF', rating: 97, pts: 30.4, reb: 11.5, ast: 6.5 },
  { id: 1629630, name: 'Scottie Barnes', team: 'TOR', position: 'PF', rating: 86, pts: 19.9, reb: 8.2, ast: 6.1 },
  { id: 203076, name: 'Anthony Davis', team: 'LAL', position: 'PF', rating: 92, pts: 24.7, reb: 12.6, ast: 3.5 },
  
  { id: 203999, name: 'Nikola Jokic', team: 'DEN', position: 'C', rating: 98, pts: 26.4, reb: 12.4, ast: 9.0 },
  { id: 203954, name: 'Joel Embiid', team: 'PHI', position: 'C', rating: 95, pts: 33.1, reb: 10.2, ast: 4.2 },
  { id: 1628389, name: 'Bam Adebayo', team: 'MIA', position: 'C', rating: 87, pts: 19.3, reb: 10.4, ast: 3.9 },
]

const positions = ['PG', 'SG', 'SF', 'PF', 'C'] as const

export default function QuickMatchPage() {
  const [phase, setPhase] = useState<'generating' | 'battle' | 'result'>('generating')
  const [userTeam, setUserTeam] = useState<Record<string, any>>({})
  const [opponentTeam, setOpponentTeam] = useState<Record<string, any>>({})
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    // Generate random teams
    const generateTeam = () => {
      const team: Record<string, any> = {}
      positions.forEach(pos => {
        const posPlayers = allPlayers.filter(p => p.position === pos)
        const randomPlayer = posPlayers[Math.floor(Math.random() * posPlayers.length)]
        team[pos] = randomPlayer
      })
      return team
    }

    setUserTeam(generateTeam())
    setOpponentTeam(generateTeam())

    // Countdown
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          setPhase('battle')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const calculateScore = (team: Record<string, any>) => {
    return Object.values(team).reduce((sum: number, p: any) => {
      return sum + (p?.rating || 0) + (p?.pts || 0) + (p?.reb || 0) + (p?.ast || 0)
    }, 0)
  }

  const userScore = calculateScore(userTeam)
  const opponentScore = calculateScore(opponentTeam)
  const userWins = userScore > opponentScore

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/draft" className="text-muted hover:text-ghost-white transition-colors flex items-center gap-1">
          <ArrowLeftIcon size={16} /> Back to Draft
        </Link>
        <span className="text-electric-lime font-bold">Quick Match</span>
      </div>

      {phase === 'generating' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="flex justify-center mb-8"
          >
            <BasketballIcon size={80} className="text-electric-lime" />
          </motion.div>
          <h1 className="text-4xl font-display font-bold mb-4">
            Generating Teams...
          </h1>
          <p className="text-6xl font-display font-bold text-electric-lime">
            {countdown}
          </p>
        </motion.div>
      )}

      {phase === 'battle' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="text-3xl font-display font-bold text-center mb-8 flex items-center justify-center gap-2">
            <LightningIcon size={28} className="text-yellow-400" /> Quick Battle!
          </h1>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* User Team */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 text-electric-lime text-center">Your Team</h2>
              <div className="space-y-2">
                {positions.map(pos => (
                  <div key={pos} className="flex items-center gap-3 bg-gunmetal rounded-lg p-2">
                    <span className="text-muted w-8 text-sm">{pos}</span>
                    <div className="w-8 h-8 rounded-full bg-surface overflow-hidden">
                      <img
                        src={`https://cdn.nba.com/headshots/nba/latest/260x190/${userTeam[pos]?.id}.png`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="flex-1 text-sm">{userTeam[pos]?.name}</span>
                    <span className="text-electric-lime font-bold">{userTeam[pos]?.rating}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Opponent Team */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 text-hot-pink text-center">Opponent</h2>
              <div className="space-y-2">
                {positions.map(pos => (
                  <div key={pos} className="flex items-center gap-3 bg-gunmetal rounded-lg p-2">
                    <span className="text-muted w-8 text-sm">{pos}</span>
                    <div className="w-8 h-8 rounded-full bg-surface overflow-hidden">
                      <img
                        src={`https://cdn.nba.com/headshots/nba/latest/260x190/${opponentTeam[pos]?.id}.png`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="flex-1 text-sm">{opponentTeam[pos]?.name}</span>
                    <span className="text-hot-pink font-bold">{opponentTeam[pos]?.rating}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => setPhase('result')}
              className="px-12 py-4 bg-electric-lime text-deep-void font-bold rounded-xl text-xl animate-glow"
            >
              BATTLE!
            </button>
          </div>
        </motion.div>
      )}

      {phase === 'result' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto text-center py-10"
        >
          <motion.div
            animate={{ rotate: userWins ? [0, 10, -10, 0] : 0 }}
            transition={{ duration: 0.5, repeat: userWins ? 3 : 0 }}
            className="flex justify-center mb-4"
          >
            {userWins ? (
              <TrophyIcon size={80} className="text-yellow-400" />
            ) : (
              <HeartIcon size={80} className="text-hot-pink" />
            )}
          </motion.div>
          <h1 className={`text-4xl font-display font-bold mb-4 ${
            userWins ? 'text-electric-lime' : 'text-hot-pink'
          }`}>
            {userWins ? 'VICTORY!' : 'DEFEAT'}
          </h1>
          
          <div className="glass rounded-2xl p-6 mb-6">
            <div className="flex justify-around items-center">
              <div>
                <p className="text-muted text-sm">Your Score</p>
                <p className="text-3xl font-display font-bold text-electric-lime">{userScore.toFixed(1)}</p>
              </div>
              <span className="text-2xl text-muted">VS</span>
              <div>
                <p className="text-muted text-sm">Opponent</p>
                <p className="text-3xl font-display font-bold text-hot-pink">{opponentScore.toFixed(1)}</p>
              </div>
            </div>
          </div>

          <p className="text-muted mb-8">
            {userWins 
              ? `You won by ${(userScore - opponentScore).toFixed(1)} points!`
              : `You lost by ${(opponentScore - userScore).toFixed(1)} points.`
            }
          </p>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-electric-lime text-deep-void font-bold rounded-xl"
            >
              Play Again
            </button>
            <Link
              href="/draft"
              className="px-8 py-3 bg-surface text-ghost-white font-bold rounded-xl"
            >
              Full Draft
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  )
}
