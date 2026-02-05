'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ClockIcon } from '@/components/icons'

interface DailyChallengeTimerProps {
  className?: string
}

export function DailyChallengeTimer({ className = '' }: DailyChallengeTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number
    minutes: number
    seconds: number
  }>({ hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const calculateTimeLeft = () => {
      // Get next midnight UTC
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      tomorrow.setUTCHours(0, 0, 0, 0)

      const diff = tomorrow.getTime() - now.getTime()

      if (diff <= 0) {
        return { hours: 0, minutes: 0, seconds: 0 }
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      return { hours, minutes, seconds }
    }

    setTimeLeft(calculateTimeLeft())

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const padZero = (num: number) => num.toString().padStart(2, '0')

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ClockIcon size={16} className="text-muted" />
      <span className="text-sm text-muted">Next challenge in:</span>
      <motion.div
        key={`${timeLeft.hours}-${timeLeft.minutes}-${timeLeft.seconds}`}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-1 font-mono text-sm"
      >
        <TimeBlock value={timeLeft.hours} label="h" />
        <span className="text-muted">:</span>
        <TimeBlock value={timeLeft.minutes} label="m" />
        <span className="text-muted">:</span>
        <TimeBlock value={timeLeft.seconds} label="s" />
      </motion.div>
    </div>
  )
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline">
      <span className="text-electric-lime font-bold">
        {value.toString().padStart(2, '0')}
      </span>
      <span className="text-xs text-muted ml-0.5">{label}</span>
    </span>
  )
}

// Compact version for smaller spaces
export function CompactTimer({ className = '' }: DailyChallengeTimerProps) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      tomorrow.setUTCHours(0, 0, 0, 0)

      const diff = tomorrow.getTime() - now.getTime()

      if (diff <= 0) return '00:00:00'

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }

    setTimeLeft(calculateTimeLeft())

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <span className={`font-mono text-electric-lime ${className}`}>
      {timeLeft}
    </span>
  )
}
