'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { BasketballIcon } from '@/components/icons'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="mb-4 flex justify-center">
          <div className="w-24 h-24 rounded-full bg-gunmetal/40 flex items-center justify-center">
            <BasketballIcon size={56} className="text-electric-lime" />
          </div>
        </div>
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
