'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { TrophyIcon, ArrowLeftIcon, ArrowRightIcon, CheckIcon, XIcon } from '@/components/icons'
import { useKeyboardControls } from '@/hooks/useKeyboardControls'
import { sounds } from '@/lib/sounds'
import { useSettingsStore } from '@/store/settingsStore'
import { checkGuess } from '@/lib/nameMatch'
import { supabase, saveGameScore } from '@/lib/supabase'
import { useSessionDataStore } from '@/store/sessionDataStore'

interface ResumeEntry {
  id: number
  name: string
  accolades: string[]
}

const ROUND_COUNT = 5

const AccoladeIcon = ({ text }: { text: string }) => {
  const lower = text.toLowerCase()

  if (lower.includes('all-defensive') || lower.includes('dpoy')) {
    return (
      <span className="w-7 h-7 rounded-full bg-cyan-500/15 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_10px_rgba(34,211,238,0.25)]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-300">
          <path d="M12 2l8 4v6c0 5-3.5 8.7-8 10-4.5-1.3-8-5-8-10V6l8-4z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </span>
    )
  }

  if (lower.includes('champ')) {
    return (
      <span className="w-6 h-6 rounded-full bg-yellow-500/15 border border-yellow-400/40 flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M6 2h12v7a6 6 0 0 1-12 0V2z" />
          <path d="M9 21h6" />
          <path d="M12 15v6" />
        </svg>
      </span>
    )
  }

  if (lower.includes('mvp')) {
    return (
      <span className="w-6 h-6 rounded-full bg-electric-lime/15 border border-electric-lime/40 flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-electric-lime">
          <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1L12 2z" />
        </svg>
      </span>
    )
  }

  if (lower.includes('all-star')) {
    return (
      <span className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-400/40 flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-300">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v12M6 12h12" />
        </svg>
      </span>
    )
  }

  return (
    <span className="w-6 h-6 rounded-full bg-surface border border-gunmetal flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    </span>
  )
}

