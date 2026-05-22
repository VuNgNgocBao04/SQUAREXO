import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { Edge, GameState, Player } from 'game-core'
import { isEdgeTaken } from 'game-core'
import { getAccessToken } from '../services/auth'

type SocketEventName =
  | 'join_room'
  | 'make_move'
  | 'reset_game'
  | 'sync_state'
  | 'room_info'
  | 'game_state'
  | 'player_joined'
  | 'room_cleaned'
  | 'error'

const SocketEvents = {
  JOIN_ROOM: 'join_room',
  MAKE_MOVE: 'make_move',
  RESET_GAME: 'reset_game',
  SYNC_STATE: 'sync_state',
  ROOM_INFO: 'room_info',
  GAME_STATE: 'game_state',
  PLAYER_JOINED: 'player_joined',
  ROOM_CLEANED: 'room_cleaned',
  ERROR: 'error',
} as const satisfies Record<string, SocketEventName>

const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  INVALID_MOVE: 'INVALID_MOVE',
  EDGE_ALREADY_TAKEN: 'EDGE_ALREADY_TAKEN',
  RESET_FORBIDDEN: 'RESET_FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

type ErrorPayload = {
  code: ErrorCode
  message: string
  metadata?: Record<string, unknown>
}

type RoomInfoPayload = {
  roomId: string
  playerX: string | null
  playerO: string | null
  assignedPlayer: Player | null
  isFull: boolean
  boardSize: { rows: number; cols: number }
  roomUrl: string
}

type GameStatePayload = {
  roomId: string
  state: GameState
  currentPlayer: Player
}

type Stage = 'setup' | 'waiting' | 'game'

type BoardEdge = {
  edge: Edge
  kind: 'h' | 'v'
}

type BoardSize = {
  rows: number
  cols: number
}

type OnlineMultiplayerPanelProps = {
  onExitToHome?: (reason: string) => void
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
const SESSION_ROOM_KEY = 'squarexo-online-room-id'
const SESSION_PLAYER_KEY = 'squarexo-online-player-id'
const SESSION_JOINED_KEY = 'squarexo-online-joined'
const DEFAULT_BOARD: BoardSize = { rows: 3, cols: 3 }
const CONNECT_TIMEOUT_MS = 10000

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function loadRoomId(): string {
  return localStorage.getItem(SESSION_ROOM_KEY) || ''
}

function saveRoomId(roomId: string): void {
  localStorage.setItem(SESSION_ROOM_KEY, roomId)
}

function loadPlayerId(): string {
  const existing = sessionStorage.getItem(SESSION_PLAYER_KEY)
  if (existing) {
    return existing
  }

  const next = makeId('player')
  sessionStorage.setItem(SESSION_PLAYER_KEY, next)
  return next
}

function savePlayerId(playerId: string): void {
  sessionStorage.setItem(SESSION_PLAYER_KEY, playerId)
}

function loadJoinedFlag(): boolean {
  return sessionStorage.getItem(SESSION_JOINED_KEY) === '1'
}

function saveJoinedFlag(joined: boolean): void {
  sessionStorage.setItem(SESSION_JOINED_KEY, joined ? '1' : '0')
}

function mapErrorMessage(code?: ErrorCode | string): string {
  switch (code) {
    case ErrorCodes.VALIDATION_ERROR:
      return 'Invalid payload.'
    case ErrorCodes.ROOM_NOT_FOUND:
      return 'Room not found.'
    case ErrorCodes.ROOM_FULL:
      return 'The room is already full.'
    case ErrorCodes.NOT_IN_ROOM:
      return 'You are not in this room.'
    case ErrorCodes.NOT_YOUR_TURN:
      return 'It is not your turn yet.'
    case ErrorCodes.INVALID_MOVE:
      return 'Invalid move.'
    case ErrorCodes.EDGE_ALREADY_TAKEN:
      return 'That edge is already taken.'
    case ErrorCodes.RESET_FORBIDDEN:
      return 'Only room participants can reset the board.'
    case ErrorCodes.INTERNAL_ERROR:
      return 'Server internal error.'
    default:
      return 'Unknown backend error.'
  }
}

function edgeKey(edge: Edge): string {
  const from = `${edge.from.row},${edge.from.col}`
  const to = `${edge.to.row},${edge.to.col}`
  return from < to ? `${from}|${to}` : `${to}|${from}`
}

function buildEdges(rows: number, cols: number): BoardEdge[] {
  const result: BoardEdge[] = []

  for (let r = 0; r <= rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      result.push({
        kind: 'h',
        edge: { from: { row: r, col: c }, to: { row: r, col: c + 1 } },
      })
    }
  }

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c <= cols; c += 1) {
      result.push({
        kind: 'v',
        edge: { from: { row: r, col: c }, to: { row: r + 1, col: c } },
      })
    }
  }

  return result
}

