'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { TargetIcon, QuestionIcon, CheckIcon, XIcon, ConfettiIcon } from '@/components/icons'
import { sounds } from '@/lib/sounds'

export function DailyChallenge() {
  const [guess, setGuess] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)

  // Mock data - will be replaced with actual API call
  const dailyPlayer = {
    id: 203507,
    name: 'Giannis Antetokounmpo',
    team: 'MIL',
    hint: 'Greek Freak, 2x MVP, Averages 30+ PPG',
    blurLevel: revealed ? 0 : 20,
  }

  const handleGuess = () => {
    const guessLower = guess.toLowerCase().trim()
    const nameParts = dailyPlayer.name.toLowerCase().split(' ')
    const firstName = nameParts[0]
    const lastName = nameParts[nameParts.length - 1]
    
    const correct = guessLower.includes(firstName) || 
                   guessLower.includes(lastName) ||
                   guessLower === dailyPlayer.name.toLowerCase()
    
    setIsCorrect(correct)
    setRevealed(true)
    
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
          Resets in 14h 23m
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
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
