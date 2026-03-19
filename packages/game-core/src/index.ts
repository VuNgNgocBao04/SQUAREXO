// ─── Core Types ────────────────────────────────────────────────────────────

export type Player = "X" | "O";

export type CellState = Player | null;

/** A single dot coordinate on the grid */
export interface Point {
  row: number;
  col: number;
}

/**
 * An edge between two adjacent dots.
 * Use canonical form: topLeft is always the dot with the smaller (row, col).
 */
export interface Edge {
  from: Point;
  to: Point;
}

/** A completed square owned by a player */
export interface Square {
  topLeft: Point;
  owner: Player;
}

export type GameStatus = "waiting" | "playing" | "finished";

export interface GameState {
  /** Number of columns of dots (n → n-1 columns of cells) */
  cols: number;
  /** Number of rows of dots (n → n-1 rows of cells) */
  rows: number;
  edges: Edge[];
  squares: Square[];
  scores: Record<Player, number>;
  currentPlayer: Player;
  status: GameStatus;
  winner: Player | "draw" | null;
}

// ─── Engine ────────────────────────────────────────────────────────────────

/** Create a fresh game state for a grid of (rows × cols) dots */
export function createGame(rows: number, cols: number): GameState {
  return {
    rows,
    cols,
    edges: [],
    squares: [],
    scores: { X: 0, O: 0 },
    currentPlayer: "X",
    status: "playing",
    winner: null,
  };
}

/** Check whether two edges are equal (order-insensitive) */
export function edgesEqual(a: Edge, b: Edge): boolean {
  return (
    (pointsEqual(a.from, b.from) && pointsEqual(a.to, b.to)) ||
    (pointsEqual(a.from, b.to) && pointsEqual(a.to, b.from))
  );
}

function pointsEqual(a: Point, b: Point): boolean {
  return a.row === b.row && a.col === b.col;
}

/** Returns true if the edge has already been claimed */
export function isEdgeTaken(state: GameState, edge: Edge): boolean {
  return state.edges.some((e) => edgesEqual(e, edge));
}

/**
 * Attempt to place an edge for the current player.
 * Returns a new GameState (immutable update) or throws if the move is invalid.
 */
export function applyMove(state: GameState, edge: Edge): GameState {
  if (state.status !== "playing") {
    throw new Error("Game is not in progress.");
  }
  if (isEdgeTaken(state, edge)) {
    throw new Error("Edge already taken.");
  }

  const newEdges = [...state.edges, edge];
  const newSquares = detectNewSquares(newEdges, state.rows, state.cols, state.currentPlayer);
  const allSquares = [...state.squares, ...newSquares];

  const newScores: Record<Player, number> = {
    X: state.scores.X,
    O: state.scores.O,
  };
  newSquares.forEach((sq) => {
    newScores[sq.owner] += 1;
  });

  const totalCells = (state.rows - 1) * (state.cols - 1);
  const totalScored = newScores.X + newScores.O;
  const gameOver = totalScored === totalCells;

  // Player keeps turn when they complete at least one square; otherwise switches
  const nextPlayer: Player =
    newSquares.length > 0 ? state.currentPlayer : state.currentPlayer === "X" ? "O" : "X";

  let winner: GameState["winner"] = null;
  let status: GameStatus = "playing";
  if (gameOver) {
    status = "finished";
    if (newScores.X > newScores.O) winner = "X";
    else if (newScores.O > newScores.X) winner = "O";
    else winner = "draw";
  }

  return {
    ...state,
    edges: newEdges,
    squares: allSquares,
    scores: newScores,
    currentPlayer: nextPlayer,
    status,
    winner,
  };
}

/**
 * Scan the board for newly completed squares after adding the latest edges.
 * A 1×1 square is complete when all four of its edges exist.
 */
function detectNewSquares(
  edges: Edge[],
  rows: number,
  cols: number,
  player: Player
): Square[] {
  const newSquares: Square[] = [];

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const topLeft: Point = { row: r, col: c };
      const topRight: Point = { row: r, col: c + 1 };
      const bottomLeft: Point = { row: r + 1, col: c };
      const bottomRight: Point = { row: r + 1, col: c + 1 };

      const required: Edge[] = [
        { from: topLeft, to: topRight },      // top
        { from: bottomLeft, to: bottomRight }, // bottom
        { from: topLeft, to: bottomLeft },     // left
        { from: topRight, to: bottomRight },   // right
      ];

      if (required.every((req) => edges.some((e) => edgesEqual(e, req)))) {
        newSquares.push({ topLeft, owner: player });
      }
    }
  }

  return newSquares;
}
