'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { SwordsIcon } from '@/components/icons'

export function DraftArena() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass rounded-2xl p-6 card-hover relative overflow-hidden"
    >
      {/* Background Decoration */}
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-electric-lime/10 rounded-full blur-3xl"></div>
      <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-hot-pink/10 rounded-full blur-3xl"></div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <SwordsIcon size={24} className="text-hot-pink" />
            Draft Arena
          </h2>
          <span className="text-xs text-electric-lime bg-electric-lime/10 px-3 py-1 rounded-full">
            5v5 Battle
          </span>
        </div>

        <p className="text-muted mb-6">
          Build your dream team by drafting players position-by-position. 
          Challenge the AI or other players!
        </p>

        {/* Position Preview */}
        <div className="flex justify-center gap-2 mb-6">
          {['PG', 'SG', 'SF', 'PF', 'C'].map((pos, i) => (
            <div
              key={pos}
              className="w-12 h-12 rounded-lg bg-gunmetal border border-surface flex items-center justify-center text-muted text-sm font-bold"
            >
              {pos}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/draft"
            className="py-4 bg-electric-lime text-deep-void font-bold rounded-xl text-center hover:bg-green-400 transition-all animate-glow"
          >
            Start Draft
          </Link>
          <Link
            href="/draft/quick"
            className="py-4 bg-surface text-ghost-white font-bold rounded-xl text-center hover:bg-muted/30 transition-colors border border-surface"
          >
            Quick Match
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-surface">
          <div className="text-center">
            <p className="text-2xl font-display font-bold text-electric-lime">0</p>
            <p className="text-xs text-muted">Wins</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-display font-bold text-hot-pink">0</p>
            <p className="text-xs text-muted">Losses</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-display font-bold">--</p>
            <p className="text-xs text-muted">Win Rate</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
