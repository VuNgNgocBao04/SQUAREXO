import { edgeKey } from "./edgeKey.js";
import type { Edge, GameState } from "../types/GameState.js";

export function isEdgeTaken(state: GameState, edge: Edge): boolean {
    const target = edgeKey(edge);
    return state.edges.some((candidate) => edgeKey(candidate) === target && !!candidate.takenBy);
}