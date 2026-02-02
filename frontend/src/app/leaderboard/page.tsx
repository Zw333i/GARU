'use client'

import { motion } from 'framer-motion'
import { TrophyIcon, GoldMedalIcon, SilverMedalIcon, BronzeMedalIcon } from '@/components/icons'

// Mock leaderboard data
const leaderboardData = [
  { rank: 1, username: 'JokicFan2024', wins: 152, losses: 23, xp: 15200, level: 42 },
  { rank: 2, username: 'DraftKing99', wins: 134, losses: 31, xp: 13400, level: 38 },
  { rank: 3, username: 'StatNerd', wins: 128, losses: 28, xp: 12800, level: 36 },
  { rank: 4, username: 'BucksIn6', wins: 115, losses: 35, xp: 11500, level: 33 },
  { rank: 5, username: 'TatumTime', wins: 98, losses: 42, xp: 9800, level: 28 },
  { rank: 6, username: 'HoopsDreams', wins: 89, losses: 38, xp: 8900, level: 26 },
  { rank: 7, username: 'CelticsPride', wins: 82, losses: 45, xp: 8200, level: 24 },
  { rank: 8, username: 'LakeShow', wins: 76, losses: 52, xp: 7600, level: 22 },
  { rank: 9, username: 'WarriorsGold', wins: 71, losses: 48, xp: 7100, level: 21 },
  { rank: 10, username: 'NuggetsMile', wins: 65, losses: 55, xp: 6500, level: 19 },
]

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <GoldMedalIcon size={28} />
    case 2:
      return <SilverMedalIcon size={28} />
    case 3:
      return <BronzeMedalIcon size={28} />
    default:
      return null
  }
}

const getRankStyle = (rank: number) => {
  switch (rank) {
    case 1:
      return { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-400' }
    case 2:
      return { bg: 'bg-gray-400/20', border: 'border-gray-400', text: 'text-gray-300' }
    case 3:
      return { bg: 'bg-amber-600/20', border: 'border-amber-600', text: 'text-amber-500' }
    default:
      return { bg: 'bg-gunmetal', border: 'border-surface', text: 'text-muted' }
  }
}

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
      {/* Header */}
      <section className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-2 flex items-center gap-3">
          <TrophyIcon size={32} className="text-yellow-400" />
          Leaderboard
        </h1>
        <p className="text-muted text-lg">
          Top Draft Battle players this season
        </p>
      </section>

      {/* Leaderboard Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {/* Header Row */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gunmetal border-b border-surface text-sm text-muted font-medium">
          <div className="col-span-1">Rank</div>
          <div className="col-span-4">Player</div>
          <div className="col-span-2 text-center">Wins</div>
          <div className="col-span-2 text-center">Losses</div>
          <div className="col-span-2 text-center">Win Rate</div>
          <div className="col-span-1 text-center">Level</div>
        </div>

        {/* Leaderboard Rows */}
        {leaderboardData.map((player, index) => {
          const style = getRankStyle(player.rank)
          const winRate = ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
          const rankIcon = getRankIcon(player.rank)

          return (
            <motion.div
              key={player.username}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-surface/50 hover:bg-surface/30 transition-colors ${style.bg}`}
            >
              {/* Rank */}
              <div className={`col-span-1 font-display font-bold text-lg ${style.text} flex items-center`}>
                {rankIcon || `#${player.rank}`}
              </div>

              {/* Player */}
              <div className="col-span-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-electric-lime to-green-600 flex items-center justify-center text-deep-void font-bold">
                  {player.username[0]}
                </div>
                <div>
                  <p className="font-medium">{player.username}</p>
                  <p className="text-xs text-muted">{player.xp.toLocaleString()} XP</p>
                </div>
              </div>

              {/* Wins */}
              <div className="col-span-2 text-center">
                <span className="text-electric-lime font-bold">{player.wins}</span>
              </div>

              {/* Losses */}
              <div className="col-span-2 text-center">
                <span className="text-hot-pink font-bold">{player.losses}</span>
              </div>

              {/* Win Rate */}
              <div className="col-span-2 text-center">
                <span className={`font-bold ${parseFloat(winRate) >= 60 ? 'text-electric-lime' : 'text-ghost-white'}`}>
                  {winRate}%
                </span>
              </div>

              {/* Level */}
              <div className="col-span-1 text-center">
                <span className="px-2 py-1 bg-surface rounded-lg text-sm font-bold">
                  {player.level}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Your Rank */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 glass rounded-2xl p-6 text-center"
      >
        <p className="text-muted mb-2">Your Rank</p>
        <p className="text-4xl font-display font-bold text-muted">--</p>
        <p className="text-sm text-muted mt-2">Sign in and win battles to appear on the leaderboard!</p>
      </motion.div>
    </div>
  )
}
