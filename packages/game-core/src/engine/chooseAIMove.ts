import type { Edge, GameState } from "../types/GameState.js";

export function chooseAIMove(state: GameState): Edge | null {
  for (const edge of state.edges) {
    if (!edge.takenBy) {
      return {
        from: edge.from,
        to: edge.to,
      };
    }
  }

  return null;
}
