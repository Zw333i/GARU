'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrows = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gunmetal border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gunmetal border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gunmetal border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gunmetal border-y-transparent border-l-transparent',
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 ${positions[position]}`}
          >
            <div className="bg-gunmetal text-ghost-white text-sm px-3 py-2 rounded-lg shadow-lg whitespace-nowrap border border-surface">
              {content}
            </div>
            <div
              className={`absolute w-0 h-0 border-4 ${arrows[position]}`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Stat tooltip specifically for advanced stats
interface StatTooltipProps {
  abbr: string
  name: string
  description: string
  formula?: string
  children: React.ReactNode
}

export function StatTooltip({ abbr, name, description, formula, children }: StatTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div
      className="relative inline-block cursor-help"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={() => setIsVisible(!isVisible)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute z-50 bottom-full left-0 mb-2 w-64"
          >
            <div className="bg-gunmetal border border-surface rounded-xl p-4 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-electric-lime font-mono font-bold">{abbr}</span>
                <span className="text-ghost-white font-medium">{name}</span>
              </div>
              <p className="text-sm text-muted">{description}</p>
              {formula && (
                <p className="mt-2 text-xs font-mono bg-deep-void px-2 py-1 rounded text-muted">
                  {formula}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
