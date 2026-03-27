import type { Edge, Point } from "../types/GameState.js";

function toOrderedPair(a: Point, b: Point): [Point, Point] {
  if (a.row < b.row) return [a, b];
  if (a.row > b.row) return [b, a];
  if (a.col <= b.col) return [a, b];
  return [b, a];
}

export function edgeKey(edge: Pick<Edge, "from" | "to">): string {
  const [start, end] = toOrderedPair(edge.from, edge.to);
  return `${start.row},${start.col}-${end.row},${end.col}`;
}
