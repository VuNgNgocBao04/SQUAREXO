import { GameCanvas } from "./components/GameCanvas";
import { useGameStore } from "./store/gameStore";

export default function App() {
  const { game, resetGame } = useGameStore();

  const statusMessage =
    game.status === "finished"
      ? game.winner === "draw"
        ? "It's a draw! 🤝"
        : `Player ${game.winner} wins! 🎉`
      : `Player ${game.currentPlayer}'s turn`;

  return (
    <>
      <h1 style={{ fontSize: "2rem", letterSpacing: "0.05em" }}>SquareXO</h1>

      <div style={{ display: "flex", gap: "2rem", fontSize: "1.1rem" }}>
        <span style={{ color: "#3b82f6" }}>X: {game.scores.X}</span>
        <span style={{ color: "#f97316" }}>O: {game.scores.O}</span>
      </div>

      <p style={{ color: "#94a3b8" }}>{statusMessage}</p>

      <GameCanvas />

      <button
        onClick={resetGame}
        style={{
          padding: "0.5rem 1.5rem",
          borderRadius: "6px",
          border: "none",
          background: "#334155",
          color: "#f1f5f9",
          cursor: "pointer",
          fontSize: "0.95rem",
        }}
      >
        New Game
      </button>
    </>
  );
}
