import { useRef, useEffect, useState } from 'react'
import { createGame, applyMove } from 'game-core'
import type { GameState, Edge } from 'game-core'
import './GameCanvas.css'

const CELL_SIZE = 50
const PADDING = 20
const DOT_RADIUS = 4
const LINE_WIDTH = 2
const COLORS = {
  dot: '#333',
  empty: '#ddd',
  takenX: '#667eea',
  takenO: '#764ba2',
  highlight: '#ff6b6b',
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [game, setGame] = useState<GameState | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null)

  // Initialize game
  useEffect(() => {
    const initialGame = createGame(4, 4)
    setGame(initialGame)
  }, [])

  // Draw game on canvas
  useEffect(() => {
    if (!game || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const width = game.cols * CELL_SIZE + PADDING * 2
    const height = game.rows * CELL_SIZE + PADDING * 2

    canvas.width = width
    canvas.height = height
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, width, height)

    // Draw edges
    game.edges.forEach((edge) => {
      const x1 = edge.from.col * CELL_SIZE + PADDING
      const y1 = edge.from.row * CELL_SIZE + PADDING
      const x2 = edge.to.col * CELL_SIZE + PADDING
      const y2 = edge.to.row * CELL_SIZE + PADDING

      const isHovered =
        hoveredEdge &&
        ((edge.from.row === hoveredEdge.from.row && edge.from.col === hoveredEdge.from.col && edge.to.row === hoveredEdge.to.row && edge.to.col === hoveredEdge.to.col) ||
          (edge.from.row === hoveredEdge.to.row && edge.from.col === hoveredEdge.to.col && edge.to.row === hoveredEdge.from.row && edge.to.col === hoveredEdge.from.col))

      ctx.strokeStyle = edge.takenBy
        ? edge.takenBy === 'X'
          ? COLORS.takenX
          : COLORS.takenO
        : isHovered
          ? COLORS.highlight
          : COLORS.empty
      ctx.lineWidth = edge.takenBy ? LINE_WIDTH + 1 : LINE_WIDTH
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    })

    // Draw dots
    for (let row = 0; row <= game.rows; row++) {
      for (let col = 0; col <= game.cols; col++) {
        const x = col * CELL_SIZE + PADDING
        const y = row * CELL_SIZE + PADDING
        ctx.fillStyle = COLORS.dot
        ctx.beginPath()
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Draw scores and current player
    ctx.fillStyle = '#333'
    ctx.font = '14px sans-serif'
    ctx.fillText(`X: ${game.score.X}`, PADDING, height - PADDING + 15)
    ctx.fillText(`O: ${game.score.O}`, PADDING + 100, height - PADDING + 15)
    ctx.fillStyle = game.currentPlayer === 'X' ? COLORS.takenX : COLORS.takenO
    ctx.font = 'bold 14px sans-serif'
    ctx.fillText(`Current: ${game.currentPlayer}`, PADDING + 200, height - PADDING + 15)
  }, [game, hoveredEdge])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!game || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Find nearest edge
    let closestEdge: Edge | null = null
    let minDist = 10

    game.edges.forEach((edge) => {
      const x1 = edge.from.col * CELL_SIZE + PADDING
      const y1 = edge.from.row * CELL_SIZE + PADDING
      const x2 = edge.to.col * CELL_SIZE + PADDING
      const y2 = edge.to.row * CELL_SIZE + PADDING

      // Distance from point to line segment
      const dist = pointToSegmentDistance(x, y, x1, y1, x2, y2)
      if (dist < minDist && !edge.takenBy) {
        closestEdge = edge
        minDist = dist
      }
    })

    if (closestEdge) {
      const newState = applyMove(game, closestEdge)
      setGame(newState)
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!game || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    let closestEdge: Edge | null = null
    let minDist = 10

    game.edges.forEach((edge) => {
      if (edge.takenBy) return

      const x1 = edge.from.col * CELL_SIZE + PADDING
      const y1 = edge.from.row * CELL_SIZE + PADDING
      const x2 = edge.to.col * CELL_SIZE + PADDING
      const y2 = edge.to.row * CELL_SIZE + PADDING

      const dist = pointToSegmentDistance(x, y, x1, y1, x2, y2)
      if (dist < minDist) {
        closestEdge = edge
        minDist = dist
      }
    })

    setHoveredEdge(closestEdge)
  }

  return (
    <div className="game-canvas-container">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={() => setHoveredEdge(null)}
        className="game-canvas"
      />
    </div>
  )
}

// Utility: distance from point to line segment
function pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
  const closestX = x1 + t * dx
  const closestY = y1 + t * dy
  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2)
}
