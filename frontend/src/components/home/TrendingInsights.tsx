'use client'

import { motion } from 'framer-motion'
import { TrendingUpIcon, TrendingDownIcon } from '@/components/icons'

const trendingPlayers = [
  {
    id: 203999,
    name: 'Nikola Jokic',
    team: 'DEN',
    stat: '32.5 PTS',
    trend: 'up',
    insight: 'Career-high scoring month',
  },
  {
    id: 201566,
    name: 'Luka Doncic',
    team: 'DAL',
    stat: '12.4 AST',
    trend: 'up',
    insight: 'League leader in assists',
  },
  {
    id: 1628369,
    name: 'Jayson Tatum',
    team: 'BOS',
    stat: '45.2 FG%',
    trend: 'down',
    insight: 'Shooting slump continues',
  },
  {
    id: 203507,
    name: 'Giannis Antetokounmpo',
    team: 'MIL',
    stat: '11.2 REB',
    trend: 'up',
    insight: 'Dominant on the boards',
  },
]

export function TrendingInsights() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-bold flex items-center gap-2">
          <TrendingUpIcon size={20} className="text-electric-lime" />
          Trending
        </h2>
        <button className="text-xs text-electric-lime hover:underline">
          View All
        </button>
      </div>

      <div className="space-y-3">
        {trendingPlayers.map((player, i) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 * i }}
            className="flex items-center gap-3 p-3 rounded-xl bg-gunmetal/50 hover:bg-surface/50 transition-colors cursor-pointer group"
          >
            {/* Player Image */}
            <div className="w-10 h-10 rounded-full overflow-hidden bg-surface flex-shrink-0">
              <img
                src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.id}.png`}
                alt={player.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{player.name}</p>
              <p className="text-xs text-muted truncate">{player.insight}</p>
            </div>

            {/* Stat with Trend Icon */}
            <div className="text-right flex-shrink-0 flex items-center gap-1">
              {player.trend === 'up' ? (
                <TrendingUpIcon size={14} className="text-electric-lime" />
              ) : (
                <TrendingDownIcon size={14} className="text-hot-pink" />
              )}
              <div>
                <p className={`text-sm font-bold ${player.trend === 'up' ? 'text-electric-lime' : 'text-hot-pink'}`}>
                  {player.stat}
                </p>
                <p className="text-xs text-muted">{player.team}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
