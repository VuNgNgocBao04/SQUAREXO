import type { Edge, GameState } from "../types/GameState.js";
import { edgeKey } from "./edgeKey.js";

function getSquareEdgeKeys(row: number, col: number): [string, string, string, string] {
  const top = `${row},${col}-${row},${col + 1}`;
  const bottom = `${row + 1},${col}-${row + 1},${col + 1}`;
  const left = `${row},${col}-${row + 1},${col}`;
  const right = `${row},${col + 1}-${row + 1},${col + 1}`;
  return [top, right, bottom, left];
}

function countBoxEdgesTaken(state: GameState, row: number, col: number): number {
  const taken = new Set(
    state.edges
      .filter((candidate) => !!candidate.takenBy)
      .map((candidate) => edgeKey(candidate)),
  );

  return getSquareEdgeKeys(row, col).reduce((sum, key) => sum + (taken.has(key) ? 1 : 0), 0);
}

function lineCompletesBox(state: GameState, edge: Edge): boolean {
  const horizontal = edge.from.row === edge.to.row;
  const row = Math.min(edge.from.row, edge.to.row);
  const col = Math.min(edge.from.col, edge.to.col);

  if (horizontal) {
    if (row > 0 && countBoxEdgesTaken(state, row - 1, col) === 3) return true;
    if (row < state.rows && countBoxEdgesTaken(state, row, col) === 3) return true;
    return false;
  }

  if (col > 0 && countBoxEdgesTaken(state, row, col - 1) === 3) return true;
  if (col < state.cols && countBoxEdgesTaken(state, row, col) === 3) return true;
  return false;
}

function lineGivesOpponentBox(state: GameState, edge: Edge): boolean {
  const horizontal = edge.from.row === edge.to.row;
  const row = Math.min(edge.from.row, edge.to.row);
  const col = Math.min(edge.from.col, edge.to.col);

  if (horizontal) {
    if (row > 0 && countBoxEdgesTaken(state, row - 1, col) === 2) return true;
    if (row < state.rows && countBoxEdgesTaken(state, row, col) === 2) return true;
    return false;
  }

  if (col > 0 && countBoxEdgesTaken(state, row, col - 1) === 2) return true;
  if (col < state.cols && countBoxEdgesTaken(state, row, col) === 2) return true;
  return false;
}

export function chooseAIMove(state: GameState): Edge | null {
  const available = state.edges.filter((edge) => !edge.takenBy);
  if (!available.length) {
    return null;
  }

  const completing = available.find((edge) => lineCompletesBox(state, edge));
  if (completing) {
    return completing;
  }

  const safe = available.find((edge) => !lineGivesOpponentBox(state, edge));
  if (safe) {
    return safe;
  }

  return available[Math.floor(Math.random() * available.length)] ?? null;
}
