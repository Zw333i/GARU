'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { sounds } from '@/lib/sounds'
import { useSettingsStore } from '@/store/settingsStore'
import { useKeyboardControls } from '@/hooks/useKeyboardControls'
import { TeamLogo } from '@/components/icons/TeamLogos'
import { PlayerImage } from '@/components/ui/PlayerImage'
import { JourneyIcon, CheckIcon, XIcon, ArrowRightIcon, ArrowLeftIcon } from '@/components/icons'
import { supabase, saveGameScore } from '@/lib/supabase'

// Journey data with REAL career paths
// Format: { teams: [DRAFTED_TEAM, ...career_path, CURRENT_TEAM], answer: 'Player Name', id: NBA_PLAYER_ID }
// First team = Draft team, Last team = Current team (2025-26 season)
// Includes current players AND legendary retired players for variety
const journeys = [
  // ========== ACTIVE PLAYERS (2025-26 Season) ==========
  
  // LeBron James: Drafted by CLE 2003, MIA 2010, CLE 2014, LAL 2018-present
  { teams: ['CLE', 'MIA', 'CLE', 'LAL'], answer: 'LeBron James', id: 2544 },
  
  // Kevin Durant: Drafted SEA/OKC 2007, GSW 2016, BKN 2019, PHX 2023-present
  { teams: ['OKC', 'GSW', 'BKN', 'PHX'], answer: 'Kevin Durant', id: 201142 },
  
  // James Harden: Drafted OKC 2009, HOU 2012, BKN 2021, PHI 2022, LAC 2023-present
  { teams: ['OKC', 'HOU', 'BKN', 'PHI', 'LAC'], answer: 'James Harden', id: 201935 },
  
  // Russell Westbrook: Drafted OKC 2008, HOU 2020, WAS 2021, LAL 2021, LAC 2022, DEN 2024, SAC 2025-present
  { teams: ['OKC', 'HOU', 'WAS', 'LAL', 'LAC', 'DEN', 'SAC'], answer: 'Russell Westbrook', id: 201566 },
  
  // Chris Paul: Drafted NOH 2005, LAC 2011, HOU 2017, OKC 2019, PHX 2020, WAS 2023, GSW 2024, SAS 2025-present
  { teams: ['NOP', 'LAC', 'HOU', 'OKC', 'PHX', 'GSW', 'SAS'], answer: 'Chris Paul', id: 101108 },
  
  // Kawhi Leonard: Drafted IND (traded to SAS) 2011, TOR 2018, LAC 2019-present
  { teams: ['SAS', 'TOR', 'LAC'], answer: 'Kawhi Leonard', id: 202695 },
  
  // Paul George: Drafted IND 2010, OKC 2017, LAC 2019, PHI 2024-present
  { teams: ['IND', 'OKC', 'LAC', 'PHI'], answer: 'Paul George', id: 202331 },
  
  // Kyrie Irving: Drafted CLE 2011, BOS 2017, BKN 2019, DAL 2023-present
  { teams: ['CLE', 'BOS', 'BKN', 'DAL'], answer: 'Kyrie Irving', id: 202681 },
  
  // Jimmy Butler: Drafted CHI 2011, MIN 2017, PHI 2018, MIA 2019-present
  { teams: ['CHI', 'MIN', 'PHI', 'MIA'], answer: 'Jimmy Butler', id: 202710 },
  
  // DeMar DeRozan: Drafted TOR 2009, SAS 2018, CHI 2021, SAC 2024-present
  { teams: ['TOR', 'SAS', 'CHI', 'SAC'], answer: 'DeMar DeRozan', id: 201942 },
  
  // Klay Thompson: Drafted GSW 2011, DAL 2024-present
  { teams: ['GSW', 'DAL'], answer: 'Klay Thompson', id: 202691 },
  
  // Damian Lillard: Drafted POR 2012, MIL 2023-present
  { teams: ['POR', 'MIL'], answer: 'Damian Lillard', id: 203081 },
  
  // Bradley Beal: Drafted WAS 2012, PHX 2023-present
  { teams: ['WAS', 'PHX'], answer: 'Bradley Beal', id: 203078 },
  
  // Jrue Holiday: Drafted PHI 2009, NOP 2013, MIL 2020, BOS 2023, POR 2025-present
  { teams: ['PHI', 'NOP', 'MIL', 'BOS', 'POR'], answer: 'Jrue Holiday', id: 201950 },
  
  // Pascal Siakam: Drafted TOR 2016, IND 2024-present
  { teams: ['TOR', 'IND'], answer: 'Pascal Siakam', id: 1627783 },
  
  // Stephen Curry: Drafted GSW 2009-present (one team journey - legendary!)
  { teams: ['GSW'], answer: 'Stephen Curry', id: 201939 },
  
  // Giannis Antetokounmpo: Drafted MIL 2013-present
  { teams: ['MIL'], answer: 'Giannis Antetokounmpo', id: 203507 },
  
  // Nikola Jokic: Drafted DEN 2014-present
  { teams: ['DEN'], answer: 'Nikola Jokic', id: 203999 },
  
  // ========== LEGENDARY RETIRED PLAYERS ==========
  
  // Derrick Rose: CHI 2008, NYK 2016, CLE 2017, MIN 2018, DET 2019, NYK 2020, MEM 2023 (Retired)
  { teams: ['CHI', 'NYK', 'CLE', 'MIN', 'DET', 'NYK', 'MEM'], answer: 'Derrick Rose', id: 201565 },
  
  // Dwight Howard: ORL 2004, LAL 2012, HOU 2013, ATL 2016, CHA 2017, WAS 2018, LAL 2019, PHI 2020, LAL 2021, TAI (Retired)
  { teams: ['ORL', 'LAL', 'HOU', 'ATL', 'CHA', 'WAS', 'LAL', 'PHI', 'LAL'], answer: 'Dwight Howard', id: 2730 },
  
  // Carmelo Anthony: DEN 2003, NYK 2011, OKC 2017, HOU 2018, POR 2019, LAL 2021 (Retired)
  { teams: ['DEN', 'NYK', 'OKC', 'HOU', 'POR', 'LAL'], answer: 'Carmelo Anthony', id: 2546 },
  
  // Dwyane Wade: MIA 2003, CHI 2016, CLE 2017, MIA 2018 (Retired)
  { teams: ['MIA', 'CHI', 'CLE', 'MIA'], answer: 'Dwyane Wade', id: 2548 },
  
  // Tony Parker: SAS 2001-2018, CHA 2019 (Retired)
  { teams: ['SAS', 'CHA'], answer: 'Tony Parker', id: 2225 },
  
  // Manu Ginobili: SAS 2002-2018 (Retired)
  { teams: ['SAS'], answer: 'Manu Ginobili', id: 1938 },
  
  // Dirk Nowitzki: DAL 1998-2019 (Retired - One team legend!)
  { teams: ['DAL'], answer: 'Dirk Nowitzki', id: 1717 },
  
  // Tim Duncan: SAS 1997-2016 (Retired - One team legend!)
  { teams: ['SAS'], answer: 'Tim Duncan', id: 1495 },
  
  // Kobe Bryant: LAL 1996-2016 (Retired - One team legend!)
  { teams: ['LAL'], answer: 'Kobe Bryant', id: 977 },
  
  // Vince Carter: TOR 1998, NJN 2004, ORL 2009, PHX 2010, DAL 2011, MEM 2014, SAC 2017, ATL 2018 (Retired)
  { teams: ['TOR', 'NJN', 'ORL', 'PHX', 'DAL', 'MEM', 'SAC', 'ATL'], answer: 'Vince Carter', id: 1713 },
  
  // Ray Allen: MIL 1996, SEA 2003, BOS 2007, MIA 2012 (Retired)
  { teams: ['MIL', 'SEA', 'BOS', 'MIA'], answer: 'Ray Allen', id: 951 },
  
  // Paul Pierce: BOS 1998, BKN 2013, WAS 2014, LAC 2015 (Retired)
  { teams: ['BOS', 'BKN', 'WAS', 'LAC'], answer: 'Paul Pierce', id: 1718 },
  
  // Kevin Garnett: MIN 1995, BOS 2007, BKN 2013, MIN 2015 (Retired)
  { teams: ['MIN', 'BOS', 'BKN', 'MIN'], answer: 'Kevin Garnett', id: 708 },
  
  // Allen Iverson: PHI 1996, DEN 2006, DET 2008, MEM 2009, PHI 2009 (Retired)
  { teams: ['PHI', 'DEN', 'DET', 'MEM', 'PHI'], answer: 'Allen Iverson', id: 947 },
  
  // Shaquille O'Neal: ORL 1992, LAL 1996, MIA 2004, PHX 2008, CLE 2009, BOS 2010 (Retired)
  { teams: ['ORL', 'LAL', 'MIA', 'PHX', 'CLE', 'BOS'], answer: "Shaquille O'Neal", id: 406 },
  
  // Steve Nash: PHX 1996, DAL 1998, PHX 2004, LAL 2012 (Retired)
  { teams: ['PHX', 'DAL', 'PHX', 'LAL'], answer: 'Steve Nash', id: 959 },
  
  // Jason Kidd: DAL 1994, PHX 1996, NJN 2001, DAL 2008, NYK 2012 (Retired)
  { teams: ['DAL', 'PHX', 'NJN', 'DAL', 'NYK'], answer: 'Jason Kidd', id: 429 },
  
  // Tracy McGrady: TOR 1997, ORL 2000, HOU 2004, NYK 2010, DET 2010, ATL 2011, SAS 2013 (Retired)
  { teams: ['TOR', 'ORL', 'HOU', 'NYK', 'DET', 'ATL', 'SAS'], answer: 'Tracy McGrady', id: 1503 },
  
  // Grant Hill: DET 1994, ORL 2000, PHX 2007, LAC 2012 (Retired)
  { teams: ['DET', 'ORL', 'PHX', 'LAC'], answer: 'Grant Hill', id: 228 },
  
  // Gary Payton: SEA 1990, MIL 2003, LAL 2003, BOS 2004, MIA 2005 (Retired)
  { teams: ['SEA', 'MIL', 'LAL', 'BOS', 'MIA'], answer: 'Gary Payton', id: 136 },
]

