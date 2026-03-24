import type { Edge, GameState } from '../socket/events';

type GameCoreModule = {
  createGame: (rows: number, cols: number) => GameState;
  applyMove: (state: GameState, edge: Edge) => GameState;
};

let gameCoreModulePromise: Promise<GameCoreModule> | null = null;

async function getGameCoreModule(): Promise<GameCoreModule> {
  if (!gameCoreModulePromise) {
    const modulePath = '../../../game-core/dist/index.js';
    gameCoreModulePromise = import(modulePath) as Promise<GameCoreModule>;
  }
  return gameCoreModulePromise;
}

export async function createGameFromCore(rows: number, cols: number): Promise<GameState> {
  const gameCore = await getGameCoreModule();
  return gameCore.createGame(rows, cols);
}

export async function applyMoveFromCore(state: GameState, edge: Edge): Promise<GameState> {
  const gameCore = await getGameCoreModule();
  return gameCore.applyMove(state, edge);
}
