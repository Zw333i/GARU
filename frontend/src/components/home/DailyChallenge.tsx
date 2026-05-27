'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { TargetIcon, QuestionIcon, XIcon, ConfettiIcon } from '@/components/icons'
import { sounds } from '@/lib/sounds'
import { supabase } from '@/lib/supabase'
import { checkGuess } from '@/lib/nameMatch'

// XP reward for daily challenge
const DAILY_CHALLENGE_XP = 25

// Pool of players for daily challenges - rotates based on date
const DAILY_PLAYERS = [
  { id: 203507, name: 'Giannis Antetokounmpo', team: 'MIL', hint: 'Freaky Greek' },
  { id: 203999, name: 'Nikola Jokic', team: 'DEN', hint: 'Loves horses' },
  { id: 1629029, name: 'Luka Doncic', team: 'DAL', hint: 'Slovenian prodigy and former EuroLeague MVP' },
  { id: 201939, name: 'Stephen Curry', team: 'GSW', hint: 'Night-Night' },
  { id: 2544, name: 'LeBron James', team: 'LAL', hint: 'King' },
  { id: 201142, name: 'Kevin Durant', team: 'PHX', hint: 'Easy Money Sniper' },
  { id: 203954, name: 'Joel Embiid', team: 'PHI', hint: 'The Process' },
  { id: 1628369, name: 'Jayson Tatum', team: 'BOS', hint: 'The Anomaly' },
  { id: 1628983, name: 'Shai Gilgeous-Alexander', team: 'OKC', hint: 'Canadian star with a smooth midrange' },
  { id: 1630162, name: 'Anthony Edwards', team: 'MIN', hint: '___-Man' },
  { id: 203081, name: 'Damian Lillard', team: 'MIL', hint: '____ Time' },
  { id: 202681, name: 'Kyrie Irving', team: 'DAL', hint: 'Uncle Drew' },
  { id: 1641705, name: 'Victor Wembanyama', team: 'SAS', hint: 'Alien Breed' },
  { id: 1629630, name: 'Ja Morant', team: 'MEM', hint: 'Gravity-defying dunks & must-see TV' },
  { id: 1626164, name: 'Devin Booker', team: 'PHX', hint: 'Moss Point legend' },
  { id: 1627759, name: 'Jaylen Brown', team: 'BOS', hint: 'Two-way Star' },
  { id: 1629027, name: 'Trae Young', team: 'ATL', hint: 'Ice in his veins' },
  { id: 1628378, name: 'Donovan Mitchell', team: 'CLE', hint: 'Spiderman' },
  { id: 203078, name: 'Bradley Beal', team: 'LAC', hint: 'Big Panda' },
  { id: 202710, name: 'Jimmy Butler', team: 'MIA', hint: 'Himmy Buckets' },
  { id: 1628973, name: 'Jalen Brunson', team: 'NYK', hint: 'NYCs Finest' },
  { id: 1629684, name: 'Franz Wagner', team: 'ORL', hint: 'German forward and a rising star' },
  { id: 1630595, name: 'Cade Cunningham', team: 'DET', hint: 'The Motor____' },
  { id: 1630578, name: 'Alperen Sengun', team: 'HOU', hint: 'Turkish big man' },
  { id: 1627734, name: 'Domantas Sabonis', team: 'SAC', hint: 'Gonzaga product' },
  { id: 1628389, name: 'Bam Adebayo', team: 'MIA', hint: 'Mr. 83' },
  { id: 201566, name: 'Russell Westbrook', team: 'SAC', hint: 'Mr. Why Not' },
  { id: 977, name: 'Kobe Bryant', team: 'LAL', hint: 'Black Mamba' },
  { id: 1495, name: 'Tim Duncan', team: 'SAS', hint: 'The Big Fundamental' },
  { id: 2548, name: 'Dwyane Wade', team: 'MIA', hint: 'The Flash' },
]

// Get today's player based on date (UTC)
function getTodaysPlayer() {
  const now = new Date()
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getUTCFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
  const playerIndex = dayOfYear % DAILY_PLAYERS.length
  return DAILY_PLAYERS[playerIndex]
}

// Calculate time until midnight UTC
function getTimeUntilReset() {
  const now = new Date()
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return tomorrow.getTime() - now.getTime()
}

