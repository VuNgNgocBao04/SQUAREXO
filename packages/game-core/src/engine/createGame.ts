import type { Edge, GameState } from "../types/GameState.js";

function assertBoardSize(rows: number, cols: number): void {
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0) {
        throw new Error("rows and cols must be positive integers");
    }
}

export function createGame(rows: number, cols: number): GameState {
    assertBoardSize(rows, cols);

    const edges: Edge[] = [];

    for (let row = 0; row <= rows; row++) {
        for (let col = 0; col < cols; col++) {
            edges.push({
                from: { row, col },
                to: { row, col: col + 1 },
            });
        }
    }

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col <= cols; col++) {
            edges.push({
                from: { row, col },
                to: { row: row + 1, col },
            });
        }
    }

    return {
        rows,
        cols,
        edges,
        currentPlayer: "X",
        score: {
            X: 0,
            O: 0,
        },
    };
}