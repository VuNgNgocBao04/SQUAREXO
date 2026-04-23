import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { createGame, chooseAIMove, type Edge as CoreEdge, type GameState as CoreGameState } from 'game-core'
import { ethers } from 'ethers'
import * as sapphire from '@oasisprotocol/sapphire-paratime'
import './App.css'

type Screen = 'auth' | 'home' | 'game' | 'history' | 'room' | 'waiting' | 'settings' | 'profile'
type GameMode = 'pvp' | 'ai'
type LineType = 'h' | 'v'
type ThemeMode = 'dark' | 'light'
type AuthTab = 'login' | 'register'

type User = {
  id: string
  username: string
  email?: string
  avatar?: string
  joinedDate?: string
}

type Line = {
  type: LineType
  r: number
  c: number
}

type HistoryRecord = {
  id: number
  date: string
  gridSize: number
  mode: GameMode
  scores: [number, number]
  winner: number
  stake: number
  tx: string
  moves: number
}

type RoomMessage = {
  id: number
  user: string
  msg: string
}

type OnlinePlayer = 'X' | 'O'

type RoomInfoPayload = {
  roomId: string
  playerX: string | null
  playerO: string | null
  assignedPlayer: OnlinePlayer | null
  isFull: boolean
  boardSize: { rows: number; cols: number }
}

type GameStatePayload = {
  roomId: string
  currentPlayer: OnlinePlayer
  state: {
    rows: number
    cols: number
    currentPlayer: OnlinePlayer
    score: { X: number; O: number }
    boxes?: Array<{ row: number; col: number; owner: OnlinePlayer }>
    edges: Array<{
      from: { row: number; col: number }
      to: { row: number; col: number }
      takenBy?: OnlinePlayer
    }>
  }
}

type ChatMessagePayload = {
  roomId: string
  playerId: string
  message: string
  sentAt: number
}

type SocketErrorPayload = {
  code?: string
  message: string
}

type MatchSettledPayload = {
  roomId: string
  txHash?: string
  winnerWallet?: string | null
}

type ServerHistoryRecord = {
  id: string
  roomId: string
  playerX: string
  playerO: string
  winnerPlayer: 'X' | 'O' | 'draw'
  scoreX: number
  scoreO: number
  totalMoves: number
  gridSize: number
  gameMode: GameMode
  stakeRose: number
  txHash?: string
  startedAt: string
  endedAt: string
  createdAt?: string
}

type HistorySyncPayload = {
  wallet: string
  items: Array<{
    roomId: string
    playerX?: string
    playerO?: string
    winnerPlayer: 'X' | 'O' | 'draw'
    scoreX: number
    scoreO: number
    totalMoves: number
    gridSize: number
    gameMode: GameMode
    stakeRose: number
    txHash?: string
    startedAt?: string
    endedAt: string
  }>
}

const DOT = 18
const PAD = 32
const SNAP = 20

function createEmptyState(size: number) {
  return {
    hLines: Array.from({ length: size + 1 }, () => new Array(size).fill(0)),
    vLines: Array.from({ length: size }, () => new Array(size + 1).fill(0)),
    boxes: Array.from({ length: size }, () => new Array(size).fill(0)),
  }
}

function genTxHash() {
  return (
    '0x' +
    Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0'),
    ).join('')
  )
}

function genRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

function normalizeRoomId(roomId: string) {
  return roomId.trim().toUpperCase()
}

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL && typeof import.meta.env.VITE_BACKEND_URL === 'string'
    ? import.meta.env.VITE_BACKEND_URL
    : 'http://localhost:3000'

type OasisNetworkKey = 'testnet' | 'mainnet'

type OasisNetworkConfig = {
  chainId: bigint
  chainHex: string
  chainName: string
  currencyName: string
  rpcUrls: string[]
  blockExplorerUrls: string[]
}

const OASIS_NETWORKS: Record<OasisNetworkKey, OasisNetworkConfig> = {
  testnet: {
    chainId: 0x5affn,
    chainHex: '0x5aff',
    chainName: 'Oasis Sapphire Testnet',
    currencyName: 'Test ROSE',
    rpcUrls: ['https://testnet.sapphire.oasis.io'],
    blockExplorerUrls: ['https://explorer.oasis.io/testnet/sapphire'],
  },
  mainnet: {
    chainId: 0x5afen,
    chainHex: '0x5afe',
    chainName: 'Oasis Sapphire',
    currencyName: 'ROSE',
    rpcUrls: ['https://sapphire.oasis.io'],
    blockExplorerUrls: ['https://explorer.oasis.io/mainnet/sapphire'],
  },
}

const selectedOasisNetwork: OasisNetworkKey = import.meta.env.VITE_OASIS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
const baseOasisNetworkConfig = OASIS_NETWORKS[selectedOasisNetwork]
const configuredRpcUrls = [
  import.meta.env.VITE_OASIS_RPC_URL,
  ...(import.meta.env.VITE_OASIS_RPC_FALLBACK_URLS ?? '').split(',').map((item) => item.trim()),
]
  .filter((item): item is string => typeof item === 'string' && item.length > 0)

const OASIS_CONFIG: OasisNetworkConfig = {
  ...baseOasisNetworkConfig,
  rpcUrls: configuredRpcUrls.length > 0 ? Array.from(new Set(configuredRpcUrls)) : baseOasisNetworkConfig.rpcUrls,
}

const OASIS_CHAIN_ID = OASIS_CONFIG.chainId
const OASIS_CHAIN_HEX = OASIS_CONFIG.chainHex
const OASIS_CHAIN_NAME = OASIS_CONFIG.chainName
const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined) ?? ''

const squarexoMatchAbi = [
  'function createMatch(string roomId, uint256 betAmount) payable',
  'function joinMatch(string roomId) payable',
  'function claimReward(string roomId)',
] as const

