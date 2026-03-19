import { useEffect, useRef, useCallback } from "react";
import { useGameStore } from "../store/gameStore";
import { Edge, Point } from "@squarexo/game-core";

const DOT_RADIUS = 6;
const CELL_SIZE = 80;
const PADDING = 40;

const COLORS = {
  background: "#0f172a",
  dot: "#94a3b8",
  edgeDefault: "#1e293b",
  edgePlaced: "#475569",
  edgeHover: "#64748b",
  playerX: "#3b82f6",  // blue
  playerO: "#f97316",  // orange
  squareX: "rgba(59,130,246,0.25)",
  squareO: "rgba(249,115,22,0.25)",
  text: "#f1f5f9",
};

function dotToCanvas(point: Point): [number, number] {
  return [PADDING + point.col * CELL_SIZE, PADDING + point.row * CELL_SIZE];
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverEdgeRef = useRef<Edge | null>(null);
  const { game, makeMove } = useGameStore();

  const rows = game.rows;
  const cols = game.cols;
  const width = PADDING * 2 + (cols - 1) * CELL_SIZE;
  const height = PADDING * 2 + (rows - 1) * CELL_SIZE;

  // ─── Draw ────────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // Completed squares
    game.squares.forEach(({ topLeft, owner }) => {
      const [x, y] = dotToCanvas(topLeft);
      ctx.fillStyle = owner === "X" ? COLORS.squareX : COLORS.squareO;
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    });

    // Possible edges (hover hint)
    const hover = hoverEdgeRef.current;

    // Draw all possible edges in a faint color first, then overlay placed ones
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const from: Point = { row: r, col: c };
        // horizontal right
        if (c < cols - 1) {
          const to: Point = { row: r, col: c + 1 };
          drawEdge(ctx, { from, to }, game.edges, hover, game.currentPlayer);
        }
        // vertical down
        if (r < rows - 1) {
          const to: Point = { row: r + 1, col: c };
          drawEdge(ctx, { from, to }, game.edges, hover, game.currentPlayer);
        }
      }
    }

    // Dots
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const [x, y] = dotToCanvas({ row: r, col: c });
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.dot;
        ctx.fill();
      }
    }

    // Square labels (owner initial)
    ctx.font = "bold 18px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    game.squares.forEach(({ topLeft, owner }) => {
      const [x, y] = dotToCanvas(topLeft);
      ctx.fillStyle = owner === "X" ? COLORS.playerX : COLORS.playerO;
      ctx.fillText(owner, x + CELL_SIZE / 2, y + CELL_SIZE / 2);
    });
  }, [game, rows, cols, width, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  // ─── Input handling ──────────────────────────────────────────────────────

  function getHoveredEdge(cx: number, cy: number): Edge | null {
    const SNAP = 12; // px tolerance

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const from: Point = { row: r, col: c };
        if (c < cols - 1) {
          const to: Point = { row: r, col: c + 1 };
          if (isNearEdge(cx, cy, from, to, SNAP)) return { from, to };
        }
        if (r < rows - 1) {
          const to: Point = { row: r + 1, col: c };
          if (isNearEdge(cx, cy, from, to, SNAP)) return { from, to };
        }
      }
    }
    return null;
  }

  function isNearEdge(
    px: number,
    py: number,
    from: Point,
    to: Point,
    tolerance: number
  ): boolean {
    const [x1, y1] = dotToCanvas(from);
    const [x2, y2] = dotToCanvas(to);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    const dist = Math.hypot(px - closestX, py - closestY);
    return dist <= tolerance;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    hoverEdgeRef.current = getHoveredEdge(cx, cy);
    draw();
  }

  function handleMouseLeave() {
    hoverEdgeRef.current = null;
    draw();
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (game.status !== "playing") return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const edge = getHoveredEdge(cx, cy);
    if (edge) makeMove(edge);
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ cursor: "crosshair", borderRadius: "8px" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    />
  );
}

// ─── Helper: draw a single edge ────────────────────────────────────────────

function drawEdge(
  ctx: CanvasRenderingContext2D,
  edge: Edge,
  placed: Edge[],
  hover: Edge | null,
  currentPlayer: "X" | "O"
) {
  const { from, to } = edge;
  const [x1, y1] = dotToCanvas(from);
  const [x2, y2] = dotToCanvas(to);

  const isPlaced = placed.some(
    (e) =>
      ((e.from.row === from.row && e.from.col === from.col && e.to.row === to.row && e.to.col === to.col) ||
       (e.from.row === to.row && e.from.col === to.col && e.to.row === from.row && e.to.col === from.col))
  );

  const isHovered =
    hover !== null &&
    ((hover.from.row === from.row && hover.from.col === from.col && hover.to.row === to.row && hover.to.col === to.col) ||
     (hover.from.row === to.row && hover.from.col === to.col && hover.to.row === from.row && hover.to.col === from.col));

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);

  if (isPlaced) {
    ctx.strokeStyle = COLORS.edgePlaced;
    ctx.lineWidth = 4;
  } else if (isHovered) {
    ctx.strokeStyle = currentPlayer === "X" ? COLORS.playerX : COLORS.playerO;
    ctx.lineWidth = 4;
  } else {
    ctx.strokeStyle = COLORS.edgeDefault;
    ctx.lineWidth = 2;
  }

  ctx.stroke();
}
