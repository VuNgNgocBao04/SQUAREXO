import { describe, expect, it } from "vitest";

import { applyMove } from "../src/engine/applyMove";
import { createGame } from "../src/engine/createGame";
import { isEdgeTaken } from "../src/engine/isEdgeTaken";
import type { Edge } from "../src/types/GameState";

function edge(fromRow: number, fromCol: number, toRow: number, toCol: number): Edge {
  return {
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol },
  };
}

describe("game-core", () => {
  it("createGame(rows, cols) creates valid initial state", () => {
    const state = createGame(2, 3);

    expect(state.rows).toBe(2);
    expect(state.cols).toBe(3);
    expect(state.currentPlayer).toBe("X");
    expect(state.score).toEqual({ X: 0, O: 0 });
    expect(state.edges.length).toBe((2 + 1) * 3 + 2 * (3 + 1));
  });

  it("applyMove returns a new immutable state", () => {
    const initial = createGame(1, 1);
    const top = edge(0, 0, 0, 1);

    const next = applyMove(initial, top);

    expect(next).not.toBe(initial);
    expect(next.edges).not.toBe(initial.edges);
    expect(initial.edges.some((candidate) => candidate.takenBy)).toBe(false);
    expect(isEdgeTaken(next, top)).toBe(true);
  });

  it("does not depend on edge direction when matching edge", () => {
    const initial = createGame(1, 1);
    const top = edge(0, 0, 0, 1);
    const topReversed = edge(0, 1, 0, 0);

    const next = applyMove(initial, topReversed);

    expect(isEdgeTaken(next, top)).toBe(true);
    expect(isEdgeTaken(next, topReversed)).toBe(true);
  });

  it("throws for invalid edge or already taken edge", () => {
    const state = createGame(1, 1);

    expect(() => applyMove(state, edge(0, 0, 1, 1))).toThrow("Invalid edge for this board");

    const moved = applyMove(state, edge(0, 0, 0, 1));
    expect(() => applyMove(moved, edge(0, 0, 0, 1))).toThrow("Edge already taken");
  });

  it("keeps turn and scores when completing a square", () => {
    let state = createGame(1, 1);

    state = applyMove(state, edge(0, 0, 0, 1));
    expect(state.currentPlayer).toBe("O");

    state = applyMove(state, edge(0, 0, 1, 0));
    expect(state.currentPlayer).toBe("X");

    state = applyMove(state, edge(1, 0, 1, 1));
    expect(state.currentPlayer).toBe("O");

    state = applyMove(state, edge(0, 1, 1, 1));
    expect(state.score).toEqual({ X: 0, O: 1 });
    expect(state.currentPlayer).toBe("O");
  });
});
