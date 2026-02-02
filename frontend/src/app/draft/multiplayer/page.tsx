'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { SwordsIcon, TrophyIcon, HeartIcon, ArrowLeftIcon, QRCodeIcon, UsersIcon, CopyIcon, CheckIcon } from '@/components/icons'
import { sounds } from '@/lib/sounds'
import { useSettingsStore } from '@/store/settingsStore'
import { useKeyboardControls } from '@/hooks/useKeyboardControls'
import { 
  supabase, 
  createDraftRoom, 
  joinDraftRoom, 
  getDraftRoom, 
  getDraftRoomByCode,
  makeDraftPick, 
  subscribeToDraftRoom,
  DraftRoom 
} from '@/lib/supabase'
import { api } from '@/lib/api'

const positions = ['PG', 'SG', 'SF', 'PF', 'C'] as const
type Position = typeof positions[number]

interface Player {
  id: number
  name: string
  team: string
  rating: number
  pts: number
  reb: number
  ast: number
}

export default function MultiplayerDraftPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const joinCode = searchParams.get('code')
  const { soundEnabled } = useSettingsStore()

  // Auth state
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Room state
  const [room, setRoom] = useState<DraftRoom | null>(null)
  const [roomCode, setRoomCode] = useState('')
  const [joinInput, setJoinInput] = useState(joinCode || '')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  // Game state
  const [phase, setPhase] = useState<'lobby' | 'waiting' | 'drafting' | 'battle' | 'result'>('lobby')
  const [currentPosition, setCurrentPosition] = useState<Position>('PG')
  const [myPicks, setMyPicks] = useState<Record<string, Player>>({})
  const [opponentPicks, setOpponentPicks] = useState<Record<string, Player>>({})
  const [playerPool, setPlayerPool] = useState<Record<string, Player[]>>({})
  const [myScore, setMyScore] = useState(0)
  const [opponentScore, setOpponentScore] = useState(0)
  const [isHost, setIsHost] = useState(false)

  // Check auth
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)

      // If join code in URL, try to join
      if (joinCode && user) {
        handleJoinRoom(joinCode)
      }
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [joinCode])

  // Subscribe to room updates
  useEffect(() => {
    if (!room) return

    const channel = subscribeToDraftRoom(room.id, (updatedRoom) => {
      setRoom(updatedRoom)
      
      // Update game state based on room
      if (updatedRoom.status === 'drafting' && phase === 'waiting') {
        setPhase('drafting')
        if (soundEnabled) sounds.click()
      }

      // Update picks
      const hostPicks = updatedRoom.host_picks || {}
      const guestPicks = updatedRoom.guest_picks || {}
      
      if (isHost) {
        setMyPicks(reconstructPicks(hostPicks, playerPool))
        setOpponentPicks(reconstructPicks(guestPicks, playerPool))
      } else {
        setMyPicks(reconstructPicks(guestPicks, playerPool))
        setOpponentPicks(reconstructPicks(hostPicks, playerPool))
      }

      // Check if both ready
      if (updatedRoom.host_ready && updatedRoom.guest_ready && phase === 'drafting') {
        calculateScores(updatedRoom)
        setPhase('result')
        if (soundEnabled) sounds.victory()
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room?.id, isHost, playerPool, phase, soundEnabled])

  // Reconstruct player objects from picks
  const reconstructPicks = (picks: Record<string, number>, pool: Record<string, Player[]>): Record<string, Player> => {
    const result: Record<string, Player> = {}
    Object.entries(picks).forEach(([pos, playerId]) => {
      const players = pool[pos] || []
      const player = players.find(p => p.id === playerId)
      if (player) result[pos] = player
    })
    return result
  }

  // Calculate scores
  const calculateScores = (roomData: DraftRoom) => {
    const calcScore = (picks: Record<string, number>) => {
      let score = 0
      Object.entries(picks).forEach(([pos, playerId]) => {
        const players = playerPool[pos] || []
        const player = players.find(p => p.id === playerId)
        if (player) {
          score += player.rating + player.pts + player.reb + player.ast
        }
      })
      return score
    }

    const hostScore = calcScore(roomData.host_picks || {})
    const guestScore = calcScore(roomData.guest_picks || {})

    if (isHost) {
      setMyScore(hostScore)
      setOpponentScore(guestScore)
    } else {
      setMyScore(guestScore)
      setOpponentScore(hostScore)
    }
  }

  // Fetch player pool from API
  const fetchPlayerPool = async () => {
    const pool: Record<string, Player[]> = {}
    
    for (const pos of positions) {
      try {
        const response = await api.getPlayersByPosition(pos, 5, true)
        pool[pos] = response.players.map((p: any) => ({
          id: p.id,
          name: p.name,
          team: p.team,
          rating: p.rating || 80,
          pts: p.pts || 0,
          reb: p.reb || 0,
          ast: p.ast || 0,
        }))
      } catch (e) {
        // Fallback to mock data
        pool[pos] = []
      }
    }
    
    return pool
  }

  // Create room (host)
  const handleCreateRoom = async () => {
    if (!user) {
      setError('Please sign in to create a room')
      return
    }

    try {
      setLoading(true)
      const pool = await fetchPlayerPool()
      setPlayerPool(pool)
      
      const newRoom = await createDraftRoom(user.id, pool)
      setRoom(newRoom)
      setRoomCode(newRoom.code)
      setIsHost(true)
      setPhase('waiting')
      if (soundEnabled) sounds.click()
    } catch (e: any) {
      setError(e.message || 'Failed to create room')
    } finally {
      setLoading(false)
    }
  }

  // Join room (guest)
  const handleJoinRoom = async (code?: string) => {
    const codeToUse = code || joinInput
    if (!user) {
      setError('Please sign in to join a room')
      return
    }

    if (!codeToUse || codeToUse.length !== 6) {
      setError('Please enter a valid 6-character code')
      return
    }

    try {
      setLoading(true)
      
      // First get the room to get player pool
      const existingRoom = await getDraftRoomByCode(codeToUse)
      if (!existingRoom) {
        throw new Error('Room not found')
      }
      
      setPlayerPool(existingRoom.player_pool)
      
      const joinedRoom = await joinDraftRoom(codeToUse, user.id)
      setRoom(joinedRoom)
      setRoomCode(joinedRoom.code)
      setIsHost(false)
      setPhase('drafting')
      if (soundEnabled) sounds.click()
    } catch (e: any) {
      setError(e.message || 'Failed to join room')
    } finally {
      setLoading(false)
    }
  }

  // Make a pick
  const handlePick = async (player: Player) => {
    if (!room || !user) return

    try {
      await makeDraftPick(room.id, user.id, currentPosition, player.id)
      
      const newPicks = { ...myPicks, [currentPosition]: player }
      setMyPicks(newPicks)

      const currentIndex = positions.indexOf(currentPosition)
      if (currentIndex < positions.length - 1) {
        setCurrentPosition(positions[currentIndex + 1])
        if (soundEnabled) sounds.click()
      }
    } catch (e: any) {
      setError(e.message || 'Failed to make pick')
    }
  }

  // Copy room code
  const copyCode = () => {
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Get QR code URL
  const getQRCodeUrl = () => {
    const joinUrl = `${window.location.origin}/draft/multiplayer?code=${roomCode}`
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`
  }

  // Keyboard controls
  useKeyboardControls({
    onEnter: () => {
      if (phase === 'lobby' && joinInput) {
        handleJoinRoom()
      }
    },
    onNumber: (num) => {
      if (phase === 'drafting' && playerPool[currentPosition]) {
        const player = playerPool[currentPosition][num - 1]
        if (player && !myPicks[currentPosition]) {
          handlePick(player)
        }
      }
    },
    enabled: true,
  })

  // Check if all my positions are filled
  const allPicksMade = positions.every(pos => pos in myPicks)
  const iWin = myScore > opponentScore

  if (loading && !room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-electric-lime border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
          <UsersIcon size={48} className="text-electric-lime mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold mb-4">Sign In Required</h1>
          <p className="text-muted mb-6">You need to be signed in to play multiplayer draft.</p>
          <Link
            href="/profile"
            className="inline-block px-8 py-3 bg-electric-lime text-deep-void font-bold rounded-xl"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 lg:px-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/draft" className="text-muted hover:text-ghost-white transition-colors flex items-center gap-1">
          <ArrowLeftIcon size={16} /> Back to Draft
        </Link>
        <div className="flex items-center gap-2">
          <UsersIcon size={20} className="text-electric-lime" />
          <span className="text-electric-lime font-bold">Multiplayer Draft</span>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto mb-6 p-4 bg-hot-pink/20 border border-hot-pink rounded-xl text-center"
        >
          <p className="text-hot-pink">{error}</p>
          <button onClick={() => setError('')} className="text-sm text-muted mt-2 hover:text-ghost-white">
            Dismiss
          </button>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {/* LOBBY - Create or Join */}
        {phase === 'lobby' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-md mx-auto"
          >
            <h1 className="text-3xl font-display font-bold text-center mb-8 flex items-center justify-center gap-2">
              <SwordsIcon size={32} className="text-hot-pink" /> Draft Arena
            </h1>

            <div className="space-y-6">
              {/* Create Room */}
              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="w-full glass rounded-2xl p-6 text-left hover:border-electric-lime transition-all border border-transparent group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-electric-lime/20 flex items-center justify-center group-hover:bg-electric-lime/30 transition-colors">
                    <QRCodeIcon size={28} className="text-electric-lime" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Create Room</h2>
                    <p className="text-muted text-sm">Host a game and invite a friend</p>
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-surface" />
                <span className="text-muted text-sm">OR</span>
                <div className="flex-1 h-px bg-surface" />
              </div>

              {/* Join Room */}
              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-4">Join Room</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="flex-1 px-4 py-3 bg-gunmetal border border-surface rounded-xl text-ghost-white text-center text-xl font-mono tracking-widest uppercase focus:outline-none focus:border-electric-lime"
                  />
                  <button
                    onClick={() => handleJoinRoom()}
                    disabled={loading || joinInput.length !== 6}
                    className="px-6 py-3 bg-electric-lime text-deep-void font-bold rounded-xl disabled:opacity-50"
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* WAITING - Host waiting for guest */}
        {phase === 'waiting' && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-md mx-auto text-center"
          >
            <h1 className="text-2xl font-display font-bold mb-6">Waiting for Opponent</h1>

            {/* QR Code */}
            <div className="glass rounded-2xl p-6 mb-6">
              <div className="bg-white rounded-xl p-4 inline-block mb-4">
                <img
                  src={getQRCodeUrl()}
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>
              <p className="text-muted text-sm mb-4">Scan to join or share the code</p>

              {/* Room Code */}
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-mono font-bold tracking-widest text-electric-lime">
                  {roomCode}
                </span>
                <button
                  onClick={copyCode}
                  className="p-2 rounded-lg bg-gunmetal hover:bg-surface transition-colors"
                >
                  {copied ? <CheckIcon size={20} className="text-electric-lime" /> : <CopyIcon size={20} />}
                </button>
              </div>
            </div>

            <div className="animate-pulse text-muted">
              <p>Waiting for opponent to join...</p>
            </div>
          </motion.div>
        )}

        {/* DRAFTING */}
        {phase === 'drafting' && (
          <motion.div
            key="drafting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="max-w-4xl mx-auto">
              <h1 className="text-2xl font-display font-bold text-center mb-2">
                Draft Your Team
              </h1>
              <p className="text-center text-muted mb-6">
                Both players pick from the same pool. Choose wisely!
              </p>

              {/* Position Progress */}
              <div className="flex justify-center gap-2 mb-6">
                {positions.map((pos) => (
                  <div
                    key={pos}
                    className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm transition-all ${
                      myPicks[pos]
                        ? 'bg-electric-lime text-deep-void'
                        : pos === currentPosition
                        ? 'bg-surface border-2 border-electric-lime text-ghost-white'
                        : 'bg-gunmetal text-muted'
                    }`}
                  >
                    {pos}
                  </div>
                ))}
              </div>

              {!allPicksMade ? (
                <>
                  <h2 className="text-xl font-display text-center mb-6">
                    Select your <span className="text-electric-lime">{currentPosition}</span>
                    <span className="text-muted text-sm ml-2">(Press 1-5)</span>
                  </h2>

                  {/* Player Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(playerPool[currentPosition] || []).map((player, index) => (
                      <motion.button
                        key={player.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handlePick(player)}
                        className="glass rounded-xl p-4 text-left hover:border-electric-lime transition-all border border-transparent relative"
                      >
                        <span className="absolute top-2 right-2 w-6 h-6 rounded bg-gunmetal text-muted text-sm flex items-center justify-center">
                          {index + 1}
                        </span>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-gunmetal overflow-hidden">
                            <img
                              src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.id}.png`}
                              alt={player.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <p className="font-bold">{player.name}</p>
                            <p className="text-sm text-muted">{player.team}</p>
                          </div>
                          <span className="ml-auto text-2xl font-display font-bold text-electric-lime">
                            {player.rating}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span><span className="text-muted">PTS:</span> {player.pts}</span>
                          <span><span className="text-muted">REB:</span> {player.reb}</span>
                          <span><span className="text-muted">AST:</span> {player.ast}</span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <div className="glass rounded-2xl p-6 max-w-md mx-auto">
                    <h2 className="text-xl font-bold mb-4 text-electric-lime">Your Team</h2>
                    <div className="space-y-2 mb-4">
                      {positions.map((pos) => (
                        <div key={pos} className="flex items-center justify-between bg-gunmetal rounded-lg p-2">
                          <span className="text-muted w-8">{pos}</span>
                          <span className="flex-1">{myPicks[pos]?.name}</span>
                          <span className="text-electric-lime font-bold">{myPicks[pos]?.rating}</span>
                        </div>
                      ))}
                    </div>
                    <div className="animate-pulse text-muted">
                      Waiting for opponent to finish drafting...
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* RESULT */}
        {phase === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className={`flex justify-center mb-4 ${iWin ? 'animate-float' : ''}`}>
              {iWin ? (
                <TrophyIcon size={80} className="text-yellow-400" />
              ) : myScore === opponentScore ? (
                <SwordsIcon size={80} className="text-muted" />
              ) : (
                <HeartIcon size={80} className="text-hot-pink" />
              )}
            </div>
            <h1 className={`text-4xl font-display font-bold mb-4 ${
              iWin ? 'text-electric-lime' : myScore === opponentScore ? 'text-muted' : 'text-hot-pink'
            }`}>
              {iWin ? 'VICTORY!' : myScore === opponentScore ? 'TIE!' : 'DEFEAT'}
            </h1>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* My Team */}
              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-4 text-electric-lime">Your Team</h2>
                <div className="space-y-2">
                  {positions.map((pos) => (
                    <div key={pos} className="flex items-center justify-between bg-gunmetal rounded-lg p-2">
                      <span className="text-muted w-8">{pos}</span>
                      <span className="flex-1 text-sm">{myPicks[pos]?.name || '-'}</span>
                      <span className="text-electric-lime font-bold">{myPicks[pos]?.rating || 0}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-2xl font-display font-bold">
                  Score: <span className="text-electric-lime">{myScore.toFixed(1)}</span>
                </p>
              </div>

              {/* Opponent Team */}
              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-4 text-hot-pink">Opponent</h2>
                <div className="space-y-2">
                  {positions.map((pos) => (
                    <div key={pos} className="flex items-center justify-between bg-gunmetal rounded-lg p-2">
                      <span className="text-muted w-8">{pos}</span>
                      <span className="flex-1 text-sm">{opponentPicks[pos]?.name || '-'}</span>
                      <span className="text-hot-pink font-bold">{opponentPicks[pos]?.rating || 0}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-2xl font-display font-bold">
                  Score: <span className="text-hot-pink">{opponentScore.toFixed(1)}</span>
                </p>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setPhase('lobby')
                  setRoom(null)
                  setRoomCode('')
                  setMyPicks({})
                  setOpponentPicks({})
                  setCurrentPosition('PG')
                }}
                className="px-8 py-3 bg-electric-lime text-deep-void font-bold rounded-xl"
              >
                Play Again
              </button>
              <Link
                href="/"
                className="px-8 py-3 bg-surface text-ghost-white font-bold rounded-xl"
              >
                Home
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