export default function OnlineMultiplayerPanel({ onExitToHome }: OnlineMultiplayerPanelProps) {
  const [roomId, setRoomId] = useState(loadRoomId() || makeId('room'))
  const playerIdRef = useRef(loadPlayerId())
  const [stage, setStage] = useState<Stage>(loadJoinedFlag() ? 'waiting' : 'setup')
  const [connectionState, setConnectionState] = useState<'offline' | 'connecting' | 'online' | 'reconnecting'>('connecting')
  const [assignedPlayer, setAssignedPlayer] = useState<Player | null>(null)
  const [playerX, setPlayerX] = useState<string | null>(null)
  const [playerO, setPlayerO] = useState<string | null>(null)
  const [roomFull, setRoomFull] = useState(false)
  const [boardState, setBoardState] = useState<GameState | null>(null)
  const [currentTurn, setCurrentTurn] = useState<Player>('X')
  const [statusText, setStatusText] = useState('Connecting to backend...')
  const [errorText, setErrorText] = useState('')

  const socketRef = useRef<Socket | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hoveredEdgeRef = useRef('')
  const actionSeqRef = useRef(0)
  const activeRoomRef = useRef('')
  const shouldRejoinRef = useRef(loadJoinedFlag())
  const pendingJoinRef = useRef<null | { roomId: string; playerId: string }>(null)
  const waitingJoinRef = useRef(false)
  const connectTimeoutRef = useRef<number | null>(null)
  const autoHealAttemptedRef = useRef(false)

  const connectedLabel = useMemo(() => {
    if (connectionState === 'online') return 'Connected'
    if (connectionState === 'connecting') return 'Connecting'
    if (connectionState === 'reconnecting') return 'Reconnecting'
    return 'Offline'
  }, [connectionState])

  const persistIdentity = useCallback((nextRoomId: string, joined: boolean) => {
    saveRoomId(nextRoomId)
    saveJoinedFlag(joined)
    activeRoomRef.current = nextRoomId
  }, [])

  const clearConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current) {
      window.clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }
  }, [])

  const resetJoinAttempt = useCallback(() => {
    waitingJoinRef.current = false
    pendingJoinRef.current = null
    shouldRejoinRef.current = false
    autoHealAttemptedRef.current = false
    saveJoinedFlag(false)
    clearConnectTimeout()
  }, [clearConnectTimeout])

  const regeneratePlayerId = useCallback(() => {
    const next = makeId('player')
    playerIdRef.current = next
    savePlayerId(next)
    return next
  }, [])

  const isDuplicatePlayerIdError = useCallback((payload: ErrorPayload) => {
    if (payload.code !== ErrorCodes.VALIDATION_ERROR) return false
    return /player id.*active|already be active/i.test(payload.message)
  }, [])

  const exitToHome = useCallback(
    (reason: string) => {
      resetJoinAttempt()
      socketRef.current?.disconnect()
      socketRef.current = null
      setStage('setup')
      setConnectionState('offline')
      setStatusText(reason)
      setErrorText(reason)
      onExitToHome?.(reason)
    },
    [onExitToHome, resetJoinAttempt],
  )

  const startConnectTimeout = useCallback(() => {
    clearConnectTimeout()
    connectTimeoutRef.current = window.setTimeout(() => {
      if (!waitingJoinRef.current) return
      exitToHome('Room connection took too long. The system returned to the home screen.')
    }, CONNECT_TIMEOUT_MS)
  }, [clearConnectTimeout, exitToHome])

  const connectSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current

    setConnectionState('connecting')
    setStatusText('Connecting to backend...')

    const accessToken = getAccessToken()
    if (!accessToken) {
      setErrorText('Not logged in. Please sign in first.')
      exitToHome('Not logged in')
      return
    }

    const socket = io(BACKEND_URL, {
      auth: {
        token: accessToken,
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 5000,
    })

    socket.on('connect', () => {
      setConnectionState('online')
        setStatusText('Connected to backend successfully.')

      const pending = pendingJoinRef.current
      const roomToJoin = pending?.roomId || (shouldRejoinRef.current ? activeRoomRef.current || roomId : '')
      const playerToJoin = pending?.playerId || playerIdRef.current

      if (roomToJoin) {
        socket.emit(SocketEvents.JOIN_ROOM, {
          roomId: roomToJoin,
          rows: DEFAULT_BOARD.rows,
          cols: DEFAULT_BOARD.cols,
          playerId: playerToJoin,
        })
        pendingJoinRef.current = null
      }
    })

    socket.on('disconnect', () => {
      setConnectionState('offline')
      setStatusText('Disconnected, waiting to reconnect...')
    })

    socket.on('reconnect_attempt', () => {
      setConnectionState('reconnecting')
      setStatusText('Trying to reconnect...')
    })

    socket.on(SocketEvents.ROOM_INFO, (payload: RoomInfoPayload) => {
      resetJoinAttempt()
      setAssignedPlayer(payload.assignedPlayer)
      setPlayerX(payload.playerX)
      setPlayerO(payload.playerO)
      setRoomFull(payload.isFull)
      setStage(payload.isFull ? 'game' : 'waiting')
      setStatusText(
        payload.isFull
          ? `The room is full. You are ${payload.assignedPlayer ?? 'spectator'}.`
          : payload.assignedPlayer
            ? `You are ${payload.assignedPlayer}. Waiting for the second player to join.`
            : 'Joined the room, waiting for the opponent.',
      )
      setErrorText('')
      persistIdentity(payload.roomId, true)
    })

    socket.on(SocketEvents.PLAYER_JOINED, (payload: RoomInfoPayload) => {
      setPlayerX(payload.playerX)
      setPlayerO(payload.playerO)
      setRoomFull(payload.isFull)
      if (payload.isFull) {
        setStage('game')
        setStatusText('Two players are present. The match has started.')
      } else {
        setStatusText('The opponent has joined the room.')
      }
    })

    socket.on(SocketEvents.GAME_STATE, (payload: GameStatePayload) => {
      if (payload.roomId !== activeRoomRef.current) return
      setBoardState(payload.state)
      setCurrentTurn(payload.currentPlayer)
      if (roomFull || payload.state.currentPlayer) {
        setStage((prev) => (prev === 'setup' ? 'waiting' : 'game'))
      }
      setStatusText('Board synchronized from the server.')
      setErrorText('')
    })

    socket.on(SocketEvents.ROOM_CLEANED, () => {
      setPlayerX(null)
      setPlayerO(null)
      setRoomFull(false)
      setAssignedPlayer(null)
      setBoardState(null)
      setStage('setup')
      setStatusText('The room is empty and has been cleaned up.')
      saveJoinedFlag(false)
      activeRoomRef.current = ''
    })

    socket.on(SocketEvents.ERROR, (payload: ErrorPayload) => {
      if (!getAccessToken() && waitingJoinRef.current && !autoHealAttemptedRef.current && isDuplicatePlayerIdError(payload)) {
        autoHealAttemptedRef.current = true
        const nextPlayerId = regeneratePlayerId()
        const retryRoomId = activeRoomRef.current || roomId.trim()
        pendingJoinRef.current = { roomId: retryRoomId, playerId: nextPlayerId }
        shouldRejoinRef.current = true
        setErrorText('')
        setStatusText('Duplicate Player ID detected, generating a new ID and retrying...')
        startConnectTimeout()

        if (socketRef.current?.connected) {
          socketRef.current.emit(SocketEvents.JOIN_ROOM, {
            roomId: retryRoomId,
            rows: DEFAULT_BOARD.rows,
            cols: DEFAULT_BOARD.cols,
            playerId: nextPlayerId,
          })
          pendingJoinRef.current = null
        }
        return
      }

      resetJoinAttempt()
      setErrorText(`[${payload.code}] ${payload.message}`)
      setStatusText(mapErrorMessage(payload.code))
      if (payload.code === ErrorCodes.ROOM_NOT_FOUND) {
        exitToHome('Room not found. The system returned to the home screen.')
      }
    })

    socketRef.current = socket
    return socket
  }, [
    exitToHome,
    isDuplicatePlayerIdError,
    persistIdentity,
    regeneratePlayerId,
    resetJoinAttempt,
    roomFull,
    roomId,
    startConnectTimeout,
  ])

  const joinRoom = useCallback(
    (mode: 'create' | 'join') => {
      const socket = socketRef.current || connectSocket()
      if (!socket) {
        return
      }
      const nextRoomId = roomId.trim() || makeId('room')

      setRoomId(nextRoomId)
      setConnectionState(socket.connected ? 'online' : 'connecting')
      setStage('waiting')
      setErrorText('')
      setStatusText(mode === 'create' ? 'Creating room...' : 'Joining room...')
      persistIdentity(nextRoomId, true)
      pendingJoinRef.current = { roomId: nextRoomId, playerId: playerIdRef.current }
      shouldRejoinRef.current = true
      waitingJoinRef.current = true
      autoHealAttemptedRef.current = false
      startConnectTimeout()

      if (socket.connected) {
        socket.emit(SocketEvents.JOIN_ROOM, {
          roomId: nextRoomId,
          rows: DEFAULT_BOARD.rows,
          cols: DEFAULT_BOARD.cols,
          playerId: playerIdRef.current,
        })
        pendingJoinRef.current = null
      }
    },
    [connectSocket, persistIdentity, roomId, startConnectTimeout],
  )

  const createRoom = useCallback(() => {
    joinRoom('create')
  }, [joinRoom])

  const sendMove = useCallback(
    (edge: Edge) => {
      const socket = socketRef.current
      if (!socket || !boardState || stage !== 'game' || !activeRoomRef.current) return
      if (assignedPlayer && currentTurn && assignedPlayer !== currentTurn) {
        setStatusText('It is not your turn yet.')
        return
      }
      if (isEdgeTaken(boardState, edge)) return

      actionSeqRef.current += 1
      socket.emit(SocketEvents.MAKE_MOVE, {
        roomId: activeRoomRef.current,
        actionId: `action-${Date.now()}-${actionSeqRef.current}`,
        edge,
      })
    },
    [assignedPlayer, boardState, currentTurn, stage],
  )

  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !boardState) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { rows, cols, edges } = boardState
    const pad = 28
    const size = canvas.width
    const cellW = (size - pad * 2) / cols
    const cellH = (size - pad * 2) / rows
    const edgeMap = new Map(edges.map((edge) => [edgeKey(edge), edge]))

    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = 'rgba(255,255,255,0.02)'
    ctx.fillRect(0, 0, size, size)

    for (let r = 0; r <= rows; r += 1) {
      for (let c = 0; c <= cols; c += 1) {
        const x = pad + c * cellW
        const y = pad + r * cellH
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.fillStyle = '#e0f0ff'
        ctx.fill()
      }
    }

    for (const { edge, kind } of buildEdges(rows, cols)) {
      const key = edgeKey(edge)
      const x1 = pad + edge.from.col * cellW
      const y1 = pad + edge.from.row * cellH
      const x2 = pad + edge.to.col * cellW
      const y2 = pad + edge.to.row * cellH
      const takenBy = edgeMap.get(key)?.takenBy
      const isHover = hoveredEdgeRef.current === key

      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.lineWidth = kind === 'h' ? 6 : 6
      ctx.lineCap = 'round'
      ctx.strokeStyle =
        takenBy === 'X' ? '#00f5ff' : takenBy === 'O' ? '#ff006e' : isHover ? '#ffd60a' : 'rgba(255,255,255,0.12)'
      ctx.stroke()
    }
  }, [boardState])

  const locateEdgeFromPointer = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (!boardState || !canvasRef.current) return null
      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const mx = (event.clientX - rect.left) * scaleX
      const my = (event.clientY - rect.top) * scaleY
      const { rows, cols } = boardState
      const pad = 28
      const cellW = (canvas.width - pad * 2) / cols
      const cellH = (canvas.height - pad * 2) / rows
      const snap = 18

      for (let r = 0; r <= rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const y = pad + r * cellH
          const x1 = pad + c * cellW
          const x2 = pad + (c + 1) * cellW
          if (Math.abs(my - y) < snap && mx > x1 + 8 && mx < x2 - 8) {
            return { edge: { from: { row: r, col: c }, to: { row: r, col: c + 1 } } }
          }
        }
      }

      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c <= cols; c += 1) {
          const x = pad + c * cellW
          const y1 = pad + r * cellH
          const y2 = pad + (r + 1) * cellH
          if (Math.abs(mx - x) < snap && my > y1 + 8 && my < y2 - 8) {
            return { edge: { from: { row: r, col: c }, to: { row: r + 1, col: c } } }
          }
        }
      }

      return null
    },
    [boardState],
  )

  const onCanvasMove = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      const hit = locateEdgeFromPointer(event)
      hoveredEdgeRef.current = hit ? edgeKey(hit.edge) : ''
      drawBoard()
    },
    [drawBoard, locateEdgeFromPointer],
  )

  const onCanvasLeave = useCallback(() => {
    hoveredEdgeRef.current = ''
    drawBoard()
  }, [drawBoard])

  const onCanvasClick = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      const hit = locateEdgeFromPointer(event)
      if (!hit) return
      sendMove(hit.edge)
    },
    [locateEdgeFromPointer, sendMove],
  )

  useEffect(() => {
    connectSocket()
    return () => {
      clearConnectTimeout()
      socketRef.current?.disconnect()
    }
  }, [clearConnectTimeout, connectSocket])

  useEffect(() => {
    if (stage !== 'game' && stage !== 'waiting') return
    drawBoard()
  }, [boardState, currentTurn, drawBoard, stage])

  useEffect(() => {
    saveRoomId(roomId)
  }, [roomId])

  const boardLabel = boardState ? `${boardState.rows}×${boardState.cols}` : `${DEFAULT_BOARD.rows}×${DEFAULT_BOARD.cols}`

  return (
    <section className="backend-demo-card online-room-card">
      {stage === 'setup' && (
        <>
          <div className="backend-demo-title">Online 2-Player Mode</div>
          <div className="backend-demo-subtitle">Enter a room code, then create or join a room. Player IDs are generated automatically.</div>

          <div className="backend-grid">
            <label className="backend-field">
              Room ID
              <input value={roomId} onChange={(event) => setRoomId(event.target.value)} />
            </label>
          </div>

          <div className="backend-actions online-actions">
            <button className="btn-primary" onClick={createRoom}>
              Create room
            </button>
            <button className="btn-primary" onClick={() => joinRoom('join')}>
              Join room
            </button>
          </div>

          <div className="backend-log-box online-log-box">
            <div className="backend-log-line muted">{connectedLabel} · {statusText}</div>
            {errorText && <div className="backend-log-line">{errorText}</div>}
          </div>
        </>
      )}

      {stage === 'waiting' && (
        <>
          <div className="backend-demo-title">Waiting Room</div>
          <div className="backend-demo-subtitle">Waiting for the second player to join...</div>

          <div className="room-code-box room-code-box--wide">
            <div className="code-label">Room ID</div>
            <div className="code-val">{roomId}</div>
            <div className="code-hint">Share this Room ID with the other player</div>
            <div className="players-row">
              <div className="player-slot">
                <div className="slot-avatar p1">X</div>
                <div className="slot-name">{playerX || 'You'}</div>
              </div>
              <div className="vs-sep">VS</div>
              <div className="player-slot">
                <div className={`slot-avatar ${roomFull ? 'p2' : 'empty'}`}>{roomFull ? 'O' : '?'}</div>
                <div className="slot-name">{playerO || 'Waiting...'}</div>
              </div>
            </div>
          </div>

          <div className="backend-log-box online-log-box">
            <div className="backend-log-line muted">{connectedLabel} · {statusText}</div>
            <div className="backend-log-line muted">Board: {boardLabel}</div>
            {errorText && <div className="backend-log-line">{errorText}</div>}
          </div>
        </>
      )}

      {stage === 'game' && (
        <>
          <div className="scoreboard scoreboard--wide">
            <div className={`p-card ${currentTurn === 'X' ? 'active' : ''}`}>
              <div className="p-name">PLAYER <span className="player-color player-p1">X</span></div>
              <div className="p-score score-p1">{boardState?.score.X ?? 0}</div>
              <div className="p-boxes">{boardState?.score.X ?? 0} ô</div>
            </div>
            <div className="vs">VS</div>
            <div className={`p-card p2 ${currentTurn === 'O' ? 'active' : ''}`}>
              <div className="p-name">PLAYER <span className="player-color player-p2">O</span></div>
              <div className="p-score score-p2">{boardState?.score.O ?? 0}</div>
              <div className="p-boxes">{boardState?.score.O ?? 0} ô</div>
            </div>
          </div>

          <div className="turn-pill turn-pill--spaced">
            Turn: <span className={currentTurn === 'X' ? 'turn-pill-highlight turn-pill-highlight-p1' : 'turn-pill-highlight turn-pill-highlight-p2'}>{currentTurn}</span>
          </div>

          <div className="board-wrap board-wrap--full">
            <canvas
              className="online-board-canvas"
              ref={canvasRef}
              width={560}
              height={560}
              onMouseMove={onCanvasMove}
              onMouseLeave={onCanvasLeave}
              onClick={onCanvasClick}
            />
          </div>

          <div className="backend-log-box online-log-box">
            <div className="backend-log-line muted">{connectedLabel} · {statusText}</div>
            <div className="backend-log-line muted">Board: {boardLabel}</div>
            {errorText && <div className="backend-log-line">{errorText}</div>}
          </div>
        </>
      )}
    </section>
  )
}


