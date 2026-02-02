'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="text-8xl mb-4">🏀</div>
        <h1 className="text-4xl font-display font-bold mb-2">
          <span className="text-hot-pink">404</span> - Air Ball!
        </h1>
        <p className="text-muted text-lg mb-8">
          This page got blocked at the rim. It doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-electric-lime text-deep-void font-bold rounded-xl hover:bg-green-400 transition-colors"
        >
          Back to Home Court
        </Link>
      </motion.div>
    </div>
  )
}
