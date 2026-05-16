export function chooseAIMove(state) {
  for (const edge of state.edges) {
    if (!edge.takenBy) {
      return {
        from: edge.from,
        to: edge.to,
      };
    }
  }

  return null;
}
