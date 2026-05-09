'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { useAuthStore } from '@/store/authStore'
import { 
  GamepadIcon, 
  CrownIcon, 
  TargetIcon, 
  MaskIcon, 
  JourneyIcon,
  CheckIcon,
  ArrowLeftIcon,
  XIcon
} from '@/components/icons'
import { BasketballLoader } from '@/components/ui/BasketballLoader'

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
const MIN_PLAYERS = 2
const MAX_PLAYERS = 5
const USER_READY_MAX_ATTEMPTS = 8
const USER_READY_DELAY_MS = 700
const ROOM_OP_MAX_ATTEMPTS = 4
const AUTH_CHECK_TIMEOUT_MS = 5000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out`))
    }, timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

async function hasActiveAuthSession(): Promise<boolean> {
  try {
    // Primary path: use session object.
    const sessionData = await withTimeout(
      supabase.auth.getSession(),
      AUTH_CHECK_TIMEOUT_MS,
      'auth.getSession'
    )
    if (sessionData?.data?.session) {
      return true
    }
  } catch (err) {
    console.warn('[Multiplayer] getSession timed out/failed, falling back to getUser:', err)
  }

  try {
    // Fallback path: user presence usually means valid auth context.
    const userData = await withTimeout(
      supabase.auth.getUser(),
      AUTH_CHECK_TIMEOUT_MS,
      'auth.getUser'
    )
    return !!userData?.data?.user
  } catch (err) {
    console.warn('[Multiplayer] getUser fallback failed:', err)
    return false
  }
}

// Generate room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function getDisplayName(user: User | null, fallbackPrefix: string): string {
  if (!user) return fallbackPrefix
  const metadata = user.user_metadata || {}
  return metadata.name || metadata.full_name || user.email?.split('@')[0] || `${fallbackPrefix}_${user.id.slice(0, 4)}`
}

// Ensure user exists in public.users table (FK requirement)
async function ensureUserExists(userId: string): Promise<boolean> {
  try {
    console.log('[Multiplayer] Waiting for user profile readiness:', userId)

    for (let attempt = 1; attempt <= USER_READY_MAX_ATTEMPTS; attempt++) {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      if (data?.id) {
        console.log('[Multiplayer] User exists in public.users')
        return true
      }

      // Try a best-effort upsert to accelerate first-login profile creation.
      const { data: authData } = await supabase.auth.getUser()
      if (authData?.user) {
        await supabase
          .from('users')
          .upsert(
            {
              id: userId,
              username: authData.user.user_metadata?.name || 'Player_' + userId.slice(0, 8),
              avatar_url: authData.user.user_metadata?.avatar_url || null,
            },
            { onConflict: 'id' }
          )
      }

      if (attempt < USER_READY_MAX_ATTEMPTS) {
        await sleep(USER_READY_DELAY_MS)
      }
    }

    console.error('[Multiplayer] User profile not ready in time')
    return false
  } catch (err) {
    console.error('[Multiplayer] ensureUserExists error:', err)
    return false
  }
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
  const [guestLoading, setGuestLoading] = useState(false)
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestNameError, setGuestNameError] = useState<string | null>(null)
  const autoJoinAttemptedRef = useRef(false)

  useEffect(() => {
    // Auto-fill join code from URL param (from QR code scan)
    if (joinParam) {
      setJoinCode(joinParam)
      setMode('join')
    }
  }, [joinParam])

  // Auto-join once when code is present and auth is ready.
  useEffect(() => {
    if (!joinParam || autoJoinAttemptedRef.current) return
    if (authLoading || !isAuthenticated || !user) return

    const normalized = joinParam.toUpperCase().trim()
    if (normalized.length !== 6) return

    autoJoinAttemptedRef.current = true
    setJoinCode(normalized)
    handleJoinRoom()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinParam, authLoading, isAuthenticated, user])

  // Clear error when switching modes
  useEffect(() => {
    setError(null)
  }, [mode])

  const handleCreateRoom = async () => {
    if (!selectedGame) {
      setError('Select a game')
      return
    }
    if (!user) {
      setError('Sign in or continue as guest to host a game')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Verify active Supabase auth session (required for RLS)
      console.log('[Multiplayer] Step 1: Checking auth session...')
      const hasSession = await hasActiveAuthSession()
      if (!hasSession) {
        console.error('[Multiplayer] No active session')
        setError('Your session has expired. Please sign in again.')
        setLoading(false)
        return
      }
      console.log('[Multiplayer] Session check passed')

      // 2. Ensure user exists in public.users table (FK requirement)
      console.log('[Multiplayer] Step 2: Ensuring user exists...')
      const userExists = await ensureUserExists(user.id)
      if (!userExists) {
        console.error('[Multiplayer] User does not exist and could not be created')
        setError('Account setup issue. Try signing out and back in.')
        setLoading(false)
        return
      }

      // 3. Create room
      console.log('[Multiplayer] Step 3: Creating room...')
      let roomCode = ''
      
      let created = false

      for (let attempt = 1; attempt <= ROOM_OP_MAX_ATTEMPTS; attempt++) {
        roomCode = generateRoomCode()
        console.log('[Multiplayer] Room code:', roomCode, 'Game:', selectedGame)

        const { error: createError } = await supabase
          .from('multiplayer_rooms')
          .insert({
            code: roomCode,
            host_id: user.id,
            game_type: selectedGame,
            question_count: questionCount,
            timer_duration: timerDuration,
            status: 'waiting',
            max_players: MAX_PLAYERS,
            players: [{
              id: user.id,
              score: 0,
              answers: [],
              username: getDisplayName(user, 'Host'),
            }],
          })
          .select('id')
          .maybeSingle()

        if (!createError) {
          created = true
          break
        }

        console.warn(`[Multiplayer] Create room attempt ${attempt} failed:`, createError)

        // Handle rare code collision by generating a new code and retrying.
        if (createError.code === '23505') {
          continue
        }

        // FK/profile race on first sign-in; wait and retry without manual refresh.
        if (createError.code === '23503' && attempt < ROOM_OP_MAX_ATTEMPTS) {
          await ensureUserExists(user.id)
          await sleep(500)
          continue
        }

        if (createError.code === '42P01') {
          setError('Multiplayer is not set up yet. Please contact the admin to run the database migration.')
        } else if (createError.code === '42501' || createError.message?.includes('permission')) {
          setError('Permission denied. Try signing out and back in.')
        } else if (createError.code === '23503') {
          setError('Account still syncing. Please wait a moment and try again.')
        } else {
          setError(createError.message || 'Failed to create room')
        }
        return
      }

      if (!created) {
        setError('Could not create room right now. Please try again.')
        return
      }

      router.push(`/multiplayer/lobby?code=${roomCode}&host=true`)
    } catch (err: any) {
      console.error('Failed to create room:', err)
      setError(err?.message || 'Something went wrong. Please try again.')
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
      setError('Sign in or continue as guest to join a game')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Verify session
      const hasSession = await hasActiveAuthSession()
      if (!hasSession) {
        setError('Your session has expired. Please sign in again.')
        setLoading(false)
        return
      }

      // Ensure user exists in public.users
      await ensureUserExists(user.id)

      let joined = false

      // Retry to avoid lost updates when multiple players join at once.
      for (let attempt = 0; attempt < ROOM_OP_MAX_ATTEMPTS; attempt++) {
        const { data: room, error: findError } = await supabase
          .from('multiplayer_rooms')
          .select('*')
          .eq('code', joinCode.toUpperCase())
          .eq('status', 'waiting')
          .single()

        if (findError || !room) {
          if (attempt < ROOM_OP_MAX_ATTEMPTS - 1) {
            await sleep(350)
            continue
          }
          setError('Room not found or game already started')
          return
        }

        if (room.host_id === user.id) {
          setError('You cannot join your own room')
          return
        }

        const currentPlayers = room.players || []
        const maxPlayers = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, room.max_players || MAX_PLAYERS))

        if (currentPlayers.some((p: any) => p.id === user.id)) {
          joined = true
          break
        }

        if (currentPlayers.length >= maxPlayers) {
          setError(`Room is full (${maxPlayers} players max)`)
          return
        }

        const updatedPlayers = [
          ...currentPlayers,
          {
            id: user.id,
            score: 0,
            answers: [],
            username: getDisplayName(user, 'Guest'),
          }
        ]

        const updatePayload: any = { players: updatedPlayers }
        if (!room.guest_id) {
          updatePayload.guest_id = user.id
        }

        const { data: updatedRoom, error: joinError } = await supabase
          .from('multiplayer_rooms')
          .update(updatePayload)
          .eq('id', room.id)
          .eq('updated_at', room.updated_at)
          .select('id')
          .maybeSingle()

        if (joinError) {
          // FK/profile race during first sign-in; wait then retry.
          if (joinError.code === '23503' && attempt < ROOM_OP_MAX_ATTEMPTS - 1) {
            await ensureUserExists(user.id)
            await sleep(500)
            continue
          }
          console.error('Failed to join room:', joinError)
          setError(joinError.message || 'Failed to join room')
          return
        }

        if (updatedRoom) {
          joined = true
          break
        }
      }

      if (!joined) {
        setError('Room changed while joining, please try again')
        return
      }

      router.push(`/multiplayer/lobby?code=${joinCode.toUpperCase()}`)
    } catch (err: any) {
      console.error('Failed to join room:', err)
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGuestSignIn = async () => {
    if (guestLoading) return
    setGuestNameError(null)
    setGuestDialogOpen(true)
  }

  const startGuestSession = async () => {
    if (guestLoading) return

    const trimmedName = guestName.trim().replace(/\s+/g, ' ')
    if (!trimmedName) {
      setGuestNameError('Guest name is required')
      return
    }

    if (trimmedName.length < 2) {
      setGuestNameError('Guest name must be at least 2 characters')
      return
    }

    const safeName = trimmedName.slice(0, 20)

    setGuestLoading(true)
    setError(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInAnonymously()
      if (signInError) {
        setError(signInError.message || 'Unable to start a guest session')
        return
      }

      if (data?.user?.id) {
        try {
          await supabase.auth.updateUser({
            data: { name: safeName },
          })
        } catch {
          // Non-blocking: continue even if metadata update fails.
        }

        await supabase
          .from('users')
          .upsert({
            id: data.user.id,
            username: safeName,
            avatar_url: null,
          }, { onConflict: 'id' })

        await ensureUserExists(data.user.id)
      }

      setGuestDialogOpen(false)
      setGuestName('')
    } catch (err: any) {
      setError(err?.message || 'Unable to start a guest session')
    } finally {
      setGuestLoading(false)
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

        {/* Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mb-4"
            >
              <div className="bg-hot-pink/20 border border-hot-pink/40 rounded-xl px-4 py-3 flex items-center gap-3">
                <XIcon size={16} className="text-hot-pink shrink-0" />
                <p className="text-sm text-hot-pink flex-1">{error}</p>
                <button onClick={() => setError(null)} className="text-hot-pink/60 hover:text-hot-pink">
                  <XIcon size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mode Selection */}
        {mode === 'select' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Not signed in warning */}
            {!authLoading && !isAuthenticated && (
              <div className="glass rounded-xl p-4 border border-yellow-500/30 mb-2">
                <p className="text-sm text-yellow-400 text-center">
                  Sign in or continue as guest to play multiplayer
                </p>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <Link href="/profile" className="px-4 py-2 rounded-lg bg-surface text-ghost-white font-semibold hover:bg-gunmetal transition-colors">
                    Sign in
                  </Link>
                  <button
                    onClick={handleGuestSignIn}
                    disabled={guestLoading}
                    className="px-4 py-2 rounded-lg bg-electric-lime text-gunmetal font-semibold hover:bg-green-400 transition-colors disabled:opacity-60"
                  >
                    {guestLoading ? 'Starting...' : 'Continue as Guest'}
                  </button>
                </div>
              </div>
            )}

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
              onClick={() => { setMode('select'); setSelectedGame(null) }}
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

            <button
              onClick={handleCreateRoom}
              disabled={loading || !isAuthenticated || authLoading || !selectedGame}
              className="w-full py-4 bg-electric-lime text-gunmetal font-bold rounded-xl hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-gunmetal/30 border-t-gunmetal rounded-full animate-spin" />
                  Creating Room...
                </>
              ) : (
                'Create Room'
              )}
            </button>

            {!isAuthenticated && !authLoading && (
              <p className="text-center text-muted text-sm">
                <span className="text-electric-lime">Sign in</span> or continue as guest to host a game
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
              onClick={() => { setMode('select'); setJoinCode('') }}
              className="text-muted hover:text-ghost-white transition-colors flex items-center gap-2"
            >
              <ArrowLeftIcon size={16} /> Back
            </button>

            <div className="glass rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 text-center">Enter Room Code</h3>
              
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="XXXXXX"
                maxLength={6}
                autoFocus
                className="w-full text-center text-3xl font-mono tracking-widest py-4 bg-gunmetal border border-surface rounded-xl text-ghost-white placeholder-muted focus:outline-none focus:border-electric-lime transition-colors"
              />

              <p className="text-xs text-muted text-center mt-2">
                Ask the host for the 6-character room code
              </p>

              <button
                onClick={handleJoinRoom}
                disabled={loading || !isAuthenticated || authLoading || joinCode.length !== 6}
                className="w-full mt-4 py-4 bg-hot-pink text-white font-bold rounded-xl hover:bg-pink-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Join Game'
                )}
              </button>

              {!isAuthenticated && !authLoading && (
                <p className="text-center text-muted text-sm mt-3">
                  <span className="text-electric-lime">Sign in</span> or continue as guest to join a game
                </p>
              )}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {guestDialogOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4"
            >
              <div className="absolute inset-0 bg-deep-void/70 backdrop-blur-sm" />
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                className="relative w-full max-w-md card-neon rounded-2xl p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <MaskIcon className="text-electric-lime" size={28} />
                  <h3 className="text-xl font-bold">Choose a Guest Name</h3>
                </div>
                <p className="text-sm text-muted mb-4">
                  This name shows up in multiplayer rooms.
                </p>
                <input
                  value={guestName}
                  onChange={(e) => {
                    setGuestName(e.target.value)
                    setGuestNameError(null)
                  }}
                  placeholder="Your name"
                  maxLength={20}
                  className="w-full px-4 py-3 bg-gunmetal border border-surface rounded-xl text-ghost-white placeholder-muted focus:outline-none focus:border-electric-lime transition-colors"
                  autoFocus
                />
                {guestNameError && (
                  <p className="text-sm text-hot-pink mt-2">{guestNameError}</p>
                )}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      if (!guestLoading) {
                        setGuestDialogOpen(false)
                        setGuestNameError(null)
                      }
                    }}
                    className="flex-1 py-3 rounded-xl bg-surface text-ghost-white font-semibold hover:bg-muted/30 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startGuestSession}
                    disabled={guestLoading}
                    className="flex-1 py-3 rounded-xl bg-electric-lime text-gunmetal font-semibold hover:bg-green-400 transition-colors disabled:opacity-60"
                  >
                    {guestLoading ? 'Starting...' : 'Continue'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function MultiplayerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <BasketballLoader size="lg" text="Loading..." />
      </div>
    }>
      <MultiplayerContent />
    </Suspense>
  )
}
