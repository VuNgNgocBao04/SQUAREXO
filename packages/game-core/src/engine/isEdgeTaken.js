import { edgeKey } from "./edgeKey.js";
export function isEdgeTaken(state, edge) {
    const target = edgeKey(edge);
    return state.edges.some((candidate) => edgeKey(candidate) === target && !!candidate.takenBy);
}