// Helper to check if guess matches player
const checkGuess = (guess: string, playerName: string): boolean => {
  const guessLower = guess.toLowerCase().trim()
  const nameParts = playerName.toLowerCase().split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ')
  const fullName = playerName.toLowerCase()
  
  return (
    guessLower === fullName ||
    guessLower === firstName ||
    guessLower === lastName ||
    fullName.includes(guessLower) ||
    (guessLower.length > 3 && fullName.includes(guessLower))
  )
}

export default function JourneyPage() {
  const { soundEnabled } = useSettingsStore()
  const [currentJourney, setCurrentJourney] = useState(journeys[0])
  const [guess, setGuess] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(1)
  const [visibleTeams, setVisibleTeams] = useState(1)
  const [usedJourneys, setUsedJourneys] = useState<number[]>([])
  const [gameOver, setGameOver] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [gameStartTime, setGameStartTime] = useState(Date.now())

  // Save score when game ends
  const saveScore = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const duration = Math.floor((Date.now() - gameStartTime) / 1000)
        await saveGameScore({
          user_id: user.id,
          game_type: 'the-journey',
          score: score,
          correct_answers: correctCount,
          questions_answered: 5,
          time_taken: duration
        })
      }
    } catch (err) {
      console.error('Error saving score:', err)
    }
  }

  // Keyboard controls: Enter = submit/next
  useKeyboardControls({
    onEnter: () => {
      if (gameOver) {
        window.location.reload()
      } else if (revealed) {
        nextRound()
      } else if (guess) {
        handleGuess()
      }
    },
    enabled: true,
  })

  const getRandomJourney = () => {
    const available = journeys.filter((_, i) => !usedJourneys.includes(i))
    if (available.length === 0) {
      setUsedJourneys([])
      const idx = Math.floor(Math.random() * journeys.length)
      return { journey: journeys[idx], index: idx }
    }
    const idx = Math.floor(Math.random() * available.length)
    const originalIdx = journeys.indexOf(available[idx])
    return { journey: available[idx], index: originalIdx }
  }

  useEffect(() => {
    const { journey, index } = getRandomJourney()
    setCurrentJourney(journey)
    setUsedJourneys([index])
    setVisibleTeams(1)
  }, [])

  useEffect(() => {
    // Animate teams appearing one by one
    if (!revealed && visibleTeams < currentJourney.teams.length) {
      const timer = setTimeout(() => {
        setVisibleTeams(v => v + 1)
        if (soundEnabled) sounds.reveal()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [visibleTeams, currentJourney.teams.length, revealed, soundEnabled])

  const handleGuess = () => {
    const correct = checkGuess(guess, currentJourney.answer)
    setIsCorrect(correct)
    if (correct) {
      setScore(score + 100)
      setCorrectCount(prev => prev + 1)
      if (soundEnabled) sounds.correct()
    } else {
      if (soundEnabled) sounds.wrong()
    }
    // Set guess to correct answer after reveal so it shows in the result
    setGuess(currentJourney.answer)
    setRevealed(true)
  }

  const nextRound = () => {
    if (round >= 5) {
      setGameOver(true)
      saveScore()
      if (soundEnabled) sounds.victory()
      return
    }
    const { journey, index } = getRandomJourney()
    setCurrentJourney(journey)
    setUsedJourneys(prev => [...prev, index])
    setGuess('')
    setRevealed(false)
    setIsCorrect(false)
    setVisibleTeams(1)
    setRound(round + 1)
    if (soundEnabled) sounds.click()
  }

  const restartGame = () => {
    const { journey, index } = getRandomJourney()
    setCurrentJourney(journey)
    setUsedJourneys([index])
    setGuess('')
    setRevealed(false)
    setIsCorrect(false)
    setVisibleTeams(1)
    setRound(1)
    setScore(0)
    setGameOver(false)
    setCorrectCount(0)
    setGameStartTime(Date.now())
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/play" className="flex items-center gap-2 text-muted hover:text-ghost-white transition-colors">
          <ArrowLeftIcon size={20} />
          <span>Back to Games</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-muted">Round {round}/5</span>
          <span className="text-electric-lime font-bold">{score} pts</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-center mb-2 flex items-center justify-center gap-3">
          <JourneyIcon className="text-blue-400" size={32} />
          The Journey
        </h1>
        <p className="text-center text-muted mb-2">
          Guess which player took this career path
        </p>
        <p className="text-center text-xs text-muted/70 mb-8">
          Draft team → Last/Current team
        </p>

        {!gameOver ? (
          <motion.div className="glass rounded-2xl p-6 md:p-8">
            {/* Team Path with SVG Logos */}
            <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap mb-6">
              {currentJourney.teams.map((team, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0, rotateY: 180 }}
                  animate={{ 
                    opacity: i < visibleTeams ? 1 : 0.2, 
                    scale: i < visibleTeams ? 1 : 0.7,
                    rotateY: i < visibleTeams ? 0 : 180
                  }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="flex items-center"
                >
                  <div className={`w-14 h-14 md:w-16 md:h-16 rounded-xl bg-gunmetal border-2 flex items-center justify-center overflow-hidden ${
                    i === 0 ? 'border-electric-lime' : i === currentJourney.teams.length - 1 ? 'border-blue-400' : 'border-surface'
                  }`}>
                    <TeamLogo team={team} size={40} />
                  </div>
                  {i < currentJourney.teams.length - 1 && (
                    <ArrowRightIcon className="text-muted mx-1 md:mx-2" size={16} />
                  )}
                </motion.div>
              ))}
            </div>

            {/* Team Labels */}
            <div className="flex justify-center gap-2 md:gap-4 mb-6 text-xs">
              {currentJourney.teams.slice(0, visibleTeams).map((team, i) => (
                <motion.span 
                  key={i} 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`px-2 py-1 rounded ${
                    i === 0 ? 'bg-electric-lime/20 text-electric-lime' : 
                    i === visibleTeams - 1 && visibleTeams === currentJourney.teams.length ? 'bg-blue-400/20 text-blue-400' : 
                    'bg-surface text-muted'
                  }`}
                >
                  {team} {i === 0 && '(Draft)'}
                </motion.span>
              ))}
            </div>

            {/* Guess Input or Result */}
            <AnimatePresence mode="wait">
              {!revealed ? (
                <motion.div
                  key="input"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <input
                    type="text"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    placeholder="Type player name..."
                    className="w-full px-4 py-3 bg-gunmetal border border-surface rounded-xl text-ghost-white placeholder-muted focus:outline-none focus:border-electric-lime transition-colors"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                  <button
                    onClick={handleGuess}
                    disabled={!guess}
                    className="w-full py-3 bg-electric-lime text-deep-void font-bold rounded-xl hover:bg-green-400 transition-colors disabled:opacity-50"
                  >
                    Submit Guess
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4"
                >
                  <div className={`p-4 rounded-xl text-center ${
                    isCorrect
                      ? 'bg-electric-lime/20 border border-electric-lime'
                      : 'bg-hot-pink/20 border border-hot-pink'
                  }`}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {isCorrect ? (
                        <CheckIcon className="text-electric-lime" size={28} />
                      ) : (
                        <XIcon className="text-hot-pink" size={28} />
                      )}
                      <p className={`text-xl font-bold ${isCorrect ? 'text-electric-lime' : 'text-hot-pink'}`}>
                        {isCorrect ? 'Correct!' : 'Wrong!'}
                      </p>
                    </div>
                    <p className="text-ghost-white mt-1">
                      It was <span className="font-bold">{currentJourney.answer}</span>
                    </p>
                  </div>

                  {/* Show player image after reveal */}
                  <div className="flex justify-center">
                    <div className="w-24 h-24 rounded-full bg-surface overflow-hidden border-2 border-electric-lime">
                      <PlayerImage
                        playerId={currentJourney.id}
                        playerName={currentJourney.answer}
                        size="lg"
                        className="w-full h-full"
                      />
                    </div>
                  </div>

                  <button
                    onClick={nextRound}
                    className="w-full py-3 bg-surface text-ghost-white font-bold rounded-xl hover:bg-muted/30 transition-colors flex items-center justify-center gap-2"
                  >
                    {round >= 5 ? 'See Results' : 'Next Journey'}
                    <ArrowRightIcon size={20} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* Game Over Screen */
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-8 text-center"
          >
            <h2 className="text-3xl font-display font-bold mb-4">Game Complete!</h2>
            <p className="text-5xl font-display font-bold text-electric-lime mb-6">{score} points</p>
            <p className="text-muted mb-8">
              {score >= 400 ? 'NBA Historian! 🏆' : 
               score >= 300 ? 'Great knowledge! 🌟' : 
               score >= 200 ? 'Not bad! Keep learning 📚' : 
               'Keep practicing! 💪'}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={restartGame}
                className="px-8 py-3 bg-electric-lime text-deep-void font-bold rounded-xl"
              >
                Play Again
              </button>
              <Link
                href="/play"
                className="px-8 py-3 bg-surface text-ghost-white font-bold rounded-xl"
              >
                More Games
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
