'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeftIcon, ArrowRightIcon, CompareIcon } from '@/components/icons'
import { BasketballLoader } from '@/components/ui/BasketballLoader'
import { useKeyboardControls } from '@/hooks/useKeyboardControls'
import { FALLBACK_STAR_PLAYERS, GamePlayer, useStarPlayers } from '@/hooks/useGamePlayers'
import { sounds } from '@/lib/sounds'
import { saveGameScore, supabase } from '@/lib/supabase'
import { useSettingsStore } from '@/store/settingsStore'
import { useSessionDataStore } from '@/store/sessionDataStore'

const SILHOUETTE_URL =
  'https://th.bing.com/th/id/R.2855dc2b9d9f849e227dbe9f73642b27?rik=%2bcUVqCXHhW1S%2bA&riu=http%3a%2f%2fgetdrawings.com%2fimg%2fmale-silhouette-head-31.png&ehk=yxlY0knr%2bEmdM%2baGFVqzo0zaLgigbwObIl%2bXINZzWJ0%3d&risl=&pid=ImgRaw&r=0'

interface EraSnapshot {
  id: string
  playerId: number
  name: string
  team: string
  timeframe: string
  ppg: number
  apg: number
  rpg: number
  threePtPct: number
  fgPct: number
}

interface Comparison {
  playerA: EraSnapshot
  playerB: EraSnapshot
}