const STATIC_RESUME_POOL: ResumeEntry[] = [
  { id: 2544, name: 'LeBron James', accolades: ['4x NBA Champion', '4x MVP', '4x Finals MVP', '20x All-Star', '19x All-NBA Team'] },
  { id: 977, name: 'Kobe Bryant', accolades: ['5x NBA Champion', '1x MVP', '2x Finals MVP', '18x All-Star', '2x Scoring Champion'] },
  { id: 201565, name: 'Derrick Rose', accolades: ['1x MVP', '3x All-Star', 'Rookie of the Year', 'All-NBA First Team', 'Youngest MVP in NBA history'] },
  { id: 1627770, name: 'Patrick McCaw', accolades: ['3x NBA Champion'] },
  { id: 1495, name: 'Tim Duncan', accolades: ['5x NBA Champion', '2x MVP', '3x Finals MVP', '15x All-Star', '15x All-Defensive Team'] },
  { id: 1717, name: 'Dirk Nowitzki', accolades: ['1x NBA Champion', '1x MVP', '1x Finals MVP', '14x All-Star', '12x All-NBA Team'] },
  { id: 2548, name: 'Dwyane Wade', accolades: ['3x NBA Champion', '1x Finals MVP', '13x All-Star', 'Scoring Champion', 'All-NBA First Team'] },
  { id: 203999, name: 'Nikola Jokic', accolades: ['3x MVP', '1x NBA Champion', '1x Finals MVP', 'All-NBA First Team selections', 'All-Star selections'] },
  { id: 203507, name: 'Giannis Antetokounmpo', accolades: ['2x MVP', '1x NBA Champion', '1x Finals MVP', '1x DPOY', 'Most Improved Player'] },
  { id: 201939, name: 'Stephen Curry', accolades: ['4x NBA Champion', '2x MVP', '1x Finals MVP', '2x Scoring Champion', 'All-time 3PT made leader'] },
  { id: 1629029, name: 'Luka Doncic', accolades: ['Rookie of the Year', 'All-NBA First Team selections', 'All-Star selections', 'Scoring title winner'] },
  { id: 202681, name: 'Kyrie Irving', accolades: ['1x NBA Champion', 'Rookie of the Year', '9x All-Star', 'All-NBA selections', '50-40-90 season'] },
  { id: 201142, name: 'Kevin Durant', accolades: ['2x NBA Champion', '2x Finals MVP', '1x MVP', '14x All-Star', '4x Scoring Champion'] },
  { id: 202331, name: 'Paul George', accolades: ['9x All-Star', 'All-NBA selections', 'All-Defensive Team selections', 'Most Improved Player'] },
  { id: 1628369, name: 'Jayson Tatum', accolades: ['All-Star selections', 'All-NBA First Team selection', 'Eastern Conference Finals MVP'] },
  { id: 1627759, name: 'Jaylen Brown', accolades: ['4x All-Star', 'All-NBA selection', 'Eastern Conference Finals MVP', 'NBA Finals MVP', 'NBA Champion'] },
  { id: 203081, name: 'Damian Lillard', accolades: ['8x All-Star', '7x All-NBA Team', 'Rookie of the Year', '3PT Contest Champion'] },
  { id: 1626164, name: 'Devin Booker', accolades: ['4x All-Star', 'All-NBA First Team', 'All-NBA selection'] },
  { id: 203076, name: 'Anthony Davis', accolades: ['NBA Champion', '9x All-Star', 'All-NBA selections', 'All-Defensive Team selections'] },
  { id: 203954, name: 'Joel Embiid', accolades: ['1x MVP', 'Scoring titles', 'All-NBA selections', 'All-Defensive Team selection', 'All-Star appearances'] },
  { id: 1629027, name: 'Trae Young', accolades: ['All-Star selections', 'All-NBA Third Team', 'Assist title winner'] },
  { id: 202695, name: 'Kawhi Leonard', accolades: ['2x NBA Champion', '2x Finals MVP', '2x DPOY', 'All-NBA selections', 'All-Defensive Team selections'] },
  { id: 1629026, name: 'Shai Gilgeous-Alexander', accolades: ['1x MVP', 'All-NBA First Team selections', 'All-Star selections', 'Scoring title winner'] },
  { id: 1628989, name: 'Tyrese Haliburton', accolades: ['All-Star selections', 'All-NBA Third Team', 'Assist title winner'] },
  { id: 203952, name: 'Andrew Wiggins', accolades: ['1x NBA Champion', '1x All-Star'] },
  { id: 1628368, name: 'DeAaron Fox', accolades: ['All-Star selection', 'All-NBA Team selection', 'Clutch Player of the Year'] },
  { id: 1626179, name: 'Terry Rozier', accolades: ['All-Rookie Second Team'] },
  { id: 1629028, name: 'RJ Barrett', accolades: ['All-Rookie First Team'] },
  { id: 1627742, name: 'Brandon Ingram', accolades: ['All-Star selection', 'Most Improved Player'] },
  { id: 203078, name: 'Bradley Beal', accolades: ['All-Star selections', 'All-NBA Third Team'] },
  { id: 202710, name: 'Jimmy Butler', accolades: ['All-Star selections', 'All-NBA selections', 'All-Defensive Team selections', 'Eastern Conference Finals MVP'] },
  { id: 1626157, name: 'Karl-Anthony Towns', accolades: ['All-Star selections', 'All-NBA selections', 'Rookie of the Year', '3PT Contest Champion'] },
  { id: 203114, name: 'Khris Middleton', accolades: ['NBA Champion', 'All-Star selections'] },
  { id: 1628389, name: 'Bam Adebayo', accolades: ['All-Star selections', 'All-Defensive Team selections'] },
  { id: 203935, name: 'Marcus Smart', accolades: ['1x DPOY', 'All-Defensive Team selections'] },
  { id: 1628384, name: 'Lauri Markkanen', accolades: ['All-Star selection', 'Most Improved Player'] },
  { id: 1627736, name: 'Buddy Hield', accolades: ['3PT Contest Champion'] },
  { id: 201588, name: 'George Hill', accolades: ['NBA Champion'] },
  { id: 203903, name: 'Jordan Clarkson', accolades: ['6th Man of the Year'] },
]

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}

