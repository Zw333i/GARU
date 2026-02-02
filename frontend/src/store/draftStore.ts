import { create } from 'zustand'

interface Player {
  id: number
  name: string
  team: string
  rating: number
  pts: number
  reb: number
  ast: number
}

interface DraftState {
  draftedTeam: {
    PG?: Player
    SG?: Player
    SF?: Player
    PF?: Player
    C?: Player
  }
  currentPosition: 'PG' | 'SG' | 'SF' | 'PF' | 'C'
  battleHistory: Array<{
    id: string
    userTeam: DraftState['draftedTeam']
    opponentTeam: DraftState['draftedTeam']
    userScore: number
    opponentScore: number
    won: boolean
    timestamp: Date
  }>
  
  // Actions
  setDraftedPlayer: (position: keyof DraftState['draftedTeam'], player: Player) => void
  setCurrentPosition: (position: DraftState['currentPosition']) => void
  resetDraft: () => void
  addBattleResult: (result: DraftState['battleHistory'][0]) => void
}

export const useDraftStore = create<DraftState>((set) => ({
  draftedTeam: {},
  currentPosition: 'PG',
  battleHistory: [],

  setDraftedPlayer: (position, player) =>
    set((state) => ({
      draftedTeam: { ...state.draftedTeam, [position]: player },
    })),

  setCurrentPosition: (position) =>
    set({ currentPosition: position }),

  resetDraft: () =>
    set({ draftedTeam: {}, currentPosition: 'PG' }),

  addBattleResult: (result) =>
    set((state) => ({
      battleHistory: [...state.battleHistory, result],
    })),
}))
