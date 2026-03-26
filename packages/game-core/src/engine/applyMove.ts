import { edgeKey } from "./edgeKey.js";
import type { Edge, GameState, Player } from "../types/GameState.js";

function nextPlayer(player: Player): Player {
  return player === "X" ? "O" : "X";
}

function getSquareEdgeKeys(row: number, col: number): [string, string, string, string] {
  const top = `${row},${col}-${row},${col + 1}`;
  const bottom = `${row + 1},${col}-${row + 1},${col + 1}`;
  const left = `${row},${col}-${row + 1},${col}`;
  const right = `${row},${col + 1}-${row + 1},${col + 1}`;
  return [top, right, bottom, left];
}

function countCompletedSquares(state: GameState, takenEdgeKeys: Set<string>): number {
  let completed = 0;

  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols; col++) {
      const squareEdgeKeys = getSquareEdgeKeys(row, col);
      if (squareEdgeKeys.every((key) => takenEdgeKeys.has(key))) {
        completed++;
      }
    }
  }

  return completed;
}

export function applyMove(state: GameState, edge: Edge): GameState {
  const moveKey = edgeKey(edge);
  const targetIndex = state.edges.findIndex((candidate) => edgeKey(candidate) === moveKey);

  if (targetIndex === -1) {
    throw new Error("Invalid edge for this board");
  }

  if (state.edges[targetIndex]?.takenBy) {
    throw new Error("Edge already taken");
  }

  const player = state.currentPlayer;

  const takenBefore = new Set(
    state.edges
      .filter((candidate) => !!candidate.takenBy)
      .map((candidate) => edgeKey(candidate)),
  );

  const completedBefore = countCompletedSquares(state, takenBefore);

  const newEdges = state.edges.map((candidate, index) => {
    if (index !== targetIndex) {
      return candidate;
    }

    return {
      ...candidate,
      takenBy: player,
    };
  });

  const takenAfter = new Set([...takenBefore, moveKey]);
  const completedAfter = countCompletedSquares(state, takenAfter);
  const newlyCompleted = completedAfter - completedBefore;

  return {
    ...state,
    edges: newEdges,
    currentPlayer: newlyCompleted > 0 ? player : nextPlayer(player),
    score: {
      ...state.score,
      [player]: state.score[player] + newlyCompleted,
    },
  };
}