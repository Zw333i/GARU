'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { TrophyIcon } from '@/components/icons'

export function MultiplayerArena() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass rounded-2xl p-6 card-hover"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-electric-lime to-green-600 flex items-center justify-center">
            <TrophyIcon size={24} className="text-deep-void" />
          </div>
          <div>
            <h2 className="font-display font-bold text-xl">Multiplayer Arena</h2>
            <p className="text-muted text-sm">Challenge friends in real-time</p>
          </div>
        </div>
      </div>

      <p className="text-muted mb-6">
        Create or join rooms to battle other players in stat comparison and head-to-head matches!
      </p>

      <Link
        href="/multiplayer"
        className="block w-full px-4 py-3 bg-gradient-to-r from-electric-lime to-green-600 rounded-xl font-medium text-center text-deep-void transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        Enter Arena
      </Link>
    </motion.div>
  )
}
