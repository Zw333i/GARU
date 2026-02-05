'use client'

import { motion } from 'framer-motion'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

const sizes = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
}

export function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`${sizes[size]} border-4 border-surface border-b-electric-lime rounded-full animate-spin`} />
      {text && <p className="text-muted text-sm">{text}</p>}
    </div>
  )
}

// Bouncing basketball loader - used across the app
export function BallBouncingLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="text-center">
      <div className="relative w-20 h-20 mx-auto mb-4">
        {/* Basketball bouncing animation */}
        <motion.div
          animate={{ 
            y: [0, -20, 0],
            scale: [1, 0.9, 1],
          }}
          transition={{ 
            duration: 0.6, 
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="text-6xl"
        >
          🏀
        </motion.div>
        {/* Shadow */}
        <motion.div
          animate={{ 
            scale: [1, 0.7, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ 
            duration: 0.6, 
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-2 bg-electric-lime/30 rounded-full blur-sm"
        />
      </div>
      <p className="text-muted">{text}</p>
    </div>
  )
}

export function LoadingScreen({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-deep-void">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="relative w-20 h-20 mx-auto mb-4">
          {/* Basketball animation */}
          <motion.div
            animate={{ 
              y: [0, -20, 0],
              scale: [1, 0.9, 1],
            }}
            transition={{ 
              duration: 0.6, 
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            className="text-6xl"
          >
            🏀
          </motion.div>
          {/* Shadow */}
          <motion.div
            animate={{ 
              scale: [1, 0.7, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ 
              duration: 0.6, 
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-2 bg-electric-lime/30 rounded-full blur-sm"
          />
        </div>
        <p className="text-muted">{text}</p>
      </motion.div>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="glass rounded-2xl p-6 animate-pulse">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-surface" />
        <div className="flex-1">
          <div className="h-4 bg-surface rounded w-3/4 mb-2" />
          <div className="h-3 bg-surface rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 bg-surface rounded w-full" />
        <div className="h-3 bg-surface rounded w-5/6" />
        <div className="h-3 bg-surface rounded w-4/6" />
      </div>
    </div>
  )
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

// Additional skeleton components
export function SkeletonPlayerCard() {
  return (
    <div className="flex items-center gap-3 p-4 bg-gunmetal rounded-xl animate-pulse">
      <div className="w-16 h-16 rounded-full bg-surface" />
      <div className="flex-1">
        <div className="h-5 bg-surface rounded w-2/3 mb-2" />
        <div className="h-3 bg-surface rounded w-1/3" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="h-6 w-10 bg-surface rounded mb-1" />
          <div className="h-2 w-6 bg-surface rounded mx-auto" />
        </div>
        <div className="text-center">
          <div className="h-6 w-10 bg-surface rounded mb-1" />
          <div className="h-2 w-6 bg-surface rounded mx-auto" />
        </div>
        <div className="text-center">
          <div className="h-6 w-10 bg-surface rounded mb-1" />
          <div className="h-2 w-6 bg-surface rounded mx-auto" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="glass rounded-2xl p-6 animate-pulse">
      <div className="h-6 bg-surface rounded w-1/3 mb-4" />
      <div className="h-64 bg-surface rounded" />
    </div>
  )
}

export function SkeletonStats() {
  return (
    <div className="glass rounded-2xl p-6 animate-pulse">
      <div className="h-6 bg-surface rounded w-1/2 mb-4" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <div className="h-4 bg-surface rounded w-1/3" />
            <div className="h-4 bg-surface rounded w-1/6" />
          </div>
        ))}
      </div>
    </div>
  )
}
