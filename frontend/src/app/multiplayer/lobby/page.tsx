'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { QRCodeSVG } from 'qrcode.react'
import { 
  CrownIcon, 
  GamepadIcon, 
  HourglassIcon,
  CheckIcon
} from '@/components/icons'

interface Player {
  id: string
  score: number
  answers: any[]
  username?: string
}

interface Room {
  id: string
  code: string
  host_id: string
  guest_id: string | null
  game_type: string
  question_count: number
  timer_duration: number
  status: 'waiting' | 'playing' | 'finished'
  players: Player[]
  questions?: any[]
  current_question?: number
}

function LobbyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomCode = searchParams.get('code')
  const isHost = searchParams.get('host') === 'true'

  // Use centralized auth store
  const { user } = useAuthStore()
  
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [hostUsername, setHostUsername] = useState<string>('Host')
  const [guestUsername, setGuestUsername] = useState<string>('Waiting...')

  // Fetch room data
  const fetchRoom = useCallback(async () => {
    if (!roomCode) return

    const { data, error } = await supabase
      .from('multiplayer_rooms')
      .select('*')
      .eq('code', roomCode)
      .single()

    if (error) {
      console.error('Error fetching room:', error)
      return
    }

    setRoom(data as Room)

    // If game started, redirect to game
    if (data.status === 'playing') {
      router.push(`/multiplayer/game?code=${roomCode}`)
    }
  }, [roomCode, router])

  // Fetch usernames
  const fetchUsernames = useCallback(async () => {
    if (!room) return

    // Fetch host username
    const { data: hostData } = await supabase
      .from('users')
      .select('username')
      .eq('id', room.host_id)
      .single()
    
    if (hostData?.username) {
      setHostUsername(hostData.username)
    }

    // Fetch guest username
    if (room.guest_id) {
      const { data: guestData } = await supabase
        .from('users')
        .select('username')
        .eq('id', room.guest_id)
        .single()
      
      if (guestData?.username) {
        setGuestUsername(guestData.username)
      }
    }
  }, [room])

  // No need for local auth - using centralized auth store

  useEffect(() => {
    fetchRoom().then(() => setLoading(false))
  }, [fetchRoom])

  useEffect(() => {
    if (room) {
      fetchUsernames()
    }
  }, [room, fetchUsernames])

  // Real-time subscription
  useEffect(() => {
    if (!roomCode) return

    const channel = supabase
      .channel(`room:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'multiplayer_rooms',
          filter: `code=eq.${roomCode}`,
        },
        (payload) => {
          const newRoom = payload.new as Room
          setRoom(newRoom)
          
          if (newRoom.status === 'playing') {
            router.push(`/multiplayer/game?code=${roomCode}`)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomCode, router])

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleStartGame = async () => {
    if (!room || !isHost) return

    // Generate questions based on game type
    const questions = await generateQuestions(room.game_type, room.question_count)

    const { error } = await supabase
      .from('multiplayer_rooms')
      .update({
        status: 'playing',
        questions,
        current_question: 0,
      })
      .eq('id', room.id)

    if (error) {
      console.error('Failed to start game:', error)
    }
  }

  const handleLeaveRoom = async () => {
    if (!room || !user) return

    if (isHost) {
      // Delete room if host leaves
      await supabase
        .from('multiplayer_rooms')
        .delete()
        .eq('id', room.id)
    } else {
      // Remove guest from room
      await supabase
        .from('multiplayer_rooms')
        .update({
          guest_id: null,
          players: room.players.filter(p => p.id !== user.id),
        })
        .eq('id', room.id)
    }

    router.push('/multiplayer')
  }

  const joinUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/multiplayer?join=${roomCode}` 
    : ''

  const gameNames: Record<string, string> = {
    'whos-that': "Who's That Role Player",
    'the-journey': 'The Journey',
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-electric-lime border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted">Loading lobby...</p>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Room not found</p>
          <button
            onClick={() => router.push('/multiplayer')}
            className="px-6 py-3 bg-electric-lime text-gunmetal font-bold rounded-xl"
          >
            Back to Multiplayer
          </button>
        </div>
      </div>
    )
  }

  const canStart = room.guest_id !== null

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <h1 className="text-2xl font-display font-bold mb-1">
            {gameNames[room.game_type] || room.game_type}
          </h1>
          <p className="text-muted">
            {room.question_count} questions • {room.timer_duration}s per question
          </p>
        </motion.div>

        {/* Room Code */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-6 mb-6 text-center"
        >
          <p className="text-sm text-muted mb-2">Room Code</p>
          <button
            onClick={handleCopyCode}
            className="text-4xl font-mono font-bold tracking-widest text-electric-lime hover:text-green-400 transition-colors"
          >
            {roomCode}
          </button>
          <p className="text-xs text-muted mt-2">
            {copied ? <><CheckIcon size={12} className="inline mr-1" />Copied!</> : 'Click to copy'}
          </p>
        </motion.div>

        {/* QR Code */}
        {isHost && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6 mb-6 flex flex-col items-center"
          >
            <p className="text-sm text-muted mb-3">Scan to join</p>
            <div className="bg-white p-3 rounded-xl">
              <QRCodeSVG value={joinUrl} size={150} />
            </div>
          </motion.div>
        )}

        {/* Players */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 mb-6"
        >
          <h3 className="text-lg font-bold mb-4">Players</h3>
          
          <div className="space-y-3">
            {/* Host */}
            <div className="flex items-center gap-3 p-3 bg-surface rounded-xl">
              <div className="w-10 h-10 rounded-full bg-electric-lime/20 flex items-center justify-center">
                <CrownIcon className="text-electric-lime" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-bold">{hostUsername}</p>
                <p className="text-xs text-muted">Host</p>
              </div>
              <span className="text-electric-lime flex items-center gap-1">
                <CheckIcon size={14} /> Ready
              </span>
            </div>

            {/* Guest */}
            <div className={`flex items-center gap-3 p-3 rounded-xl ${
              room.guest_id ? 'bg-surface' : 'bg-surface/50 border border-dashed border-surface'
            }`}>
              <div className="w-10 h-10 rounded-full bg-hot-pink/20 flex items-center justify-center">
                {room.guest_id ? <GamepadIcon className="text-hot-pink" size={20} /> : <HourglassIcon className="text-muted" size={20} />}
              </div>
              <div className="flex-1">
                <p className={`font-bold ${!room.guest_id && 'text-muted'}`}>
                  {room.guest_id ? guestUsername : 'Waiting for player...'}
                </p>
                <p className="text-xs text-muted">Guest</p>
              </div>
              {room.guest_id && <span className="text-electric-lime flex items-center gap-1"><CheckIcon size={14} /> Ready</span>}
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <div className="space-y-3">
          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={!canStart}
              className="w-full py-4 bg-electric-lime text-gunmetal font-bold rounded-xl hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {canStart ? 'Start Game' : 'Waiting for opponent...'}
            </button>
          )}

          {!isHost && (
            <div className="text-center p-4 bg-surface/50 rounded-xl">
              <p className="text-muted">Waiting for host to start the game...</p>
            </div>
          )}

          <button
            onClick={handleLeaveRoom}
            className="w-full py-3 bg-surface text-muted hover:text-hot-pink font-medium rounded-xl transition-colors"
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  )
}

