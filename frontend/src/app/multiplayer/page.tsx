'use client'

import { useState, useEffect, Suspense } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { 
  GamepadIcon, 
  CrownIcon, 
  TargetIcon, 
  MaskIcon, 
  JourneyIcon,
  CheckIcon,
  ArrowLeftIcon
} from '@/components/icons'

// Game options
const GAMES = [
  {
    id: 'whos-that',
    name: "Who's That Role Player",
    description: 'Guess the player from their blurred image and stats',
    Icon: MaskIcon,
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'the-journey',
    name: 'The Journey',
    description: 'Guess the player from their career team history',
    Icon: JourneyIcon,
    color: 'from-blue-500 to-cyan-500',
  },
]

const QUESTION_OPTIONS = [5, 10, 15, 20]
const TIMER_OPTIONS = [10, 15, 20, 30] // seconds per question

// Generate room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function MultiplayerContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const joinParam = searchParams.get('join')
  
  // Use centralized auth store - no more local auth state!
  const { user, isLoading: authLoading, isAuthenticated } = useAuthStore()
  
  const [mode, setMode] = useState<'select' | 'host' | 'join'>('select')
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [questionCount, setQuestionCount] = useState(10)
  const [timerDuration, setTimerDuration] = useState(15)
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Auto-fill join code from URL param (from QR code scan)
    if (joinParam) {
      setJoinCode(joinParam)
      setMode('join')
    }
  }, [joinParam])

  const handleCreateRoom = async () => {
    if (!selectedGame) {
      setError('Select a game')
      return
    }
    if (!user) {
      setError('Sign in to host a game')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const roomCode = generateRoomCode()
      
      // Create room in database
      const { error: createError } = await supabase
        .from('multiplayer_rooms')
        .insert({
          code: roomCode,
          host_id: user.id,
          game_type: selectedGame,
          question_count: questionCount,
          timer_duration: timerDuration,
          status: 'waiting',
          players: [{ id: user.id, score: 0, answers: [] }],
        })

      if (createError) throw createError

      // Navigate to lobby
      router.push(`/multiplayer/lobby?code=${roomCode}&host=true`)
    } catch (err) {
      console.error('Failed to create room:', err)
      setError('Failed to create room. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      setError('Enter a room code')
      return
    }
    if (!user) {
      setError('Sign in to join a game')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Find the room
      const { data: room, error: findError } = await supabase
        .from('multiplayer_rooms')
        .select('*')
        .eq('code', joinCode.toUpperCase())
        .eq('status', 'waiting')
        .single()

      if (findError || !room) {
        setError('Room not found or game already started')
        return
      }

      if (room.host_id === user.id) {
        setError('You cannot join your own room')
        return
      }

      // Add player to room
      const updatedPlayers = [...(room.players || []), { id: user.id, score: 0, answers: [] }]
      
      const { error: joinError } = await supabase
        .from('multiplayer_rooms')
        .update({ 
          players: updatedPlayers,
          guest_id: user.id,
        })
        .eq('id', room.id)

      if (joinError) throw joinError

      // Navigate to lobby
      router.push(`/multiplayer/lobby?code=${joinCode.toUpperCase()}`)
    } catch (err) {
      console.error('Failed to join room:', err)
      setError('Failed to join room. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-display font-bold mb-2 flex items-center justify-center gap-3"
          >
            <GamepadIcon className="text-electric-lime" size={36} /> Multiplayer
          </motion.h1>
          <p className="text-muted">Challenge your friends in real-time!</p>
        </div>

        {/* Mode Selection */}
        {mode === 'select' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <button
              onClick={() => setMode('host')}
              className="w-full glass rounded-2xl p-6 text-left hover:border-electric-lime transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-electric-lime to-green-500 flex items-center justify-center">
                  <CrownIcon className="text-gunmetal" size={32} />
                </div>
                <div>
                  <h2 className="text-xl font-bold group-hover:text-electric-lime transition-colors">Host Game</h2>
                  <p className="text-muted text-sm">Create a room and invite friends</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full glass rounded-2xl p-6 text-left hover:border-hot-pink transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-hot-pink to-purple-500 flex items-center justify-center">
                  <TargetIcon className="text-white" size={32} />
                </div>
                <div>
                  <h2 className="text-xl font-bold group-hover:text-hot-pink transition-colors">Join Game</h2>
                  <p className="text-muted text-sm">Enter a room code to join</p>
                </div>
              </div>
            </button>
          </motion.div>
        )}

        {/* Host Mode */}
        {mode === 'host' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <button
              onClick={() => setMode('select')}
              className="text-muted hover:text-ghost-white transition-colors flex items-center gap-2"
            >
              <ArrowLeftIcon size={16} /> Back
            </button>

            {/* Game Selection */}
            <div>
              <h3 className="text-lg font-bold mb-3">Select Game</h3>
              <div className="grid gap-3">
                {GAMES.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => setSelectedGame(game.id)}
                    className={`glass rounded-xl p-4 text-left transition-all ${
                      selectedGame === game.id 
                        ? 'border-electric-lime bg-electric-lime/10' 
                        : 'hover:border-surface'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <game.Icon size={28} className="text-ghost-white" />
                      <div>
                        <h4 className="font-bold">{game.name}</h4>
                        <p className="text-sm text-muted">{game.description}</p>
                      </div>
                      {selectedGame === game.id && (
                        <CheckIcon className="ml-auto text-electric-lime" size={20} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Question Count */}
            <div>
              <h3 className="text-lg font-bold mb-3">Number of Questions</h3>
              <div className="flex gap-2">
                {QUESTION_OPTIONS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setQuestionCount(count)}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                      questionCount === count
                        ? 'bg-electric-lime text-gunmetal'
                        : 'bg-surface hover:bg-surface/80'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Timer Duration */}
            <div>
              <h3 className="text-lg font-bold mb-3">Time per Question (seconds)</h3>
              <div className="flex gap-2">
                {TIMER_OPTIONS.map((time) => (
                  <button
                    key={time}
                    onClick={() => setTimerDuration(time)}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                      timerDuration === time
                        ? 'bg-hot-pink text-white'
                        : 'bg-surface hover:bg-surface/80'
                    }`}
                  >
                    {time}s
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-hot-pink text-sm text-center">{error}</p>
            )}

            <button
              onClick={handleCreateRoom}
              disabled={loading || !isAuthenticated || authLoading}
              className="w-full py-4 bg-electric-lime text-gunmetal font-bold rounded-xl hover:bg-green-400 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating Room...' : 'Create Room'}
            </button>

            {!isAuthenticated && !authLoading && (
              <p className="text-center text-muted text-sm">
                <Link href="/profile" className="text-electric-lime hover:underline">Sign in</Link> to host a game
              </p>
            )}
          </motion.div>
        )}

        {/* Join Mode */}
        {mode === 'join' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <button
              onClick={() => setMode('select')}
              className="text-muted hover:text-ghost-white transition-colors flex items-center gap-2"
            >
              <ArrowLeftIcon size={16} /> Back
            </button>

            <div className="glass rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 text-center">Enter Room Code</h3>
              
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                maxLength={6}
                className="w-full text-center text-3xl font-mono tracking-widest py-4 bg-gunmetal border border-surface rounded-xl text-ghost-white placeholder-muted focus:outline-none focus:border-electric-lime transition-colors"
              />

              {error && (
                <p className="text-hot-pink text-sm text-center mt-3">{error}</p>
              )}

              <button
                onClick={handleJoinRoom}
                disabled={loading || !isAuthenticated || authLoading || joinCode.length !== 6}
                className="w-full mt-4 py-4 bg-hot-pink text-white font-bold rounded-xl hover:bg-pink-400 transition-colors disabled:opacity-50"
              >
                {loading ? 'Joining...' : 'Join Game'}
              </button>

              {!isAuthenticated && !authLoading && (
                <p className="text-center text-muted text-sm mt-3">
                  <Link href="/profile" className="text-electric-lime hover:underline">sign in</Link> to join a game
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default function MultiplayerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-electric-lime border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MultiplayerContent />
    </Suspense>
  )
}
