import { edgeKey } from "./edgeKey";
import type { Edge, GameState } from "../types/GameState";

export function isEdgeTaken(state: GameState, edge: Edge): boolean {
    const target = edgeKey(edge);
    return state.edges.some((candidate) => edgeKey(candidate) === target && !!candidate.takenBy);
}