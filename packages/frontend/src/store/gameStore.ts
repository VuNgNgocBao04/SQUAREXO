import { create } from 'zustand'
import { createGame, type GameState } from 'game-core'

interface GameStore {
  game: GameState | null
  initGame: (rows: number, cols: number) => void
  resetGame: () => void
}

export const useGameStore = create<GameStore>((set) => ({
  game: null,
  initGame: (rows, cols) => {
    const newGame = createGame(rows, cols)
    set({ game: newGame })
  },
  resetGame: () => {
    set((state) => {
      if (!state.game) return { game: null }
      return { game: createGame(state.game.rows, state.game.cols) }
    })
  },
}))