const ERA_SNAPSHOTS: EraSnapshot[] = [
  { id: 'paul-george-2017-playoffs', playerId: 202331, name: 'Paul George', team: 'IND', timeframe: '2017 Playoffs', ppg: 28.0, apg: 7.3, rpg: 8.8, threePtPct: 42.9, fgPct: 44.7 },
  { id: 'curry-2017-playoffs', playerId: 201939, name: 'Stephen Curry', team: 'GSW', timeframe: '2017 Playoffs', ppg: 28.1, apg: 6.7, rpg: 6.2, threePtPct: 41.0, fgPct: 48.4 },
  { id: 'lebron-2018-finals', playerId: 2544, name: 'LeBron James', team: 'CLE', timeframe: '2018 Finals', ppg: 34.0, apg: 10.0, rpg: 8.5, threePtPct: 35.3, fgPct: 52.7 },
  { id: 'durant-2018-finals', playerId: 201142, name: 'Kevin Durant', team: 'GSW', timeframe: '2018 Finals', ppg: 28.8, apg: 7.5, rpg: 10.8, threePtPct: 40.9, fgPct: 52.6 },
  { id: 'kobe-2010-finals', playerId: 977, name: 'Kobe Bryant', team: 'LAL', timeframe: '2010 Finals', ppg: 28.6, apg: 3.9, rpg: 8.0, threePtPct: 31.6, fgPct: 40.5 },
  { id: 'wade-2006-finals', playerId: 2548, name: 'Dwyane Wade', team: 'MIA', timeframe: '2006 Finals', ppg: 34.7, apg: 3.8, rpg: 7.8, threePtPct: 27.3, fgPct: 46.8 },
  { id: 'rose-2011-season', playerId: 201565, name: 'Derrick Rose', team: 'CHI', timeframe: '2011 MVP Season', ppg: 25.0, apg: 7.7, rpg: 4.1, threePtPct: 33.2, fgPct: 44.5 },
  { id: 'harden-2018-season', playerId: 201935, name: 'James Harden', team: 'HOU', timeframe: '2018 MVP Season', ppg: 30.4, apg: 8.8, rpg: 5.4, threePtPct: 36.7, fgPct: 44.9 },
  { id: 'kawhi-2019-finals', playerId: 202695, name: 'Kawhi Leonard', team: 'TOR', timeframe: '2019 Finals', ppg: 28.5, apg: 4.2, rpg: 9.8, threePtPct: 35.7, fgPct: 43.4 },
  { id: 'giannis-2021-finals', playerId: 203507, name: 'Giannis Antetokounmpo', team: 'MIL', timeframe: '2021 Finals', ppg: 35.2, apg: 5.0, rpg: 13.2, threePtPct: 20.0, fgPct: 61.8 },
  { id: 'jokic-2023-finals', playerId: 203999, name: 'Nikola Jokic', team: 'DEN', timeframe: '2023 Finals', ppg: 30.2, apg: 7.2, rpg: 14.0, threePtPct: 42.1, fgPct: 58.3 },
  { id: 'butler-2020-finals', playerId: 202710, name: 'Jimmy Butler', team: 'MIA', timeframe: '2020 Finals', ppg: 26.2, apg: 9.8, rpg: 8.3, threePtPct: 26.9, fgPct: 55.2 },
  { id: 'tatum-2022-playoffs', playerId: 1628369, name: 'Jayson Tatum', team: 'BOS', timeframe: '2022 Playoffs', ppg: 26.9, apg: 6.2, rpg: 6.7, threePtPct: 39.3, fgPct: 42.6 },
  { id: 'brown-2022-playoffs', playerId: 1627759, name: 'Jaylen Brown', team: 'BOS', timeframe: '2022 Playoffs', ppg: 23.1, apg: 3.5, rpg: 6.9, threePtPct: 37.3, fgPct: 47.0 },
  { id: 'lillard-2019-playoffs', playerId: 203081, name: 'Damian Lillard', team: 'POR', timeframe: '2019 Playoffs', ppg: 26.9, apg: 6.6, rpg: 4.8, threePtPct: 37.7, fgPct: 41.8 },
  { id: 'booker-2021-playoffs', playerId: 1626164, name: 'Devin Booker', team: 'PHX', timeframe: '2021 Playoffs', ppg: 27.3, apg: 4.5, rpg: 5.6, threePtPct: 32.1, fgPct: 44.7 },
  { id: 'paul-2021-playoffs', playerId: 101108, name: 'Chris Paul', team: 'PHX', timeframe: '2021 Playoffs', ppg: 19.2, apg: 8.6, rpg: 3.5, threePtPct: 44.6, fgPct: 48.9 },
  { id: 'dirk-2011-finals', playerId: 1717, name: 'Dirk Nowitzki', team: 'DAL', timeframe: '2011 Finals', ppg: 26.0, apg: 2.0, rpg: 9.7, threePtPct: 36.8, fgPct: 41.6 },
  { id: 'duncan-2003-finals', playerId: 1495, name: 'Tim Duncan', team: 'SAS', timeframe: '2003 Finals', ppg: 24.2, apg: 5.3, rpg: 17.0, threePtPct: 0.0, fgPct: 49.5 },
  { id: 'kyrie-2016-finals', playerId: 202681, name: 'Kyrie Irving', team: 'CLE', timeframe: '2016 Finals', ppg: 27.1, apg: 3.9, rpg: 3.9, threePtPct: 40.5, fgPct: 46.8 },
  { id: 'brunson-2024-playoffs', playerId: 1628973, name: 'Jalen Brunson', team: 'NYK', timeframe: '2024 Playoffs', ppg: 32.4, apg: 7.5, rpg: 3.3, threePtPct: 31.0, fgPct: 44.4 },
  { id: 'edwards-2024-playoffs', playerId: 1630162, name: 'Anthony Edwards', team: 'MIN', timeframe: '2024 Playoffs', ppg: 27.6, apg: 5.9, rpg: 6.5, threePtPct: 40.0, fgPct: 48.1 },
  { id: 'haliburton-2024-playoffs', playerId: 1630169, name: 'Tyrese Haliburton', team: 'IND', timeframe: '2024 Playoffs', ppg: 18.7, apg: 8.2, rpg: 4.8, threePtPct: 37.9, fgPct: 48.8 },
]

function buildCurrentSeasonSnapshots(players: GamePlayer[]): EraSnapshot[] {
  return players.slice(0, 24).map((player) => {
    const fgPct = Math.min(58, Math.max(41, 42 + (player.rating - 72) * 0.5))
    const threePtPct = Math.min(45, Math.max(30, 31 + (player.rating - 72) * 0.45))

    return {
      id: `current-${player.id}`,
      playerId: player.id,
      name: player.name,
      team: player.team,
      timeframe: 'Current Season',
      ppg: Number(player.ppg.toFixed(1)),
      apg: Number(player.apg.toFixed(1)),
      rpg: Number(player.rpg.toFixed(1)),
      threePtPct: Number(threePtPct.toFixed(1)),
      fgPct: Number(fgPct.toFixed(1)),
    }
  })
}

function getRecentSnapshotIds(): string[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = sessionStorage.getItem('wyr-recent-snapshot-ids')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function setRecentSnapshotIds(ids: string[]) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem('wyr-recent-snapshot-ids', JSON.stringify(ids.slice(-28)))
}

function shouldShowBothRows(player: EraSnapshot): boolean {
  return Math.abs(player.apg - player.rpg) < 2
}

