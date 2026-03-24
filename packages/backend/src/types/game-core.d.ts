declare module 'game-core' {
  export function createGame(rows: number, cols: number): import('../socket/events').GameState;
  export function applyMove(
    state: import('../socket/events').GameState,
    edge: import('../socket/events').Edge
  ): import('../socket/events').GameState;
}
