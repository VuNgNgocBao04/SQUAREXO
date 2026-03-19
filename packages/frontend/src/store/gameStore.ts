import { create } from "zustand";
import { GameState, createGame, applyMove, Edge } from "@squarexo/game-core";

const ROWS = 5; // 5×5 dots → 4×4 grid of cells
const COLS = 5;

interface GameStore {
  game: GameState;
  resetGame: () => void;
  makeMove: (edge: Edge) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  game: createGame(ROWS, COLS),

  resetGame: () =>
    set({ game: createGame(ROWS, COLS) }),

  makeMove: (edge: Edge) =>
    set((state) => {
      try {
        const next = applyMove(state.game, edge);
        return { game: next };
      } catch {
        return state;
      }
    }),
}));