function shootingEdgeExists(a: EraSnapshot, b: EraSnapshot): boolean {
  return Math.abs(a.threePtPct - b.threePtPct) >= 1 || Math.abs(a.fgPct - b.fgPct) >= 1
}

function isTooIdentical(a: EraSnapshot, b: EraSnapshot): boolean {
  return (
    Math.abs(a.ppg - b.ppg) < 0.15 &&
    Math.abs(a.apg - b.apg) < 0.15 &&
    Math.abs(a.rpg - b.rpg) < 0.15
  )
}

function pairScore(a: EraSnapshot, b: EraSnapshot): number {
  const ppgDiff = Math.abs(a.ppg - b.ppg)
  const apgDiff = Math.abs(a.apg - b.apg)
  const rpgDiff = Math.abs(a.rpg - b.rpg)
  const threeDiff = Math.abs(a.threePtPct - b.threePtPct)
  const fgDiff = Math.abs(a.fgPct - b.fgPct)

  const diffPenalty = ppgDiff * 2.4 + apgDiff * 1.6 + rpgDiff * 1.5 + threeDiff * 1.0 + fgDiff * 0.9
  const tinyDiffPenalty = (ppgDiff < 0.25 ? 3 : 0) + (apgDiff < 0.2 ? 2 : 0) + (rpgDiff < 0.2 ? 2 : 0)

  return diffPenalty + tinyDiffPenalty
}

function isValidPair(a: EraSnapshot, b: EraSnapshot): boolean {
  if (a.playerId === b.playerId) return false
  if (isTooIdentical(a, b)) return false

  const ppgDiff = Math.abs(a.ppg - b.ppg)
  const apgDiff = Math.abs(a.apg - b.apg)
  const rpgDiff = Math.abs(a.rpg - b.rpg)

  if (ppgDiff > 6.5 || apgDiff > 4.5 || rpgDiff > 4.5) return false

  const closeAllAround = ppgDiff < 2.6 && apgDiff < 2 && rpgDiff < 2
  if (closeAllAround && !shootingEdgeExists(a, b)) return false

  return true
}

function generateMatchups(players: GamePlayer[], roundCount: number): Comparison[] {
  const allSnapshots = [...ERA_SNAPSHOTS, ...buildCurrentSeasonSnapshots(players)]
  if (allSnapshots.length < roundCount * 2) return []

  const recentSet = new Set(getRecentSnapshotIds())
  const freshPool = allSnapshots.filter((snapshot) => !recentSet.has(snapshot.id))
  const sourcePool = freshPool.length >= roundCount * 2 ? freshPool : allSnapshots
  const shuffled = [...sourcePool].sort(() => Math.random() - 0.5)

  const usedPlayerIds = new Set<number>()
  const usedSnapshotIds: string[] = []
  const matchups: Comparison[] = []

  for (let i = 0; i < shuffled.length && matchups.length < roundCount; i++) {
    const anchor = shuffled[i]
    if (usedPlayerIds.has(anchor.playerId)) continue

    let bestCandidate: EraSnapshot | null = null
    let bestScore = Number.POSITIVE_INFINITY

    for (let j = i + 1; j < shuffled.length; j++) {
      const candidate = shuffled[j]
      if (usedPlayerIds.has(candidate.playerId)) continue
      if (!isValidPair(anchor, candidate)) continue

      const score = pairScore(anchor, candidate)
      if (score < bestScore) {
        bestScore = score
        bestCandidate = candidate
      }
    }

    if (!bestCandidate) continue

    matchups.push({ playerA: anchor, playerB: bestCandidate })
    usedPlayerIds.add(anchor.playerId)
    usedPlayerIds.add(bestCandidate.playerId)
    usedSnapshotIds.push(anchor.id, bestCandidate.id)
  }

  if (matchups.length < roundCount) {
    const topUpPool = [...allSnapshots].sort(() => Math.random() - 0.5)
    for (let i = 0; i < topUpPool.length && matchups.length < roundCount; i++) {
      const a = topUpPool[i]
      if (usedPlayerIds.has(a.playerId)) continue

      for (let j = i + 1; j < topUpPool.length && matchups.length < roundCount; j++) {
        const b = topUpPool[j]
        if (usedPlayerIds.has(b.playerId)) continue
        if (!isValidPair(a, b)) continue

        matchups.push({ playerA: a, playerB: b })
        usedPlayerIds.add(a.playerId)
        usedPlayerIds.add(b.playerId)
        usedSnapshotIds.push(a.id, b.id)
      }
    }
  }

  if (usedSnapshotIds.length > 0) {
    setRecentSnapshotIds([...getRecentSnapshotIds(), ...usedSnapshotIds])
  }

  return matchups
}