// Format milliseconds to HH:MM:SS
function formatCountdown(ms: number) {
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((ms % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export function DailyChallenge() {
  const [guess, setGuess] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [currentDate, setCurrentDate] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [xpAwarded, setXpAwarded] = useState(false)

  // Get today's date string for storage key
  const getTodayKey = () => {
    const now = new Date()
    return `daily_challenge_${now.getUTCFullYear()}_${now.getUTCMonth()}_${now.getUTCDate()}`
  }

  // Check if user already completed today's challenge
  const checkCompletion = () => {
    const todayKey = getTodayKey()
    const completed = localStorage.getItem(todayKey)
    if (completed) {
      const data = JSON.parse(completed)
      setAlreadyCompleted(true)
      setRevealed(true)
      setIsCorrect(data.correct)
    }
  }

  // Save completion to localStorage
  const saveCompletion = (correct: boolean) => {
    const todayKey = getTodayKey()
    localStorage.setItem(todayKey, JSON.stringify({ correct, timestamp: Date.now() }))
    
    // Clean up old entries (keep only last 7 days)
    const now = new Date()
    for (let i = 7; i < 30; i++) {
      const oldDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
      const oldKey = `daily_challenge_${oldDate.getUTCFullYear()}_${oldDate.getUTCMonth()}_${oldDate.getUTCDate()}`
      localStorage.removeItem(oldKey)
    }
  }

  // Award XP to logged in user
  const awardXP = async (correct: boolean) => {
    if (!user || xpAwarded) return
    
    try {
      const xpGain = correct ? DAILY_CHALLENGE_XP : Math.floor(DAILY_CHALLENGE_XP / 2)
      setXpAwarded(true)
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Skipped client XP award (${xpGain}) for daily challenge.`)
      }
    } catch (err) {
      console.error('Failed to award XP:', err)
    }
  }

  // Get today's player
  const dailyPlayer = useMemo(() => ({
    ...getTodaysPlayer(),
    blurLevel: revealed ? 0 : 20,
  }), [revealed, currentDate])

  // Initialize on client only to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
    setCountdown(getTimeUntilReset())
    setCurrentDate(new Date().toDateString())
    checkCompletion()
    
    // Check auth
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })
  }, [])

  // Countdown timer + auto-reset at midnight
  useEffect(() => {
    if (!mounted) return
    
    const interval = setInterval(() => {
      const remaining = getTimeUntilReset()
      setCountdown(remaining)
      
      // Check if day changed (new challenge)
      const today = new Date().toDateString()
      if (today !== currentDate) {
        setCurrentDate(today)
        setGuess('')
        setRevealed(false)
        setIsCorrect(null)
        setAlreadyCompleted(false)
        setXpAwarded(false)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [currentDate, mounted])

  const handleGuess = async () => {
    if (alreadyCompleted) return
    
    const correct = checkGuess(guess, dailyPlayer.name)
    
    setIsCorrect(correct)
    setRevealed(true)
    setAlreadyCompleted(true)
    
    // Save to localStorage
    saveCompletion(correct)
    
    // Award XP to logged in user
    await awardXP(correct)
    
    // Play sound effect
    if (correct) {
      sounds.correct()
    } else {
      sounds.wrong()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6 card-hover"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <TargetIcon size={24} className="text-electric-lime" />
          Daily Challenge
        </h2>
        <span className="text-xs text-muted bg-surface px-3 py-1 rounded-full">
          Resets in {countdown !== null ? formatCountdown(countdown) : '--h --m --s'}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Player Image - Blurred */}
        <div className="relative aspect-square max-w-[250px] mx-auto">
          <div 
            className="w-full h-full rounded-2xl bg-gunmetal overflow-hidden flex items-center justify-center"
            style={{ filter: `blur(${dailyPlayer.blurLevel}px)` }}
          >
            <img
              src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${dailyPlayer.id}.png`}
              alt="Mystery Player"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-player.svg'
              }}
            />
          </div>
          {!revealed && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gunmetal/80 flex items-center justify-center">
                <QuestionIcon size={40} className="text-electric-lime" />
              </div>
            </div>
          )}
        </div>

        {/* Guess Section */}
        <div className="flex flex-col justify-center">
          <div className="mb-4">
            <h3 className="text-sm text-muted mb-2">HINT</h3>
            <p className="text-ghost-white font-medium">{dailyPlayer.hint}</p>
          </div>

          {!revealed ? (
            <div className="space-y-3">
              <input
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="Type player name..."
                className="w-full px-4 py-3 bg-gunmetal border border-surface rounded-xl text-ghost-white placeholder-muted focus:outline-none focus:border-electric-lime transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
                autoComplete="off"
              />
              <button
                onClick={handleGuess}
                className="w-full py-3 bg-electric-lime text-deep-void font-bold rounded-xl hover:bg-green-400 transition-colors neon-button"
              >
                Submit Guess
              </button>
              {!user && (
                <p className="text-xs text-muted text-center">Sign in to earn XP!</p>
              )}
            </div>
          ) : (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`p-4 rounded-xl text-center ${
                isCorrect ? 'bg-electric-lime/20 border border-electric-lime' : 'bg-hot-pink/20 border border-hot-pink'
              }`}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                {isCorrect ? (
                  <>
                    <ConfettiIcon size={24} className="text-electric-lime" />
                    <p className="text-lg font-bold text-electric-lime">Correct!</p>
                  </>
                ) : (
                  <>
                    <XIcon size={24} className="text-hot-pink" />
                    <p className="text-lg font-bold text-hot-pink">Not quite!</p>
                  </>
                )}
              </div>
              <p className="text-sm text-ghost-white">
                The answer was <span className="font-bold">{dailyPlayer.name}</span>
              </p>
              {user && (
                <p className="text-xs text-electric-lime mt-2">
                  +{isCorrect ? DAILY_CHALLENGE_XP : Math.floor(DAILY_CHALLENGE_XP / 2)} XP earned!
                </p>
              )}
              {alreadyCompleted && (
                <p className="text-xs text-muted mt-2">
                  Come back tomorrow for a new challenge!
                </p>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