// Generate questions based on game type
async function generateQuestions(gameType: string, count: number): Promise<any[]> {
  if (gameType === 'whos-that') {
    // Fetch role players from database
    const { data: players } = await supabase
      .from('cached_players')
      .select('player_id, full_name, team_abbreviation, position, season_stats')
    
    if (!players || players.length === 0) {
      // Fallback players
      return Array.from({ length: count }, (_, i) => ({
        id: i,
        playerId: 203999,
        name: 'Nikola Jokic',
        team: 'DEN',
        position: 'C',
        stats: { pts: 26.4, reb: 12.4, ast: 9.0 },
      }))
    }

    // Filter role players (8-20 PPG)
    const rolePlayers = players.filter(p => {
      const pts = p.season_stats?.pts || 0
      return pts >= 8 && pts <= 20
    })

    // Shuffle and pick
    const shuffled = [...rolePlayers].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count).map((p, i) => ({
      id: i,
      playerId: p.player_id,
      name: p.full_name,
      team: p.team_abbreviation,
      position: p.position,
      stats: {
        pts: p.season_stats?.pts || 0,
        reb: p.season_stats?.reb || 0,
        ast: p.season_stats?.ast || 0,
      },
    }))
  }

  if (gameType === 'the-journey') {
    // Hardcoded journey data
    const journeys = [
      { teams: ['CLE', 'MIA', 'CLE', 'LAL'], answer: 'LeBron James', id: 2544 },
      { teams: ['OKC', 'GSW', 'BKN', 'PHX'], answer: 'Kevin Durant', id: 201142 },
      { teams: ['OKC', 'HOU', 'BKN', 'PHI', 'LAC'], answer: 'James Harden', id: 201935 },
      { teams: ['SAS', 'TOR', 'LAC'], answer: 'Kawhi Leonard', id: 202695 },
      { teams: ['IND', 'OKC', 'LAC', 'PHI'], answer: 'Paul George', id: 202331 },
      { teams: ['CLE', 'BOS', 'BKN', 'DAL'], answer: 'Kyrie Irving', id: 202681 },
      { teams: ['CHI', 'MIN', 'PHI', 'MIA'], answer: 'Jimmy Butler', id: 202710 },
      { teams: ['TOR', 'SAS', 'CHI', 'SAC'], answer: 'DeMar DeRozan', id: 201942 },
      { teams: ['GSW', 'DAL'], answer: 'Klay Thompson', id: 202691 },
      { teams: ['POR', 'MIL'], answer: 'Damian Lillard', id: 203081 },
      { teams: ['PHI', 'NOP', 'MIL', 'BOS'], answer: 'Jrue Holiday', id: 201950 },
      { teams: ['TOR', 'IND'], answer: 'Pascal Siakam', id: 1627783 },
      { teams: ['GSW'], answer: 'Stephen Curry', id: 201939 },
      { teams: ['MIL'], answer: 'Giannis Antetokounmpo', id: 203507 },
      { teams: ['DEN'], answer: 'Nikola Jokic', id: 203999 },
    ]

    const shuffled = [...journeys].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count).map((j, i) => ({
      id: i,
      teams: j.teams,
      answer: j.answer,
      playerId: j.id,
    }))
  }

  return []
}

export default function LobbyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-electric-lime border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LobbyContent />
    </Suspense>
  )
}