export default function BlindComparisonPage() {
  const { soundEnabled } = useSettingsStore()
  const { players: supabasePlayers, loading, error } = useStarPlayers(20)
  const allPlayers = supabasePlayers.length >= 2 ? supabasePlayers : FALLBACK_STAR_PLAYERS

  const [matchups, setMatchups] = useState<Comparison[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<'A' | 'B' | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [choicesMade, setChoicesMade] = useState(0)
  const [choiceHistory, setChoiceHistory] = useState<Array<'A' | 'B'>>([])
  const [gameOver, setGameOver] = useState(false)
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now())
  const [avgDecisionTime, setAvgDecisionTime] = useState<number>(0)

  const currentComparison = useMemo(
    () => matchups[currentIndex],
    [currentIndex, matchups]
  )

  const initGame = () => {
    const rounds = generateMatchups(allPlayers, 5)
    setMatchups(rounds)
    setCurrentIndex(0)
    setSelected(null)
    setRevealed(false)
    setScore(0)
    setChoicesMade(0)
    setChoiceHistory([])
    setGameOver(false)
    setGameStartTime(Date.now())
  }

  useEffect(() => {
    if (allPlayers.length >= 2) {
      initGame()
      if (soundEnabled) sounds.startGame()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPlayers.length])

  useEffect(() => {
    if (soundEnabled && matchups.length > 0 && !gameOver) {
      sounds.startGameMusicLoop()
      return
    }
    sounds.stopGameMusicLoop()
  }, [soundEnabled, matchups.length, gameOver])

  useEffect(() => {
    return () => {
      sounds.stopGameMusicLoop()
    }
  }, [])

  useKeyboardControls({
    onEnter: () => {
      if (!gameOver && revealed) nextRound()
    },
    onArrowLeft: () => {
      if (!revealed && !gameOver) handleSelect('A')
    },
    onArrowRight: () => {
      if (!revealed && !gameOver) handleSelect('B')
    },
    onNumber: (num) => {
      if (!revealed && !gameOver) {
        if (num === 1) handleSelect('A')
        if (num === 2) handleSelect('B')
      }
    },
    enabled: true,
  })

  const handleSelect = (choice: 'A' | 'B') => {
    if (!currentComparison || revealed || gameOver) return

    setSelected(choice)
    setRevealed(true)
    setScore((prev) => prev + 100)
    setChoicesMade((prev) => prev + 1)
    setChoiceHistory((prev) => [...prev, choice])

    if (soundEnabled) sounds.click()
  }

  const nextRound = async () => {
    if (currentIndex >= matchups.length - 1) {
      const totalSeconds = Math.max(1, Math.round((Date.now() - gameStartTime) / 1000))
      setAvgDecisionTime(Math.max(1, Math.round(totalSeconds / Math.max(1, choicesMade))))
      setGameOver(true)
      await saveScore()
      if (soundEnabled) sounds.victory()
      return
    }

    setCurrentIndex((prev) => prev + 1)
    setSelected(null)
    setRevealed(false)
    if (soundEnabled) sounds.click()
  }

  const saveScore = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const duration = Math.max(1, Math.round((Date.now() - gameStartTime) / 1000))
      await saveGameScore({
        user_id: user.id,
        game_type: 'blind-comparison',
        score,
        correct_answers: choicesMade,
        questions_answered: 5,
        time_taken: duration,
      })
      await useSessionDataStore.getState().refreshStats()
    } catch (err) {
      console.error('Error saving score:', err)
    }
  }

  const StatCard = ({ player, label, isRevealed }: { player: EraSnapshot; label: string; isRevealed: boolean }) => {
    const showBoth = shouldShowBothRows(player)
    const primaryLabel = player.apg >= player.rpg ? 'APG' : 'RPG'
    const primaryValue = player.apg >= player.rpg ? player.apg : player.rpg

    return (
      <motion.div
        whileHover={!revealed ? { scale: 1.02 } : {}}
        className={`card-neon p-6 cursor-pointer ${
          selected === label
            ? 'ring-2 ring-electric-lime'
            : 'hover:border-electric-lime'
        }`}
        onClick={() => !revealed && handleSelect(label as 'A' | 'B')}
      >
        <div className="text-center mb-6">
          <p className="text-3xl font-black text-electric-lime mb-2">PLAYER {label}</p>
          {!isRevealed ? (
            <img src={SILHOUETTE_URL} alt="Player silhouette" className="w-20 h-20 mx-auto opacity-60" />
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="font-bold text-lg text-electric-lime">{player.name}</p>
              <p className="text-sm text-muted">{player.team} • {player.timeframe}</p>
            </motion.div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-surface">
            <span className="text-muted">PPG</span>
            <span className="font-bold text-xl">{player.ppg.toFixed(1)}</span>
          </div>

          {showBoth ? (
            <>
              <div className="flex justify-between items-center py-2 border-b border-surface">
                <span className="text-muted">APG</span>
                <span className="font-bold text-xl">{player.apg.toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-surface">
                <span className="text-muted">RPG</span>
                <span className="font-bold text-xl">{player.rpg.toFixed(1)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between items-center py-2 border-b border-surface">
              <span className="text-muted">{primaryLabel}</span>
              <span className="font-bold text-xl">{primaryValue.toFixed(1)}</span>
            </div>
          )}

          <div className="flex justify-between items-center py-2 border-b border-surface">
            <span className="text-muted">3PT%</span>
            <span className="font-bold text-xl">{player.threePtPct.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-muted">FG%</span>
            <span className="font-bold text-xl">{player.fgPct.toFixed(1)}%</span>
          </div>
        </div>
      </motion.div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <BasketballLoader />
      </div>
    )
  }

  if (error && supabasePlayers.length < 2) {
    console.warn('Using fallback players due to fetch error:', error)
  }

  if (!currentComparison && !gameOver) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <BasketballLoader />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-6xl mx-auto px-4">
        <Link href="/play" className="inline-flex items-center gap-2 text-muted hover:text-electric-lime transition-colors mb-6">
          <ArrowLeftIcon /> Back to Games
        </Link>

        {!gameOver && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-5xl font-black mb-2">
                WOULD YOU <span className="text-electric-lime">RATHER HAVE</span>
              </h1>
              <p className="text-muted">If you are the GM would you rather have player A or player B</p>
              <p className="text-sm text-muted mt-2">Round {currentIndex + 1} of 5</p>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center"
              >
                <StatCard player={currentComparison.playerA} label="A" isRevealed={revealed} />

                <div className="text-center">
                  <CompareIcon className="w-12 h-12 text-electric-lime mx-auto" />
                </div>

                <StatCard player={currentComparison.playerB} label="B" isRevealed={revealed} />
              </motion.div>
            </AnimatePresence>

            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 text-center"
              >
                <p className="text-lg mb-4">
                  You picked <span className="text-electric-lime font-bold">Player {selected}</span>
                </p>
                <button onClick={nextRound} className="btn-neon-primary inline-flex items-center gap-2">
                  {currentIndex >= matchups.length - 1 ? 'Finish Game' : 'Next Round'} <ArrowRightIcon />
                </button>
              </motion.div>
            )}
          </>
        )}

        {gameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl border border-surface/70 p-8 md:p-10 text-center max-w-4xl mx-auto"
          >
            <h2 className="text-5xl font-black text-ghost-white mb-3">Game Complete!</h2>
            <p className="text-muted text-xl mb-8">No wrong answer, just your preferred profile.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-gunmetal/80 rounded-2xl p-6 border border-surface">
                <p className="text-muted text-2xl mb-2">Choices</p>
                <p className="text-electric-lime text-5xl font-black">{choicesMade}/{matchups.length}</p>
              </div>
              <div className="bg-gunmetal/80 rounded-2xl p-6 border border-surface">
                <p className="text-muted text-2xl mb-2">Avg Time</p>
                <p className="text-ghost-white text-5xl font-black">{avgDecisionTime}s</p>
              </div>
            </div>

            <p className="text-muted text-3xl mb-8">Ball Knower!</p>

            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={initGame}
                className="px-8 py-3 bg-electric-lime text-deep-void font-bold rounded-xl hover:bg-green-400 transition-colors"
              >
                Play Again
              </button>
              <Link href="/play" className="inline-block px-8 py-3 bg-surface text-ghost-white font-bold rounded-xl hover:bg-muted/30 transition-colors">
                Back to Games
              </Link>
            </div>

            {choiceHistory.length > 0 && (
              <div className="mt-8 pt-6 border-t border-surface">
                <p className="text-sm text-muted mb-2">Pick history</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {choiceHistory.map((pick, i) => (
                    <span
                      key={`${pick}-${i}`}
                      className="px-3 py-1 rounded-full bg-surface border border-surface text-sm"
                    >
                      R{i + 1}: {pick}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