function getRecentResumeIds(): number[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = sessionStorage.getItem('resume-check-recent-ids')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function setRecentResumeIds(ids: number[]) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem('resume-check-recent-ids', JSON.stringify(ids.slice(-40)))
}

function getRandomRounds(pool: ResumeEntry[], count: number): ResumeEntry[] {
  const recent = new Set(getRecentResumeIds())
  const freshPool = pool.filter((entry) => !recent.has(entry.id))
  const source = freshPool.length >= count ? freshPool : pool
  const rounds = shuffle(source).slice(0, count)

  if (rounds.length > 0) {
    setRecentResumeIds([...getRecentResumeIds(), ...rounds.map((entry) => entry.id)])
  }

  return rounds
}

export default function ResumeCheckPage() {
  const { soundEnabled } = useSettingsStore()
  const pool = useMemo(() => STATIC_RESUME_POOL, [])

  const [gameStartTime, setGameStartTime] = useState(Date.now())
  const [rounds, setRounds] = useState<ResumeEntry[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [guess, setGuess] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [didPlayStartSfx, setDidPlayStartSfx] = useState(false)

  useEffect(() => {
    if (pool.length >= ROUND_COUNT && rounds.length === 0) {
      setRounds(getRandomRounds(pool, ROUND_COUNT))
    }
  }, [pool, rounds.length])

  useEffect(() => {
    if (!didPlayStartSfx && rounds.length > 0) {
      if (soundEnabled) sounds.startGame()
      setDidPlayStartSfx(true)
    }
  }, [didPlayStartSfx, rounds.length, soundEnabled])

  const current = rounds[currentIndex]
  const round = currentIndex + 1

  useEffect(() => {
    if (!revealed && !gameOver) {
      inputRef.current?.focus()
    }
  }, [currentIndex, revealed, gameOver])

  const progressPct = useMemo(() => Math.round((round / ROUND_COUNT) * 100), [round])

  useKeyboardControls({
    onEnter: () => {
      if (gameOver) return
      if (revealed) {
        handleNext()
      } else if (guess.trim().length > 1) {
        handleSubmit()
      }
    },
    enabled: true,
  })

  const saveResult = async (finalScore: number, finalCorrect: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const duration = Math.floor((Date.now() - gameStartTime) / 1000)
      await saveGameScore({
        user_id: user.id,
        game_type: 'resume-check',
        score: finalScore,
        correct_answers: finalCorrect,
        questions_answered: ROUND_COUNT,
        time_taken: duration,
      })
      await useSessionDataStore.getState().refreshStats()
    } catch (err) {
      console.error('Failed to save Resume Check score:', err)
    }
  }

  const handleSubmit = () => {
    if (!current || revealed) return
    if (soundEnabled) sounds.click()
    const correct = checkGuess(guess, current.name)
    setIsCorrect(correct)
    setRevealed(true)

    if (correct) {
      setScore((prev) => prev + 100)
      setCorrectCount((prev) => prev + 1)
      if (soundEnabled) sounds.gameCorrect(correctCount + 1, currentIndex >= ROUND_COUNT - 1)
    } else if (soundEnabled) {
      sounds.gameWrong()
    }
  }

  const handleNext = async () => {
    if (currentIndex >= ROUND_COUNT - 1) {
      setGameOver(true)
      if (soundEnabled) sounds.victory()
      await saveResult(score, correctCount)
      return
    }

    if (soundEnabled) sounds.click()
    setCurrentIndex((prev) => prev + 1)
    setGuess('')
    setRevealed(false)
    setIsCorrect(false)
  }

  const handlePlayAgain = () => {
    setRounds(getRandomRounds(pool, ROUND_COUNT))
    setGameStartTime(Date.now())
    setCurrentIndex(0)
    setGuess('')
    setRevealed(false)
    setIsCorrect(false)
    setScore(0)
    setCorrectCount(0)
    setGameOver(false)
    if (soundEnabled) sounds.startGame()
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  if (!current) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading resume pool...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
      <div className="flex items-center justify-between mb-6">
        <Link href="/play" className="text-muted hover:text-ghost-white transition-colors flex items-center gap-1">
          <ArrowLeftIcon size={16} /> Back to Games
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-muted">Round {round}/{ROUND_COUNT}</span>
          <span className="text-electric-lime font-bold">{score} pts</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-display font-bold text-center mb-2 flex items-center justify-center gap-2">
          <TrophyIcon size={28} className="text-purple-400" />
          <span>Resume </span>
          <span className="text-electric-lime">Check</span>
        </h1>
        <p className="text-center text-muted mb-6">Guess the player from their accolades.</p>

        <div className="h-2 bg-surface rounded-full overflow-hidden mb-6">
          <motion.div className="h-full bg-purple-400" initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} />
        </div>

        {!gameOver ? (
          <div className="card-neon p-8 rounded-2xl">
            <div className="text-center mb-6">
              <img src="/placeholder-player.svg" alt="Player" className="w-20 h-20 mx-auto opacity-60" />
            </div>
            <div className="space-y-3 mb-6 max-h-56 overflow-y-auto">
              {current.accolades.map((item, idx) => (
                <div key={item} className="flex items-center gap-3 py-2 px-3 border-b border-surface/30">
                  <AccoladeIcon text={item} />
                  <span className="text-electric-lime/80 text-xs font-semibold">{idx + 1}.</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {!revealed ? (
              <div className="space-y-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder="Type player name..."
                  className="w-full px-4 py-3 bg-surface border border-gunmetal rounded-xl text-ghost-white focus:border-electric-lime outline-none"
                  autoComplete="off"
                />
                <button
                  onClick={handleSubmit}
                  disabled={guess.trim().length < 2}
                  className="w-full py-3 bg-electric-lime text-deep-void font-bold rounded-xl disabled:opacity-50"
                >
                  Submit Guess
                </button>
              </div>
            ) : (
              <AnimatePresence>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                  <p className={`text-2xl font-bold mb-2 flex items-center justify-center gap-2 ${isCorrect ? 'text-electric-lime' : 'text-hot-pink'}`}>
                    {isCorrect ? <><CheckIcon size={22} /> Correct!</> : <><XIcon size={22} /> Not quite</>}
                  </p>
                  <p className="text-muted mb-4">It was <span className="font-bold text-ghost-white">{current.name}</span></p>
                  <button onClick={handleNext} className="px-8 py-3 bg-surface text-ghost-white font-bold rounded-xl hover:bg-muted/30 transition-colors inline-flex items-center gap-2">
                    {currentIndex >= ROUND_COUNT - 1 ? 'See Results' : 'Next Resume'} <ArrowRightIcon size={18} />
                  </button>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8 text-center">
            <h2 className="text-3xl font-display font-bold mb-4">Resume Complete!</h2>
            <p className="text-5xl font-display font-bold text-electric-lime mb-2">{score} points</p>
            <p className="text-muted mb-6">{correctCount}/{ROUND_COUNT} correct</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handlePlayAgain}
                className="px-8 py-3 bg-electric-lime text-deep-void font-bold rounded-xl hover:bg-green-400 transition-colors"
              >
                Play Again
              </button>
              <Link href="/play" className="inline-block px-8 py-3 bg-surface text-ghost-white font-bold rounded-xl hover:bg-muted/30 transition-colors">
                Back to Games
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