function createRuntimePlayerId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `player_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  }
  return `player_${Math.random().toString(36).slice(2, 14)}`
}

function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('dbTheme')
    return saved === 'light' ? 'light' : 'dark'
  })

  // Auth state
  const [authUser, setAuthUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('dbAuthUser')
      return saved ? (JSON.parse(saved) as User) : null
    } catch {
      return null
    }
  })
  const [authTab, setAuthTab] = useState<AuthTab>('login')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [screen, setScreen] = useState<Screen>(() => (authUser ? 'home' : 'auth'))
  const [prevScreen, setPrevScreen] = useState<Exclude<Screen, 'settings'>>('home')
  const [gridSize, setGridSize] = useState(3)
  const [gameMode, setGameMode] = useState<GameMode>('pvp')
  const [stakeEth, setStakeEth] = useState(0.01)
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [roomPlayers, setRoomPlayers] = useState(1)
  const [roomCountdown, setRoomCountdown] = useState<number | null>(null)
  const [onlineConnected, setOnlineConnected] = useState(false)
  const [onlineAssignedPlayer, setOnlineAssignedPlayer] = useState<OnlinePlayer | null>(null)
  const [isOnlineMatch, setIsOnlineMatch] = useState(false)
  const [roomChat, setRoomChat] = useState<RoomMessage[]>([
    { id: 1, user: 'System', msg: 'Phòng chờ đã được tạo. Chia sẻ mã phòng để đối thủ tham gia.' },
  ])
  const [chatMsg, setChatMsg] = useState('')

  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('Chưa kết nối')
  const [walletBalance, setWalletBalance] = useState('0.0000')
  const [walletPending, setWalletPending] = useState(false)
  const [chainStatus, setChainStatus] = useState<'idle' | 'staking' | 'playing' | 'settling' | 'settled'>('idle')

  const [currentPlayer, setCurrentPlayer] = useState(1)
  const [scores, setScores] = useState<[number, number]>([0, 0])
  const [totalMoves, setTotalMoves] = useState(0)
  const [gameActive, setGameActive] = useState(false)
  const [blockNum, setBlockNum] = useState(4892341)
  const [hoveredLine, setHoveredLine] = useState<Line | null>(null)
  const [canvasSize, setCanvasSize] = useState(420)
  const [drawVersion, setDrawVersion] = useState(0)

  const [toast, setToast] = useState<string | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)

  const [gameHistory, setGameHistory] = useState<HistoryRecord[]>(() => {
    try {
      const raw = localStorage.getItem('dbChainHistory')
      return raw ? (JSON.parse(raw) as HistoryRecord[]) : []
    } catch {
      return []
    }
  })

  const [modalState, setModalState] = useState({
    open: false,
    icon: '🏆',
    title: 'X THẮNG!',
    sub: 'Kết quả đang được ghi lên blockchain...',
    tx: 'Tx: 0x...',
  })

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const clientSequenceRef = useRef(0)
  const blockIntervalRef = useRef<number | null>(null)
  const aiTimeoutRef = useRef<number | null>(null)
  const chainTimeoutRef = useRef<number | null>(null)
  const countdownRef = useRef<number | null>(null)
  const matchCountdownValueRef = useRef<number | null>(null)
  const endModalShownRef = useRef(false)
  const endGameRef = useRef<(() => void) | null>(null)

  const hLinesRef = useRef<number[][]>([])
  const vLinesRef = useRef<number[][]>([])
  const boxesRef = useRef<number[][]>([])

  const currentPlayerRef = useRef(1)
  const scoresRef = useRef<[number, number]>([0, 0])
  const totalMovesRef = useRef(0)
  const gameActiveRef = useRef(false)
  const gridSizeRef = useRef(3)
  const roomCodeRef = useRef('')
  const roomPlayersRef = useRef(1)
  const gameModeRef = useRef<GameMode>('pvp')
  const stakeEthRef = useRef(0.01)
  const clientPlayerIdRef = useRef(createRuntimePlayerId())

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current)
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null)
    }, 3000)
  }, [])

  const readLocalHistory = useCallback((): HistoryRecord[] => {
    try {
      const raw = localStorage.getItem('dbChainHistory')
      return raw ? (JSON.parse(raw) as HistoryRecord[]) : []
    } catch {
      return []
    }
  }, [])

  const saveLocalHistory = useCallback((records: HistoryRecord[]) => {
    localStorage.setItem('dbChainHistory', JSON.stringify(records))
  }, [])

  const toServerHistoryItem = useCallback((record: HistoryRecord) => {
    const winnerPlayer: 'X' | 'O' | 'draw' = record.winner === 1 ? 'X' : record.winner === 2 ? 'O' : 'draw'
    return {
      roomId: record.id.toString(),
      playerX: 'local-player-x',
      playerO: 'local-player-o',
      winnerPlayer,
      scoreX: record.scores[0],
      scoreO: record.scores[1],
      totalMoves: record.moves,
      gridSize: record.gridSize,
      gameMode: record.mode,
      stakeRose: record.stake,
      txHash: record.tx,
      startedAt: new Date(Date.now() - 60000).toISOString(),
      endedAt: new Date(record.date).toISOString(),
    }
  }, [])

  const fromServerHistoryRecord = useCallback((record: ServerHistoryRecord): HistoryRecord => {
    const winner = record.winnerPlayer === 'X' ? 1 : record.winnerPlayer === 'O' ? 2 : 0
    return {
      id: Number.parseInt(record.id.replace(/\D/g, '').slice(0, 12) || `${Date.now()}`, 10),
      date: new Date(record.endedAt).toLocaleString('vi-VN'),
      gridSize: record.gridSize,
      mode: record.gameMode,
      scores: [record.scoreX, record.scoreO],
      winner,
      stake: record.stakeRose,
      tx: record.txHash || 'Tx: N/A',
      moves: record.totalMoves,
    }
  }, [])

  const syncPendingHistoryToServer = useCallback(
    async (wallet: string) => {
      const pending = readLocalHistory()
      if (!pending.length) {
        return
      }

      const payload: HistorySyncPayload = {
        wallet,
        items: pending.map((record) => toServerHistoryItem(record)),
      }

      const response = await fetch(`${BACKEND_URL}/api/history/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`History sync failed (${response.status})`)
      }

      localStorage.removeItem('dbChainHistory')
    },
    [readLocalHistory, toServerHistoryItem],
  )

  const fetchHistoryFromServer = useCallback(async (wallet: string) => {
    const response = await fetch(`${BACKEND_URL}/api/history?wallet=${encodeURIComponent(wallet)}`)
    if (!response.ok) {
      throw new Error(`History fetch failed (${response.status})`)
    }

    const data = (await response.json()) as { items?: ServerHistoryRecord[] }
    return Array.isArray(data.items) ? data.items.map(fromServerHistoryRecord) : []
  }, [fromServerHistoryRecord])

  const setCurrentPlayerSafe = useCallback((player: number) => {
    currentPlayerRef.current = player
    setCurrentPlayer(player)
  }, [])

  const setScoresSafe = useCallback((nextScores: [number, number]) => {
    scoresRef.current = nextScores
    setScores(nextScores)
  }, [])

  const setTotalMovesSafe = useCallback((moves: number) => {
    totalMovesRef.current = moves
    setTotalMoves(moves)
  }, [])

  const clearTimers = useCallback(() => {
    if (blockIntervalRef.current) {
      window.clearInterval(blockIntervalRef.current)
      blockIntervalRef.current = null
    }
    if (aiTimeoutRef.current) {
      window.clearTimeout(aiTimeoutRef.current)
      aiTimeoutRef.current = null
    }
    if (chainTimeoutRef.current) {
      window.clearTimeout(chainTimeoutRef.current)
      chainTimeoutRef.current = null
    }
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    matchCountdownValueRef.current = null
  }, [])

  const updateRoomPlayers = useCallback((count: number) => {
    roomPlayersRef.current = count
    setRoomPlayers(count)
  }, [])

  const setRoomCodeSafe = useCallback((code: string) => {
    roomCodeRef.current = code
    setRoomCode(code)
  }, [])

  const stopMatchCountdown = useCallback(() => {
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    matchCountdownValueRef.current = null
    setRoomCountdown(null)
  }, [])

  const startMatchCountdown = useCallback(() => {
    if (countdownRef.current) {
      return
    }

    let remaining = 10
    matchCountdownValueRef.current = remaining
    setRoomCountdown(remaining)
    setRoomChat((prev) => {
      if (prev.some((item) => item.msg.includes('Bắt đầu sau 10 giây'))) {
        return prev
      }
      return [...prev, { id: Date.now(), user: 'System', msg: 'Đủ người chơi. Bắt đầu sau 10 giây...' }]
    })

    countdownRef.current = window.setInterval(() => {
      remaining -= 1
      matchCountdownValueRef.current = remaining
      setRoomCountdown(remaining)
      if (remaining <= 0) {
        if (countdownRef.current) {
          window.clearInterval(countdownRef.current)
          countdownRef.current = null
        }
        matchCountdownValueRef.current = null
        setRoomCountdown(null)
        setScreen('game')
      }
    }, 1000)
  }, [])

  const getChatAuthor = useCallback((playerId: string) => {
    if (playerId === clientPlayerIdRef.current) {
      return 'Bạn'
    }
    return 'Đối thủ'
  }, [])

  const edgeToLine = useCallback((edge: CoreEdge): Line => {
    if (edge.from.row === edge.to.row) {
      return {
        type: 'h',
        r: edge.from.row,
        c: Math.min(edge.from.col, edge.to.col),
      }
    }

    return {
      type: 'v',
      r: Math.min(edge.from.row, edge.to.row),
      c: edge.from.col,
    }
  }, [])

  const toCoreGameState = useCallback((): CoreGameState => {
    const base = createGame(gridSizeRef.current, gridSizeRef.current)
    const takenMap = new Map<string, 'X' | 'O'>()

    for (let r = 0; r <= gridSizeRef.current; r++) {
      for (let c = 0; c < gridSizeRef.current; c++) {
        const owner = hLinesRef.current[r]?.[c]
        if (owner) {
          takenMap.set(`${r},${c}-${r},${c + 1}`, owner === 1 ? 'X' : 'O')
        }
      }
    }

    for (let r = 0; r < gridSizeRef.current; r++) {
      for (let c = 0; c <= gridSizeRef.current; c++) {
        const owner = vLinesRef.current[r]?.[c]
        if (owner) {
          takenMap.set(`${r},${c}-${r + 1},${c}`, owner === 1 ? 'X' : 'O')
        }
      }
    }

    const edges = base.edges.map((edge) => {
      const key = `${edge.from.row},${edge.from.col}-${edge.to.row},${edge.to.col}`
      const takenBy = takenMap.get(key)
      return takenBy ? { ...edge, takenBy } : edge
    })

    return {
      ...base,
      edges,
      currentPlayer: currentPlayerRef.current === 1 ? 'X' : 'O',
      score: {
        X: scoresRef.current[0],
        O: scoresRef.current[1],
      },
    }
  }, [])

  const hydrateFromServerState = useCallback(
    (payload: GameStatePayload) => {
      const rows = payload.state.rows
      const cols = payload.state.cols
      if (rows !== cols) {
        showToast('Phiên bản giao diện hiện hỗ trợ bàn cờ vuông.')
      }

      const effectiveSize = rows
      gridSizeRef.current = effectiveSize
      setGridSize(effectiveSize)

      const next = createEmptyState(effectiveSize)
      let takenMoves = 0

      for (const edge of payload.state.edges) {
        if (!edge.takenBy) continue
        const owner = edge.takenBy === 'X' ? 1 : 2
        if (edge.from.row === edge.to.row) {
          const row = edge.from.row
          const col = Math.min(edge.from.col, edge.to.col)
          if (row >= 0 && row <= effectiveSize && col >= 0 && col < effectiveSize) {
            next.hLines[row][col] = owner
            takenMoves += 1
          }
        } else {
          const row = Math.min(edge.from.row, edge.to.row)
          const col = edge.from.col
          if (row >= 0 && row < effectiveSize && col >= 0 && col <= effectiveSize) {
            next.vLines[row][col] = owner
            takenMoves += 1
          }
        }
      }

      if (payload.state.boxes?.length) {
        for (const box of payload.state.boxes) {
          if (box.row >= 0 && box.row < effectiveSize && box.col >= 0 && box.col < effectiveSize) {
            next.boxes[box.row][box.col] = box.owner === 'X' ? 1 : 2
          }
        }
      }

      hLinesRef.current = next.hLines
      vLinesRef.current = next.vLines
      boxesRef.current = next.boxes
      setScoresSafe([payload.state.score.X, payload.state.score.O])
      setCurrentPlayerSafe(payload.state.currentPlayer === 'X' ? 1 : 2)
      setTotalMovesSafe(takenMoves)
      gameActiveRef.current = true
      setGameActive(true)
      setDrawVersion((v) => v + 1)

      const filledBoxes = payload.state.score.X + payload.state.score.O
      const totalBoxes = payload.state.rows * payload.state.cols
      if (filledBoxes >= totalBoxes && !endModalShownRef.current) {
        endModalShownRef.current = true
        window.setTimeout(() => {
          endGameRef.current?.()
        }, 200)
      }
    },
    [setCurrentPlayerSafe, setScoresSafe, setTotalMovesSafe, showToast],
  )

  const disconnectOnlineSocket = useCallback(() => {
    stopMatchCountdown()
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    setOnlineConnected(false)
    setOnlineAssignedPlayer(null)
  }, [stopMatchCountdown])

  const connectOnlineSocket = useCallback(async () => {
    disconnectOnlineSocket()

    const socket = io(BACKEND_URL, {
      transports: ['websocket'],
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 5,
    })

    socket.on('connect', () => {
      setOnlineConnected(true)
    })

    socket.on('disconnect', () => {
      setOnlineConnected(false)
      setOnlineAssignedPlayer(null)
      if (isOnlineMatch) {
        showToast('Mất kết nối realtime. Vui lòng vào lại phòng.')
      }
    })

    socket.on('room_info', (payload: RoomInfoPayload) => {
      const playerCount = (payload.playerX ? 1 : 0) + (payload.playerO ? 1 : 0)
      setRoomCodeSafe(payload.roomId)
      setOnlineAssignedPlayer(payload.assignedPlayer)
      updateRoomPlayers(playerCount)
      setIsOnlineMatch(true)

      if (payload.isFull || playerCount >= 2) {
        startMatchCountdown()
        setScreen('waiting')
      } else {
        stopMatchCountdown()
        setScreen('waiting')
      }
    })

    socket.on('player_joined', (payload: RoomInfoPayload) => {
      const count = (payload.playerX ? 1 : 0) + (payload.playerO ? 1 : 0)
      updateRoomPlayers(count)
      setRoomCodeSafe(payload.roomId)
      setIsOnlineMatch(true)
      if (payload.isFull || count >= 2) {
        startMatchCountdown()
      }
    })

    socket.on('game_state', (payload: GameStatePayload) => {
      hydrateFromServerState(payload)
      setIsOnlineMatch(true)
      if (roomPlayersRef.current >= 2 && matchCountdownValueRef.current === null) {
        setScreen('game')
      }
    })

    socket.on('chat_message', (payload: ChatMessagePayload) => {
      const activeRoomCode = roomCodeRef.current
      if (!activeRoomCode) {
        return
      }

      if (normalizeRoomId(payload.roomId) !== normalizeRoomId(activeRoomCode)) {
        return
      }

      setRoomChat((prev) => [
        ...prev,
        {
          id: payload.sentAt,
          user: getChatAuthor(payload.playerId),
          msg: payload.message,
        },
      ])
    })

    socket.on('error', (payload: SocketErrorPayload) => {
      const message = payload?.code ? `[${payload.code}] ${payload.message}` : payload.message
      showToast(message)
    })

    socket.on('match_settled', (payload: MatchSettledPayload) => {
      const activeRoomCode = roomCodeRef.current
      if (!activeRoomCode) {
        return
      }

      if (normalizeRoomId(payload.roomId) !== normalizeRoomId(activeRoomCode)) {
        return
      }

      setChainStatus('settled')
      setModalState((prev) => ({
        ...prev,
        sub: 'Kết quả đã được backend ghi lên Oasis Sapphire thành công.',
        tx: payload.txHash ? `Tx: ${payload.txHash}` : 'Tx: Đã ghi nhận on-chain',
      }))

      if (payload.txHash) {
        showToast(`Match settled on-chain: ${payload.txHash.slice(0, 10)}...`)
      }
    })

    socketRef.current = socket

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error('Socket connection timeout'))
      }, 6000)

      socket.once('connect', () => {
        window.clearTimeout(timeout)
        resolve()
      })

      socket.once('connect_error', (error) => {
        window.clearTimeout(timeout)
        reject(error)
      })
    })

    return socket
  }, [
    disconnectOnlineSocket,
    getChatAuthor,
    hydrateFromServerState,
    isOnlineMatch,
    setRoomCodeSafe,
    showToast,
    startMatchCountdown,
    stopMatchCountdown,
    updateRoomPlayers,
  ])

  const joinOnlineRoom = useCallback(
    async (code: string) => {
      try {
        const socket = await connectOnlineSocket()
        clientSequenceRef.current = 0
        endModalShownRef.current = false
        setOnlineAssignedPlayer(null)
        updateRoomPlayers(1)
        stopMatchCountdown()
        setRoomCodeSafe(code)
        setScreen('waiting')

        socket.emit('join_room', {
          roomId: code,
          rows: gridSizeRef.current,
          cols: gridSizeRef.current,
          playerId: clientPlayerIdRef.current,
        })
      } catch {
        showToast('Không kết nối được server realtime. Kiểm tra backend và thử lại.')
      }
    },
    [connectOnlineSocket, setRoomCodeSafe, showToast, stopMatchCountdown, updateRoomPlayers],
  )

  const isGameOver = useCallback(() => {
    const [p1, p2] = scoresRef.current
    return p1 + p2 === gridSizeRef.current * gridSizeRef.current
  }, [])

  const getCellSize = useCallback(() => {
    return Math.floor((canvasSize - PAD * 2) / gridSizeRef.current)
  }, [canvasSize])

  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cell = getCellSize()
    const size = canvasSize
    const expectedSize = gridSizeRef.current

    if (
      hLinesRef.current.length !== expectedSize + 1 ||
      vLinesRef.current.length !== expectedSize ||
      boxesRef.current.length !== expectedSize
    ) {
      const empty = createEmptyState(expectedSize)
      hLinesRef.current = empty.hLines
      vLinesRef.current = empty.vLines
      boxesRef.current = empty.boxes
    }

    const styles = getComputedStyle(document.documentElement)
    const canvasDot = styles.getPropertyValue('--canvas-dot').trim() || '#e0f0ff'
    const emptyLine =
      styles.getPropertyValue('--canvas-line-empty').trim() || 'rgba(255,255,255,0.1)'

    ctx.clearRect(0, 0, size, size)

    for (let r = 0; r < gridSizeRef.current; r++) {
      for (let c = 0; c < gridSizeRef.current; c++) {
        if (boxesRef.current[r][c]) {
          const x = PAD + c * cell
          const y = PAD + r * cell
          const p = boxesRef.current[r][c]
          ctx.fillStyle = p === 1 ? 'rgba(0,245,255,0.12)' : 'rgba(255,0,110,0.12)'
          ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2)

          ctx.fillStyle = p === 1 ? 'rgba(0,245,255,0.5)' : 'rgba(255,0,110,0.5)'
          ctx.font = `bold ${Math.floor(cell * 0.3)}px Orbitron`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(p === 1 ? 'X' : 'O', x + cell / 2, y + cell / 2)
        }
      }
    }

    for (let r = 0; r <= gridSizeRef.current; r++) {
      for (let c = 0; c < gridSizeRef.current; c++) {
        const x1 = PAD + c * cell
        const y1 = PAD + r * cell
        const x2 = x1 + cell
        const owned = hLinesRef.current[r][c]
        const isHover =
          hoveredLine && hoveredLine.type === 'h' && hoveredLine.r === r && hoveredLine.c === c

        ctx.beginPath()
        ctx.moveTo(x1 + DOT / 2, y1)
        ctx.lineTo(x2 - DOT / 2, y1)
        ctx.lineWidth = owned ? 4 : isHover ? 3 : 2
        ctx.strokeStyle = owned
          ? owned === 1
            ? '#00f5ff'
            : '#ff006e'
          : isHover
            ? currentPlayerRef.current === 1
              ? 'rgba(0,245,255,0.7)'
              : 'rgba(255,0,110,0.7)'
            : emptyLine
        ctx.stroke()

        if (owned) {
          ctx.shadowColor = owned === 1 ? '#00f5ff' : '#ff006e'
          ctx.shadowBlur = 8
          ctx.stroke()
          ctx.shadowBlur = 0
        }
      }
    }

    for (let r = 0; r < gridSizeRef.current; r++) {
      for (let c = 0; c <= gridSizeRef.current; c++) {
        const x1 = PAD + c * cell
        const y1 = PAD + r * cell
        const y2 = y1 + cell
        const owned = vLinesRef.current[r][c]
        const isHover =
          hoveredLine && hoveredLine.type === 'v' && hoveredLine.r === r && hoveredLine.c === c

        ctx.beginPath()
        ctx.moveTo(x1, y1 + DOT / 2)
        ctx.lineTo(x1, y2 - DOT / 2)
        ctx.lineWidth = owned ? 4 : isHover ? 3 : 2
        ctx.strokeStyle = owned
          ? owned === 1
            ? '#00f5ff'
            : '#ff006e'
          : isHover
            ? currentPlayerRef.current === 1
              ? 'rgba(0,245,255,0.7)'
              : 'rgba(255,0,110,0.7)'
            : emptyLine
        ctx.stroke()

        if (owned) {
          ctx.shadowColor = owned === 1 ? '#00f5ff' : '#ff006e'
          ctx.shadowBlur = 8
          ctx.stroke()
          ctx.shadowBlur = 0
        }
      }
    }

    for (let r = 0; r <= gridSizeRef.current; r++) {
      for (let c = 0; c <= gridSizeRef.current; c++) {
        const x = PAD + c * cell
        const y = PAD + r * cell
        ctx.beginPath()
        ctx.arc(x, y, DOT / 2, 0, Math.PI * 2)
        ctx.fillStyle = canvasDot
        ctx.fill()
        ctx.shadowColor = 'rgba(0,245,255,0.6)'
        ctx.shadowBlur = 6
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }
  }, [canvasSize, getCellSize, hoveredLine, themeMode])

  const resizeCanvas = useCallback(() => {
    const maxW = Math.min(window.innerWidth - 120, 560)
    const cell = Math.floor((maxW - PAD * 2) / gridSizeRef.current)
    const size = cell * gridSizeRef.current + PAD * 2
    setCanvasSize(size)
  }, [])

  const checkBoxes = useCallback((player: number) => {
    let captured = false
    const nextScores: [number, number] = [...scoresRef.current] as [number, number]

    for (let r = 0; r < gridSizeRef.current; r++) {
      for (let c = 0; c < gridSizeRef.current; c++) {
        if (boxesRef.current[r][c]) continue
        if (
          hLinesRef.current[r][c] &&
          hLinesRef.current[r + 1][c] &&
          vLinesRef.current[r][c] &&
          vLinesRef.current[r][c + 1]
        ) {
          boxesRef.current[r][c] = player
          nextScores[player - 1] += 1
          captured = true
        }
      }
    }

    setScoresSafe(nextScores)
    return captured
  }, [setScoresSafe])

  const getLineFromPos = useCallback(
    (mx: number, my: number): Line | null => {
      const cell = getCellSize()

      for (let r = 0; r <= gridSizeRef.current; r++) {
        for (let c = 0; c < gridSizeRef.current; c++) {
          const y = PAD + r * cell
          if (
            Math.abs(my - y) < SNAP &&
            mx > PAD + c * cell + DOT &&
            mx < PAD + (c + 1) * cell - DOT
          ) {
            return { type: 'h', r, c }
          }
        }
      }

      for (let r = 0; r < gridSizeRef.current; r++) {
        for (let c = 0; c <= gridSizeRef.current; c++) {
          const x = PAD + c * cell
          if (
            Math.abs(mx - x) < SNAP &&
            my > PAD + r * cell + DOT &&
            my < PAD + (r + 1) * cell - DOT
          ) {
            return { type: 'v', r, c }
          }
        }
      }

      return null
    },
    [getCellSize],
  )

  const startBlockTicker = useCallback(() => {
    if (blockIntervalRef.current) {
      window.clearInterval(blockIntervalRef.current)
    }
    const startBlock = 4892341 + Math.floor(Math.random() * 1000)
    setBlockNum(startBlock)
    blockIntervalRef.current = window.setInterval(() => {
      setBlockNum((prev) => prev + 1)
    }, 12000)
  }, [])

  const saveHistory = useCallback((record: HistoryRecord) => {
    setGameHistory((prev) => {
      const next = [record, ...prev].slice(0, 50)
      saveLocalHistory(next)
      return next
    })
  }, [saveLocalHistory])

  const spawnConfetti = useCallback(() => {
    const colors = ['#00f5ff', '#ff006e', '#7b2fff', '#ffd60a', '#ffffff']
    for (let i = 0; i < 60; i++) {
      const el = document.createElement('div')
      el.className = 'confetti-piece'
      el.style.left = `${Math.random() * 100}vw`
      el.style.background = colors[Math.floor(Math.random() * colors.length)]
      el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px'
      el.style.animationDuration = `${2 + Math.random() * 2}s`
      el.style.animationDelay = `${Math.random() * 0.5}s`
      el.style.transform = `rotate(${Math.random() * 360}deg)`
      document.body.appendChild(el)
      window.setTimeout(() => {
        el.remove()
      }, 4000)
    }
  }, [])

  const endGame = useCallback(() => {
    gameActiveRef.current = false
    setGameActive(false)
    if (blockIntervalRef.current) {
      window.clearInterval(blockIntervalRef.current)
      blockIntervalRef.current = null
    }

    const [p1, p2] = scoresRef.current
    let winner = 0
    let icon = '🤝'
    let title = 'HÒA!'
    let sub = 'Cả hai đều xuất sắc! Đang ghi kết quả lên blockchain...'

    if (p1 > p2) {
      winner = 1
      icon = '🏆'
      title = 'X THẮNG!'
      sub = `Tỉ số ${p1} - ${p2}. Đang ghi kết quả lên blockchain...`
    } else if (p2 > p1) {
      winner = 2
      icon = gameModeRef.current === 'ai' ? '🤖' : '🏆'
      title = `${gameModeRef.current === 'ai' ? 'AI (O)' : 'O'} THẮNG!`
      sub = `Tỉ số ${p2} - ${p1}. Đang ghi kết quả lên blockchain...`
    }

    if (winner === 1 || winner === 0) {
      spawnConfetti()
    }

    setChainStatus(isOnlineMatch ? 'settling' : 'settled')

    setModalState({
      open: true,
      icon,
      title,
      sub: isOnlineMatch
        ? 'Backend signer đang ghi kết quả on-chain lên Oasis Sapphire...'
        : sub,
      tx: isOnlineMatch ? 'Tx: Chờ backend xác nhận...' : 'Tx: Đang xử lý...',
    })

    if (isOnlineMatch) {
      return
    }

    const delay = 1500 + Math.random() * 1000
    chainTimeoutRef.current = window.setTimeout(() => {
      const tx = genTxHash()
      setModalState((prev) => ({
        ...prev,
        sub: `Kết quả đã được ghi on-chain thành công! ${stakeEthRef.current > 0 ? `Stake ${stakeEthRef.current.toFixed(3)} ROSE đã được chuyển.` : ''}`,
        tx: `Tx: ${tx}`,
      }))

      saveHistory({
        id: Date.now(),
        date: new Date().toLocaleString('vi-VN'),
        gridSize: gridSizeRef.current,
        mode: gameModeRef.current,
        scores: [scoresRef.current[0], scoresRef.current[1]],
        winner,
        stake: stakeEthRef.current,
        tx,
        moves: totalMovesRef.current,
      })
    }, delay)
  }, [isOnlineMatch, saveHistory, spawnConfetti])

  useEffect(() => {
    endGameRef.current = endGame
  }, [endGame])

  const applyMove = useCallback(
    (line: Line) => {
      if (!gameActiveRef.current) return

      const player = currentPlayerRef.current
      if (line.type === 'h') {
        hLinesRef.current[line.r][line.c] = player
      } else {
        vLinesRef.current[line.r][line.c] = player
      }

      setTotalMovesSafe(totalMovesRef.current + 1)

      const captured = checkBoxes(player)
      setDrawVersion((v) => v + 1)

      if (isGameOver()) {
        window.setTimeout(endGame, 250)
        return
      }

      if (!captured) {
        const nextPlayer = player === 1 ? 2 : 1
        setCurrentPlayerSafe(nextPlayer)
      }

      if (gameModeRef.current === 'ai' && currentPlayerRef.current === 2 && gameActiveRef.current) {
        aiTimeoutRef.current = window.setTimeout(() => {
          aiMove()
        }, 500 + Math.random() * 400)
      }
    },
    [checkBoxes, endGame, isGameOver, setCurrentPlayerSafe, setTotalMovesSafe],
  )

  const aiMove = useCallback(() => {
    if (!gameActiveRef.current || currentPlayerRef.current !== 2) return

    const state = toCoreGameState()
    const selectedEdge = chooseAIMove(state)
    if (selectedEdge) {
      applyMove(edgeToLine(selectedEdge))
    }
  }, [applyMove, edgeToLine, toCoreGameState])

  const startGame = useCallback(() => {
    setIsOnlineMatch(false)
    setChainStatus('idle')
    endModalShownRef.current = false
    const empty = createEmptyState(gridSize)
    hLinesRef.current = empty.hLines
    vLinesRef.current = empty.vLines
    boxesRef.current = empty.boxes

    setScoresSafe([0, 0])
    setCurrentPlayerSafe(1)
    setTotalMovesSafe(0)
    gameActiveRef.current = true
    setGameActive(true)
    setHoveredLine(null)
    setScreen('game')

    startBlockTicker()
    setDrawVersion((v) => v + 1)

    if (gameMode === 'ai') {
      aiTimeoutRef.current = window.setTimeout(() => {
        if (currentPlayerRef.current === 2) {
          aiMove()
        }
      }, 700)
    }
  }, [aiMove, gameMode, gridSize, setCurrentPlayerSafe, setScoresSafe, setTotalMovesSafe, startBlockTicker])

  const goHome = useCallback(() => {
    if (gameActiveRef.current && !window.confirm('Bạn có chắc muốn thoát ván chơi?')) {
      return
    }
    gameActiveRef.current = false
    setGameActive(false)
    clearTimers()
    disconnectOnlineSocket()
    setIsOnlineMatch(false)
    setChainStatus('idle')
    setRoomCountdown(null)
    setJoinCode('')
    setChatMsg('')
    setRoomCodeSafe('')
    endModalShownRef.current = false
    setScreen('home')
  }, [clearTimers, disconnectOnlineSocket, setRoomCodeSafe])

  const openSettings = useCallback(() => {
    if (screen !== 'settings') {
      setPrevScreen(screen as Exclude<Screen, 'settings'>)
    }
    setScreen('settings')
  }, [screen])

  const closeSettings = useCallback(() => {
    setScreen(prevScreen)
  }, [prevScreen])

  const openProfile = useCallback(() => {
    setScreen('profile')
  }, [])

  const showHistory = useCallback(() => {
    setScreen('history')
  }, [])

  const withContractSigner = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('Không có provider ví trong trình duyệt')
    }
    if (!CONTRACT_ADDRESS) {
      throw new Error('Thiếu VITE_CONTRACT_ADDRESS')
    }

    const wrappedProvider = sapphire.wrapEthereumProvider(window.ethereum as any)
    const browserProvider = new ethers.BrowserProvider(wrappedProvider)
    const signer = await browserProvider.getSigner()
    const contract = new ethers.Contract(CONTRACT_ADDRESS, squarexoMatchAbi, signer)
    return { contract, browserProvider }
  }, [])

  const refreshWalletBalance = useCallback(async () => {
    if (!window.ethereum) {
      return
    }

    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const address = await signer.getAddress()
    const balanceWei = await provider.getBalance(address)
    setWalletBalance(ethers.formatEther(balanceWei))
  }, [])

  const lockStakeOnChain = useCallback(
    async (targetRoomId: string, mode: 'create' | 'join') => {
      const amount = stakeEthRef.current
      if (amount <= 0) {
        throw new Error('Stake phải lớn hơn 0')
      }

      const value = ethers.parseEther(amount.toString())
      const { contract } = await withContractSigner()

      setChainStatus('staking')
      const tx =
        mode === 'create'
          ? await contract.createMatch(targetRoomId, value, { value })
          : await contract.joinMatch(targetRoomId, { value })
      await tx.wait()
      await refreshWalletBalance()
      setChainStatus('playing')
      return String(tx.hash)
    },
    [refreshWalletBalance, withContractSigner],
  )

  const claimReward = useCallback(async () => {
    try {
      const { contract } = await withContractSigner()
      const tx = await contract.claimReward(roomCodeRef.current)
      await tx.wait()
      await refreshWalletBalance()
      showToast(`Claim reward thành công: ${String(tx.hash).slice(0, 10)}...`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Claim reward thất bại'
      showToast(message)
    }
  }, [refreshWalletBalance, showToast, withContractSigner])

  const createRoom = useCallback(() => {
    const run = async () => {
      if (!walletConnected) {
        showToast('Hãy kết nối ví trước khi tạo phòng cược')
        return
      }

      const code = genRoomCode()
      try {
        const txHash = await lockStakeOnChain(code, 'create')
        showToast(`Stake thành công: ${txHash.slice(0, 10)}...`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không stake được khi tạo phòng'
        showToast(message)
        setChainStatus('idle')
        return
      }

      setRoomCodeSafe(code)
      updateRoomPlayers(1)
      setRoomChat([
        { id: 1, user: 'System', msg: `Phòng ${code} đã được tạo. Chia sẻ mã để đối thủ tham gia.` },
      ])
      setRoomCountdown(null)
      setGameMode('pvp')
      setScreen('waiting')
      setIsOnlineMatch(true)
      void joinOnlineRoom(code)
    }

    void run()
  }, [joinOnlineRoom, lockStakeOnChain, setRoomCodeSafe, showToast, updateRoomPlayers, walletConnected])

  const joinRoom = useCallback(() => {
    const run = async () => {
      if (!joinCode.trim()) {
        showToast('Nhập mã phòng!')
        return
      }
      if (!walletConnected) {
        showToast('Hãy kết nối ví trước khi vào phòng cược')
        return
      }

      const code = joinCode.trim().toUpperCase()
      try {
        const txHash = await lockStakeOnChain(code, 'join')
        showToast(`Đã stake khi vào phòng: ${txHash.slice(0, 10)}...`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không stake được khi vào phòng'
        showToast(message)
        setChainStatus('idle')
        return
      }

      setRoomCodeSafe(code)
      updateRoomPlayers(1)
      setRoomChat([
        { id: 1, user: 'System', msg: `Đã tham gia phòng ${code}.` },
        { id: 2, user: 'System', msg: 'Đang đồng bộ với server...' },
      ])
      setJoinCode('')
      setGameMode('pvp')
      setScreen('waiting')
      setIsOnlineMatch(true)
      void joinOnlineRoom(code)
    }

    void run()
  }, [joinCode, joinOnlineRoom, lockStakeOnChain, setRoomCodeSafe, showToast, updateRoomPlayers, walletConnected])

  const sendChat = useCallback(() => {
    const message = chatMsg.trim()
    if (!message) return

    if (isOnlineMatch && onlineConnected && socketRef.current && roomCode) {
      socketRef.current.emit('chat_message', {
        roomId: roomCode,
        message,
      })
    } else {
      setRoomChat((prev) => [...prev, { id: Date.now(), user: 'Bạn', msg: message }])
    }

    setChatMsg('')
  }, [chatMsg, isOnlineMatch, onlineConnected, roomCode])

  const connectWallet = useCallback(() => {
    const connect = async () => {
      if (!window.ethereum) {
        showToast('Không tìm thấy MetaMask/WalletConnect provider trong trình duyệt')
        return
      }

      setWalletPending(true)
      try {
        let browserProvider = new ethers.BrowserProvider(window.ethereum)
        let network = await browserProvider.getNetwork()

        if (network.chainId !== OASIS_CHAIN_ID) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: OASIS_CHAIN_HEX }],
            })
          } catch {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: OASIS_CHAIN_HEX,
                  chainName: OASIS_CHAIN_NAME,
                  nativeCurrency: {
                    name: OASIS_CONFIG.currencyName,
                    symbol: 'ROSE',
                    decimals: 18,
                  },
                  rpcUrls: OASIS_CONFIG.rpcUrls,
                  blockExplorerUrls: OASIS_CONFIG.blockExplorerUrls,
                },
              ],
            })
          }
          browserProvider = new ethers.BrowserProvider(window.ethereum)
          network = await browserProvider.getNetwork()
        }

        if (network.chainId !== OASIS_CHAIN_ID) {
          throw new Error(`Network chưa được chuyển sang ${OASIS_CHAIN_NAME}`)
        }

        await window.ethereum.request({ method: 'eth_requestAccounts' })
        const signer = await browserProvider.getSigner()
        const address = await signer.getAddress()
        const balanceWei = await browserProvider.getBalance(address)

        try {
          await syncPendingHistoryToServer(address)
        } catch (error) {
          console.error('Failed to sync pending history', error)
        }

        try {
          const remoteHistory = await fetchHistoryFromServer(address)
          if (remoteHistory.length > 0) {
            setGameHistory(remoteHistory)
            saveLocalHistory(remoteHistory)
          }
        } catch (error) {
          console.error('Failed to fetch history from server', error)
        }

        setWalletConnected(true)
        setWalletAddress(`${address.slice(0, 8)}...${address.slice(-6)}`)
        setWalletBalance(ethers.formatEther(balanceWei))
        showToast(`Kết nối ví thành công trên ${OASIS_CHAIN_NAME}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể kết nối ví'
        showToast(message)
      } finally {
        setWalletPending(false)
      }
    }

    void connect()
  }, [fetchHistoryFromServer, saveLocalHistory, showToast, syncPendingHistoryToServer])

  useEffect(() => {
    const ethereum = window.ethereum
    if (!ethereum?.on || !ethereum.removeListener) {
      return
    }

    const onAccountsChanged = (accounts: unknown) => {
      if (!Array.isArray(accounts) || accounts.length === 0 || typeof accounts[0] !== 'string') {
        setWalletConnected(false)
        setWalletAddress('Chưa kết nối')
        setWalletBalance('0.0000')
        return
      }

      const account = accounts[0]
      setWalletConnected(true)
      setWalletAddress(`${account.slice(0, 8)}...${account.slice(-6)}`)
      void refreshWalletBalance()
    }

    const onChainChanged = (_chainIdHex: unknown) => {
      void refreshWalletBalance()
    }

    ethereum.on('accountsChanged', onAccountsChanged)
    ethereum.on('chainChanged', onChainChanged)

    return () => {
      ethereum.removeListener?.('accountsChanged', onAccountsChanged)
      ethereum.removeListener?.('chainChanged', onChainChanged)
    }
  }, [refreshWalletBalance])

  const playAgain = useCallback(() => {
    setModalState((prev) => ({ ...prev, open: false }))
    startGame()
  }, [startGame])

  const onCanvasMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!gameActiveRef.current) return

      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const mx = (event.clientX - rect.left) * scaleX
      const my = (event.clientY - rect.top) * scaleY

      const line = getLineFromPos(mx, my)
      const taken =
        line &&
        (line.type === 'h' ? hLinesRef.current[line.r][line.c] : vLinesRef.current[line.r][line.c])
      setHoveredLine(line && !taken ? line : null)
    },
    [getLineFromPos],
  )

  const onCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!gameActiveRef.current) return
      if (gameModeRef.current === 'ai' && currentPlayerRef.current === 2) return

      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const mx = (event.clientX - rect.left) * scaleX
      const my = (event.clientY - rect.top) * scaleY

      const line = getLineFromPos(mx, my)
      if (!line) return

      const taken =
        line.type === 'h' ? hLinesRef.current[line.r][line.c] : vLinesRef.current[line.r][line.c]
      if (taken) return

      if (isOnlineMatch) {
        const socket = socketRef.current
        if (!socket || !onlineConnected) {
          showToast('Mất kết nối server realtime')
          return
        }
        if (!onlineAssignedPlayer) {
          showToast('Bạn đang là spectator, chưa có quyền đánh')
          return
        }

        const expectedTurn = onlineAssignedPlayer === 'X' ? 1 : 2
        if (currentPlayerRef.current !== expectedTurn) {
          showToast('Chưa tới lượt của bạn')
          return
        }

        const edge =
          line.type === 'h'
            ? {
                from: { row: line.r, col: line.c },
                to: { row: line.r, col: line.c + 1 },
              }
            : {
                from: { row: line.r, col: line.c },
                to: { row: line.r + 1, col: line.c },
              }

        clientSequenceRef.current += 1
        socket.emit('make_move', {
          roomId: roomCode,
          actionId: `${clientPlayerIdRef.current}-${Date.now()}-${clientSequenceRef.current}`,
          clientSequence: clientSequenceRef.current,
          edge,
        })
        return
      }

      applyMove(line)
    },
    [applyMove, getLineFromPos, isOnlineMatch, onlineAssignedPlayer, onlineConnected, roomCode, showToast],
  )

  const totalEth = useMemo(() => {
    return gameHistory.reduce((sum, game) => sum + (game.stake || 0), 0)
  }, [gameHistory])

  const p1Wins = useMemo(() => {
    return gameHistory.filter((game) => game.winner === 1).length
  }, [gameHistory])

  const winRate = useMemo(() => {
    if (!gameHistory.length) return 0
    return Math.round((p1Wins / gameHistory.length) * 100)
  }, [gameHistory, p1Wins])

  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const handleLogin = useCallback(() => {
    if (!loginForm.username || !loginForm.password) {
      setAuthError('Vui lòng nhập đầy đủ thông tin')
      return
    }
    setAuthError('')
    setAuthLoading(true)

    // Mock login
    window.setTimeout(() => {
      const user: User = {
        id: `user_${Date.now()}`,
        username: loginForm.username,
        email: `${loginForm.username}@chain.io`,
        avatar: '🎮',
        joinedDate: '01/01/2025',
      }
      setAuthUser(user)
      localStorage.setItem('dbAuthUser', JSON.stringify(user))
      setLoginForm({ username: '', password: '' })
      setScreen('home')
      setAuthLoading(false)
      showToast('Đăng nhập thành công!')
    }, 800)
  }, [loginForm, showToast])

  const handleRegister = useCallback(() => {
    if (!registerForm.username || !registerForm.email || !registerForm.password || !registerForm.confirm) {
      setAuthError('Vui lòng nhập đầy đủ thông tin')
      return
    }
    if (registerForm.password !== registerForm.confirm) {
      setAuthError('Mật khẩu không trùng khớp')
      return
    }
    if (registerForm.password.length < 6) {
      setAuthError('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }
    setAuthError('')
    setAuthLoading(true)

    // Mock register
    window.setTimeout(() => {
      const user: User = {
        id: `user_${Date.now()}`,
        username: registerForm.username,
        email: registerForm.email,
        avatar: '🎮',
        joinedDate: new Date().toLocaleDateString('vi-VN'),
      }
      setAuthUser(user)
      localStorage.setItem('dbAuthUser', JSON.stringify(user))
      setRegisterForm({ username: '', email: '', password: '', confirm: '' })
      setScreen('home')
      setAuthLoading(false)
      showToast('Đăng ký thành công!')
    }, 800)
  }, [registerForm, showToast])

  const handleLogout = useCallback(() => {
    setAuthUser(null)
    localStorage.removeItem('dbAuthUser')
    setScreen('auth')
    setAuthTab('login')
    setLoginForm({ username: '', password: '' })
    setRegisterForm({ username: '', email: '', password: '', confirm: '' })
    setAuthError('')
    showToast('Đã đăng xuất')
  }, [showToast])

  useEffect(() => {
    gridSizeRef.current = gridSize
    resizeCanvas()
    setDrawVersion((v) => v + 1)
  }, [gridSize, resizeCanvas])

  useEffect(() => {
    gameModeRef.current = gameMode
  }, [gameMode])

  useEffect(() => {
    stakeEthRef.current = stakeEth
  }, [stakeEth])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode)
    localStorage.setItem('dbTheme', themeMode)
    setDrawVersion((v) => v + 1)
  }, [themeMode])

  useEffect(() => {
    if (screen !== 'game') return
    resizeCanvas()
    const onResize = () => resizeCanvas()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [resizeCanvas, screen])

  useEffect(() => {
    drawBoard()
  }, [canvasSize, currentPlayer, drawBoard, drawVersion, hoveredLine, screen])

  useEffect(() => {
    return () => {
      clearTimers()
      disconnectOnlineSocket()
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current)
      }
    }
  }, [clearTimers, disconnectOnlineSocket])

  return (
    <div className="db-app">
      <div className="bg-grid" />
      <div className="bg-orbs">
        <div className="orb orb1" />
        <div className="orb orb2" />
        <div className="orb orb3" />
      </div>

      {screen !== 'home' && screen !== 'auth' && (
        <nav className="nav-bar">
          <div className="nav-logo">D&amp;B // CHAIN</div>
          <div className="nav-links">
            <button className="btn-ghost" onClick={toggleTheme}>
              {themeMode === 'dark' ? '☀ Sáng' : '🌙 Tối'}
            </button>
            <button className="btn-ghost" onClick={openProfile}>Hồ Sơ</button>
            <button className="btn-ghost" onClick={openSettings}>Cài đặt</button>
            <button className="btn-ghost" onClick={goHome}>Home</button>
            <button className="btn-ghost" onClick={showHistory}>Lịch Sử</button>
          </div>
        </nav>
      )}

      <div className="wrap">
        {screen === 'auth' && (
          <section className="screen active" id="authScreen">
            <div className="auth-card">
              <div className="logo-wrap">
                <div className="logo-title">DOTS &amp; BOXES</div>
                <div className="logo-sub">BLOCKCHAIN EDITION</div>
              </div>

              <div className="auth-tabs">
                <button
                  className={`auth-tab ${authTab === 'login' ? 'active' : ''}`}
                  onClick={() => { setAuthTab('login'); setAuthError('') }}
                >
                  ĐĂNG NHẬP
                </button>
                <button
                  className={`auth-tab ${authTab === 'register' ? 'active' : ''}`}
                  onClick={() => { setAuthTab('register'); setAuthError('') }}
                >
                  ĐĂNG KÝ
                </button>
              </div>

              {authTab === 'login' && (
                <div className="auth-form">
                  <div className="form-group">
                    <label>TÊN NGƯỜI DÙNG</label>
                    <input
                      type="text"
                      placeholder="username"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      disabled={authLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label>MẬT KHẨU</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      disabled={authLoading}
                      onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                  {authError && <div className="auth-error">{authError}</div>}
                  <button
                    className="btn-primary"
                    onClick={handleLogin}
                    disabled={authLoading}
                  >
                    {authLoading ? '⏳ Đang xử lý...' : '⚡ ĐĂNG NHẬP'}
                  </button>
                  <div className="auth-demo">
                    Demo: <span className="demo-link">demo / demo123</span>
                  </div>
                </div>
              )}

              {authTab === 'register' && (
                <div className="auth-form">
                  <div className="form-group">
                    <label>TÊN NGƯỜI DÙNG</label>
                    <input
                      type="text"
                      placeholder="username"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      disabled={authLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label>EMAIL</label>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      disabled={authLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label>MẬT KHẨU</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      disabled={authLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label>XÁC NHÂN MẬT KHẨU</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={registerForm.confirm}
                      onChange={(e) => setRegisterForm({ ...registerForm, confirm: e.target.value })}
                      disabled={authLoading}
                      onKeyPress={(e) => e.key === 'Enter' && handleRegister()}
                    />
                  </div>
                  {authError && <div className="auth-error">{authError}</div>}
                  <button
                    className="btn-primary"
                    onClick={handleRegister}
                    disabled={authLoading}
                  >
                    {authLoading ? '⏳ Đang xử lý...' : '⚡ ĐĂNG KÝ'}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {screen === 'home' && (
          <section className="screen active" id="homeScreen">
            <div className="home-header">
              <div className="user-profile">
                <div className="user-avatar">{authUser?.avatar || '🎮'}</div>
                <div className="user-info">
                  <div className="user-name">{authUser?.username}</div>
                  <div className="user-email">{authUser?.email}</div>
                </div>
                <button className="btn-profile" onClick={openProfile}>Hồ Sơ</button>
                <button className="btn-logout" onClick={handleLogout} title="Đăng xuất">
                  🚪
                </button>
              </div>
            </div>
            <div className="logo-wrap">
              <div className="logo-title">DOTS &amp; BOXES</div>
              <div className="logo-sub">Blockchain Edition // Testnet</div>
            </div>

            <div className="wallet-card">
              <div className="wallet-label">⬡ Ví Blockchain</div>
              <div className="wallet-status">
                <div className={`wallet-dot ${walletConnected ? 'connected' : ''}`} />
                <div className="wallet-addr">{walletAddress}</div>
                <button
                  className="btn-ghost connect-btn"
                  onClick={connectWallet}
                  disabled={walletConnected || walletPending}
                >
                  {walletConnected ? '✓ Đã kết nối' : walletPending ? 'Đang kết nối...' : 'Kết Nối'}
                </button>
              </div>
              {walletConnected && (
                <div className="wallet-balance">
                  Số dư: <span className="balance-val">{Number.parseFloat(walletBalance || '0').toFixed(4)}</span> ROSE · <span className="network-val">Sapphire Testnet</span>
                </div>
              )}
            </div>

            <div className="config-card">
              <div className="config-title">⬡ Cấu Hình Ván Chơi</div>

              <div className="row">
                <label>Kích Thước Bảng</label>
                <div className="size-btns">
                  {[3, 4, 5, 6].map((size) => (
                    <button
                      key={size}
                      className={`sz-btn ${gridSize === size ? 'on' : ''}`}
                      onClick={() => setGridSize(size)}
                    >
                      {size}×{size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="row">
                <label>Stake (ROSE)</label>
                <div className="stake-wrap">
                  <input
                    className="stake-inp"
                    type="number"
                    min="0"
                    step="0.001"
                    title="Stake amount in ROSE"
                    placeholder="0.001"
                    value={stakeEth}
                    onChange={(e) => setStakeEth(Number.parseFloat(e.target.value) || 0)}
                  />
                  <span className="stake-unit">ROSE</span>
                </div>
              </div>

              <div className="row">
                <label>Chế Độ Chơi</label>
                <div className="mode-btns">
                  <button className={`md-btn ${gameMode === 'pvp' ? 'on' : ''}`} onClick={() => setGameMode('pvp')}>
                    👥 PvP Local
                  </button>
                  <button className={`md-btn ${gameMode === 'ai' ? 'on' : ''}`} onClick={() => setGameMode('ai')}>
                    🤖 vs AI
                  </button>
                </div>
              </div>
            </div>

            <button className="btn-primary" onClick={startGame}>⚡ BẮT ĐẦU VÁN CHƠI</button>

            <div className="room-btns">
              <button className="room-btn" onClick={() => setScreen('room')}>🚪 Tạo / Vào Phòng</button>
              <button className="btn-ghost home-history-btn" onClick={showHistory}>📋 Lịch Sử</button>
              <button className="btn-ghost" onClick={openSettings}>⚙</button>
            </div>
          </section>
        )}

        {screen === 'settings' && (
          <section className="screen settings-screen">
            <div className="settings-modal">
              <div className="settings-header">
                <div className="settings-title">⚙ CÀI ĐẶT</div>
                <button className="btn-ghost settings-close" onClick={closeSettings}>✕ Đóng</button>
              </div>

              <div className="settings-section">
                <div className="settings-label">Giao Diện</div>
                <div className="settings-item-row">
                  <span>Chế độ tối</span>
                  <button
                    className={`theme-switch ${themeMode === 'dark' ? 'on' : ''}`}
                    onClick={toggleTheme}
                    aria-label="Bật tắt chế độ tối"
                  >
                    <span className="theme-switch-dot" />
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-label">Kích Thước Bảng</div>
                <div className="settings-desc">Hiện tại: {gridSize}×{gridSize}</div>
                <div className="size-btns">
                  {[3, 4, 5, 6].map((size) => (
                    <button
                      key={size}
                      className={`sz-btn ${gridSize === size ? 'on' : ''}`}
                      onClick={() => setGridSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-label">Chế Độ Chơi</div>
                <div className="settings-desc">{gameMode === 'pvp' ? 'Người vs Người' : 'Người vs AI'}</div>
                <div className="mode-btns">
                  <button className={`md-btn ${gameMode === 'pvp' ? 'on' : ''}`} onClick={() => setGameMode('pvp')}>
                    PvP
                  </button>
                  <button className={`md-btn ${gameMode === 'ai' ? 'on' : ''}`} onClick={() => setGameMode('ai')}>
                    AI
                  </button>
                </div>
              </div>

              <div className="settings-nav-title">CHUYỂN MÀN HÌNH</div>
              <div className="settings-nav-list">
                <button className="settings-nav-btn" onClick={goHome}>🏠 Trang Chủ</button>
                <button className="settings-nav-btn" onClick={openProfile}>👤 Trang Cá Nhân</button>
                <button className="settings-nav-btn" onClick={() => setScreen('game')}>🎮 Ván Chơi</button>
                <button className="settings-nav-btn" onClick={() => setScreen('room')}>🚪 Tạo / Vào Phòng</button>
                <button className="settings-nav-btn" onClick={showHistory}>📋 Lịch Sử On-Chain</button>
              </div>
            </div>
          </section>
        )}

        {screen === 'profile' && (
          <section className="screen profile-screen">
            <div className="profile-card">
              <div className="profile-head">
                <div className="profile-avatar">{authUser?.avatar || '🎮'}</div>
                <div>
                  <div className="profile-name">{authUser?.username || 'Người Chơi'}</div>
                  <div className="profile-email">{authUser?.email || 'no-email@chain.io'}</div>
                  <div className="profile-id">ID: {authUser?.id || 'guest'}</div>
                </div>
              </div>

              <div className="profile-grid">
                <div className="profile-stat">
                  <div className="profile-stat-value">{gameHistory.length}</div>
                  <div className="profile-stat-label">Ván Đã Chơi</div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat-value">{winRate}%</div>
                  <div className="profile-stat-label">Tỉ Lệ Thắng X</div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat-value">{totalEth.toFixed(3)}</div>
                  <div className="profile-stat-label">Tổng Stake ROSE</div>
                </div>
              </div>

              <div className="profile-wallet-card">
                <div className="profile-wallet-title">⬡ Ví Blockchain</div>
                <div className="profile-wallet-row">
                  <span className={`wallet-dot ${walletConnected ? 'connected' : ''}`} />
                  <span className="profile-wallet-address">{walletAddress}</span>
                  <button className="btn-ghost profile-wallet-btn" onClick={connectWallet} disabled={walletConnected || walletPending}>
                    {walletConnected ? '✓ Đã kết nối' : walletPending ? 'Đang kết nối...' : 'Kết Nối'}
                  </button>
                </div>
                <div className="profile-wallet-meta">
                  {walletConnected ? (
                    <>
                      Số dư: <span className="balance-val">{Number.parseFloat(walletBalance || '0').toFixed(4)}</span> ROSE · <span className="network-val">Sapphire Testnet</span>
                    </>
                  ) : (
                    'Chưa kết nối ví'
                  )}
                </div>
              </div>

              <div className="profile-section">
                <div className="profile-section-title">Thông Tin Tài Khoản</div>
                <div className="profile-row"><span>Tham gia từ</span><strong>{authUser?.joinedDate || 'N/A'}</strong></div>
                <div className="profile-row"><span>Chế độ ưa thích</span><strong>{gameMode === 'ai' ? 'Vs AI' : 'PvP Local'}</strong></div>
                <div className="profile-row"><span>Kích thước bàn mặc định</span><strong>{gridSize}x{gridSize}</strong></div>
                <div className="profile-row"><span>Theme</span><strong>{themeMode === 'dark' ? 'Dark Neon' : 'Light Neon'}</strong></div>
              </div>

              <div className="profile-actions">
                <button className="btn-ghost" onClick={goHome}>🏠 Trang Chủ</button>
                <button className="btn-ghost" onClick={openSettings}>⚙ Cài Đặt</button>
                <button className="btn-primary" onClick={startGame}>⚡ Bắt Đầu Ngay</button>
              </div>
            </div>
          </section>
        )}

        {screen === 'room' && (
          <section className="screen room-screen">
            <div className="room-shell">
              <div className="room-header-row">
                <button className="btn-ghost" onClick={goHome}>← Quay lại</button>
                <div className="room-header-title">Phòng Chơi Online</div>
              </div>

              <div className="card room-card">
                <div className="card-title">🚪 Tạo Phòng Mới</div>
                <p className="room-desc">
                  Tạo phòng riêng và chia sẻ mã cho đối thủ để bắt đầu ván đấu.
                </p>
                <div className="row">
                  <label>Kích Thước Bảng</label>
                  <div className="size-btns">
                    {[3, 4, 5, 6].map((size) => (
                      <button key={size} className={`sz-btn ${gridSize === size ? 'on' : ''}`} onClick={() => setGridSize(size)}>
                        {size}×{size}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="row">
                  <label>Stake (ROSE)</label>
                  <div className="stake-wrap">
                    <input
                      className="stake-inp"
                      type="number"
                      min="0"
                      step="0.001"
                      title="Stake amount in ROSE"
                      placeholder="0.001"
                      value={stakeEth}
                      onChange={(e) => setStakeEth(Number.parseFloat(e.target.value) || 0)}
                    />
                    <span className="stake-unit">ROSE</span>
                  </div>
                </div>
                <button className="btn-primary room-create-btn" onClick={createRoom}>⚡ TẠO PHÒNG</button>
              </div>

              <div className="room-divider-row">
                <div className="room-divider-line" />
                <span>HOẶC</span>
                <div className="room-divider-line" />
              </div>

              <div className="card room-card">
                <div className="card-title">🔑 Vào Phòng</div>
                <p className="room-desc">
                  Nhập mã phòng 6 ký tự để tham gia ván đấu.
                </p>
                <div className="join-row">
                  <input
                    className="join-inp"
                    placeholder="XXXXXX"
                    value={joinCode}
                    maxLength={6}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                  />
                  <button className="btn-primary room-join-btn" onClick={joinRoom}>
                    Vào →
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {screen === 'waiting' && (
          <section className="screen waiting-screen">
            <div className="waiting-title">Phòng Chờ</div>

            <div className="room-code-box">
              <div className="code-label">Mã Phòng</div>
              <div className="code-val">{roomCode}</div>
              <div className="code-hint">Chia sẻ mã này cho đối thủ</div>
              <div className="players-row">
                <div className="player-slot">
                  <div className="slot-avatar p1">X</div>
                  <div className="slot-name">Bạn</div>
                </div>
                <div className="vs-sep">VS</div>
                <div className="player-slot">
                  <div className={`slot-avatar ${roomPlayers >= 2 ? 'p2' : 'empty'}`}>
                    {roomPlayers >= 2 ? 'O' : '?'}
                  </div>
                  <div className="slot-name">{roomPlayers >= 2 ? 'Đối thủ' : 'Đang chờ...'}</div>
                </div>
              </div>
            </div>

            {roomCountdown !== null ? (
              <div key={roomCountdown} className="countdown">{roomCountdown}</div>
            ) : (
              <div className="waiting-label">⏳ Đang chờ đối thủ...</div>
            )}

            <div className="chat-box">
              <div className="chat-header">💬 Chat Phòng</div>
              <div className="chat-messages">
                {roomChat.map((msg) => (
                  <div key={msg.id} className="chat-msg">
                    <span className={`user ${msg.user === 'System' ? 'sys' : msg.user === 'Bạn' ? 'you' : 'opp'}`}>
                      {msg.user}:
                    </span>
                    {msg.msg}
                  </div>
                ))}
              </div>
              <div className="chat-send">
                <input
                  className="chat-inp"
                  placeholder="Nhắn tin..."
                  value={chatMsg}
                  onChange={(e) => setChatMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                />
                <button className="chat-send-btn" onClick={sendChat}>Gửi</button>
              </div>
            </div>

            <button className="btn-ghost" onClick={goHome}>← Thoát Phòng</button>
          </section>
        )}

        {screen === 'game' && (
          <section className="screen game-screen" id="gameScreen">
            <div className="scoreboard">
              <div className={`p-card ${currentPlayer === 1 ? 'active' : ''}`} id="p1Card">
                <div className="p-name">NGƯỜI CHƠI <span className="player-color">X</span></div>
                <div className="p-score score-p1">{scores[0]}</div>
                <div className="p-boxes">{scores[0]} ô</div>
              </div>
              <div className="vs">VS</div>
              <div className={`p-card p2 ${currentPlayer === 2 ? 'active' : ''}`} id="p2Card">
                <div className="p-name">
                  {gameMode === 'ai' ? 'AI' : 'NGƯỜI CHƠI'} <span className="player-color player-p2">O</span>
                </div>
                <div className="p-score score-p2">{scores[1]}</div>
                <div className="p-boxes">{scores[1]} ô</div>
              </div>
            </div>

            <div className="ticker">
              <div className="ticker-item"><span className="t-lbl">Block</span><span className="t-val green">#{blockNum.toLocaleString()}</span></div>
              <span className="t-sep">|</span>
              <div className="ticker-item"><span className="t-lbl">Stake</span><span className="t-val gold">{stakeEth.toFixed(3)} ROSE</span></div>
              <span className="t-sep">|</span>
              <div className="ticker-item"><span className="t-lbl">Gas</span><span className="t-val pink">12 gwei</span></div>
              <span className="t-sep">|</span>
              <div className="ticker-item"><span className="t-lbl">Moves</span><span className="t-val green">{totalMoves}</span></div>
              <span className="t-sep">|</span>
              <div className="ticker-item"><span className="t-lbl">Contract</span><span className="t-val contract">{CONTRACT_ADDRESS ? `${CONTRACT_ADDRESS.slice(0, 8)}...${CONTRACT_ADDRESS.slice(-6)}` : 'Chưa cấu hình'}</span></div>
            </div>

            {isOnlineMatch && chainStatus === 'settled' && (
              <div className="claim-reward-wrap">
                <button className="btn-ghost" onClick={() => void claimReward()}>
                  Claim Reward On-chain
                </button>
              </div>
            )}

            <div className="turn-pill">
              Lượt:{' '}
              <span className={currentPlayer === 1 ? 'turn-pill-highlight turn-pill-highlight-p1' : 'turn-pill-highlight turn-pill-highlight-p2'}>
                {currentPlayer === 1 ? 'X' : gameMode === 'ai' ? 'AI (O) 🤖' : 'O'}
              </span>{' '}
              · {gameActive ? 'Đang chơi' : 'Kết thúc'}
            </div>

            <div className="board-wrap board-wrap--game">
              <canvas
                className={`game-board-canvas ${hoveredLine ? 'game-board-canvas--hover' : ''}`}
                id="gameBoard"
                ref={canvasRef}
                width={canvasSize}
                height={canvasSize}
                onMouseMove={onCanvasMouseMove}
                onMouseLeave={() => setHoveredLine(null)}
                onClick={onCanvasClick}
              />
            </div>

            <div className="game-actions">
              <button className="btn-ghost" onClick={goHome}>← Thoát</button>
              <button className="btn-ghost" onClick={openSettings}>⚙ Cài đặt</button>
            </div>
          </section>
        )}

        {screen === 'history' && (
          <section className="screen history-screen" id="historyScreen">
            <div className="history-top-row">
              <div>
                <div className="h-title">⬡ Lịch Sử On-Chain</div>
                <div className="history-chain-sub">
                  Oasis Sapphire Testnet · Smart Contract {CONTRACT_ADDRESS ? `${CONTRACT_ADDRESS.slice(0, 8)}...${CONTRACT_ADDRESS.slice(-6)}` : 'chưa cấu hình'}
                </div>
              </div>
              <button className="btn-ghost" onClick={goHome}>← Quay Lại</button>
            </div>

            <div className="stats-row">
              <div className="stat-card"><div className="s-val c1">{gameHistory.length}</div><div className="s-lbl">Ván Đã Chơi</div></div>
              <div className="stat-card"><div className="s-val c3">{totalEth.toFixed(3)}</div><div className="s-lbl">Tổng ROSE</div></div>
              <div className="stat-card"><div className="s-val c2">{gameHistory.length ? `${winRate}%` : '—'}</div><div className="s-lbl">Win Rate X</div></div>
            </div>

            <div className="h-list">
              {!gameHistory.length && (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div>Chưa có ván nào được ghi on-chain</div>
                </div>
              )}

              {gameHistory.map((game, idx) => {
                const badgeClass = game.winner === 0 ? 'draw' : game.winner === 1 ? 'p1' : 'p2'
                const badgeText =
                  game.winner === 0
                    ? 'HÒA'
                    : game.winner === 1
                      ? 'X THẮNG'
                      : `${game.mode === 'ai' ? 'AI (O)' : 'O'} THẮNG`

                return (
                  <div className="h-item" key={game.id}>
                    <div className="h-num">#{gameHistory.length - idx}</div>
                    <div>
                      <div className="h-players">X vs {game.mode === 'ai' ? 'AI (O) 🤖' : 'O'} · {game.gridSize}×{game.gridSize}</div>
                      <div className="h-meta">{game.date} · {game.moves} nước đi</div>
                    </div>
                    <div className="h-result-wrap">
                      <span className={`badge ${badgeClass}`}>{badgeText}</span>
                      <div className="h-score-line">{game.scores[0]} - {game.scores[1]}</div>
                    </div>
                    <div className="h-tx-wrap">
                      <div className="h-tx-hash">{game.tx.slice(0, 10)}...{game.tx.slice(-6)}</div>
                      <div className="h-amount">{game.stake > 0 ? `${game.stake.toFixed(3)} ETH` : 'Free'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>

      {modalState.open && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-icon">{modalState.icon}</div>
            <div className="modal-title">{modalState.title}</div>
            <div className="modal-sub">{modalState.sub}</div>
            <div className="modal-tx">{modalState.tx}</div>
            <div className="modal-btns">
              <button className="btn-ghost" onClick={showHistory}>📋 Lịch Sử</button>
              <button className="btn-primary" onClick={playAgain}>▶ Chơi Lại</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default App
