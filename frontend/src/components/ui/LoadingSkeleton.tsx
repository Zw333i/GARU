'use client'

import { motion } from 'framer-motion'
import { CSSProperties } from 'react'

interface SkeletonProps {
  className?: string
  animate?: boolean
  style?: CSSProperties
}

// Base skeleton with shimmer effect
export function Skeleton({ className = '', animate = true, style }: SkeletonProps) {
  return (
    <div
      className={`bg-gunmetal rounded-lg overflow-hidden ${className}`}
      style={style}
    >
      {animate && (
        <motion.div
          className="h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  )
}

// Player card skeleton
export function PlayerCardSkeleton() {
  return (
    <div className="glass rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    </div>
  )
}

// Leaderboard row skeleton
export function LeaderboardRowSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4 px-6 py-4">
      <div className="col-span-1">
        <Skeleton className="h-6 w-8" />
      </div>
      <div className="col-span-4 flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="h-5 flex-1" />
      </div>
      <div className="col-span-2">
        <Skeleton className="h-5 w-12 mx-auto" />
      </div>
      <div className="col-span-2">
        <Skeleton className="h-5 w-12 mx-auto" />
      </div>
      <div className="col-span-2">
        <Skeleton className="h-5 w-16 mx-auto" />
      </div>
      <div className="col-span-1">
        <Skeleton className="h-5 w-8 mx-auto" />
      </div>
    </div>
  )
}

// Stats card skeleton
export function StatsCardSkeleton() {
  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-4 w-full" />
    </div>
  )
}

// Daily challenge skeleton
export function DailyChallengeSkeleton() {
  return (
    <div className="glass rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="flex items-center gap-6">
        <Skeleton className="w-24 h-24 rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-12 flex-1" />
        <Skeleton className="h-12 w-24" />
      </div>
    </div>
  )
}

// Chart skeleton
const chartHeights = [60, 85, 45, 70, 90, 55, 75, 50] // Pre-defined heights for consistency

export function ChartSkeleton() {
  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <Skeleton className="h-6 w-1/4" />
      <div className="flex items-end justify-between gap-2 h-48">
        {chartHeights.map((height, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  )
}

// Full page loading skeleton
export function PageSkeleton() {
  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <DailyChallengeSkeleton />
          <StatsCardSkeleton />
        </div>
        <div className="space-y-6">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>
      </div>
    </div>
  )
}
