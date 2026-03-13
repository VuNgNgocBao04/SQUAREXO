export function getInitialBoard() {
  return {
    cells: Array(9).fill(null),
    edges: [],
    squares: [],
  }
}

export function calculateNextTurn(currentTurn) {
  return currentTurn === 'X' ? 'O' : 'X'
}
