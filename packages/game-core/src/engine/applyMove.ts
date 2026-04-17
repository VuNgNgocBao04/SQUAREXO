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

function getAdjacentSquaresForEdge(edge: Edge): Array<{ row: number; col: number }> {
  if (edge.from.row === edge.to.row) {
    const row = edge.from.row;
    const col = Math.min(edge.from.col, edge.to.col);
    return [
      { row: row - 1, col },
      { row, col },
    ];
  }

  const row = Math.min(edge.from.row, edge.to.row);
  const col = edge.from.col;
  return [
    { row, col: col - 1 },
    { row, col },
  ];
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

  const newEdges = state.edges.map((candidate, index) => {
    if (index !== targetIndex) {
      return candidate;
    }

    return {
      ...candidate,
      takenBy: player,
    };
  });

  const takenAfter = new Set(
    newEdges
      .filter((candidate) => !!candidate.takenBy)
      .map((candidate) => edgeKey(candidate)),
  );

  const existingBoxKeys = new Set(state.boxes.map((box) => `${box.row},${box.col}`));
  const newlyCompletedBoxes = getAdjacentSquaresForEdge(state.edges[targetIndex]).filter(({ row, col }) => {
    if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) {
      return false;
    }

    const boxKey = `${row},${col}`;
    if (existingBoxKeys.has(boxKey)) {
      return false;
    }

    const squareEdgeKeys = getSquareEdgeKeys(row, col);
    return squareEdgeKeys.every((key) => takenAfter.has(key));
  });

  const newBoxes = newlyCompletedBoxes.map(({ row, col }) => ({
    row,
    col,
    owner: player,
  }));

  const newlyCompleted = newBoxes.length;

  return {
    ...state,
    edges: newEdges,
    boxes: [...state.boxes, ...newBoxes],
    currentPlayer: newlyCompleted > 0 ? player : nextPlayer(player),
    score: {
      ...state.score,
      [player]: state.score[player] + newlyCompleted,
    },
  };
}