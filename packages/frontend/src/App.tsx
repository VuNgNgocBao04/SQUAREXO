import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

type MoveRecord = {
  line: Line
  player: number
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
  const [roomChat, setRoomChat] = useState<RoomMessage[]>([
    { id: 1, user: 'System', msg: 'Phòng chờ đã được tạo. Chia sẻ mã phòng để đối thủ tham gia.' },
  ])
  const [chatMsg, setChatMsg] = useState('')

  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('Chưa kết nối')
  const [walletBalance, setWalletBalance] = useState('0.0000')

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
  const blockIntervalRef = useRef<number | null>(null)
  const aiTimeoutRef = useRef<number | null>(null)
  const chainTimeoutRef = useRef<number | null>(null)
  const roomJoinTimeoutRef = useRef<number | null>(null)
  const countdownRef = useRef<number | null>(null)

  const hLinesRef = useRef<number[][]>([])
  const vLinesRef = useRef<number[][]>([])
  const boxesRef = useRef<number[][]>([])
  const moveHistoryRef = useRef<MoveRecord[]>([])

  const currentPlayerRef = useRef(1)
  const scoresRef = useRef<[number, number]>([0, 0])
  const totalMovesRef = useRef(0)
  const gameActiveRef = useRef(false)
  const gridSizeRef = useRef(3)
  const gameModeRef = useRef<GameMode>('pvp')
  const stakeEthRef = useRef(0.01)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current)
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null)
    }, 3000)
  }, [])

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
    if (roomJoinTimeoutRef.current) {
      window.clearTimeout(roomJoinTimeoutRef.current)
      roomJoinTimeoutRef.current = null
    }
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

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

  const countEdgesBox = useCallback((r: number, c: number) => {
    return (
      (hLinesRef.current[r][c] ? 1 : 0) +
      (hLinesRef.current[r + 1][c] ? 1 : 0) +
      (vLinesRef.current[r][c] ? 1 : 0) +
      (vLinesRef.current[r][c + 1] ? 1 : 0)
    )
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
      localStorage.setItem('dbChainHistory', JSON.stringify(next))
      return next
    })
  }, [])

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

    setModalState({
      open: true,
      icon,
      title,
      sub,
      tx: 'Tx: Đang xử lý...',
    })

    const delay = 1500 + Math.random() * 1000
    chainTimeoutRef.current = window.setTimeout(() => {
      const tx = genTxHash()
      setModalState((prev) => ({
        ...prev,
        sub: `Kết quả đã được ghi on-chain thành công! ${stakeEthRef.current > 0 ? `Stake ${stakeEthRef.current.toFixed(3)} ETH đã được chuyển.` : ''}`,
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
  }, [saveHistory, spawnConfetti])

  const applyMove = useCallback(
    (line: Line) => {
      if (!gameActiveRef.current) return

      const player = currentPlayerRef.current
      if (line.type === 'h') {
        hLinesRef.current[line.r][line.c] = player
      } else {
        vLinesRef.current[line.r][line.c] = player
      }

      moveHistoryRef.current.push({ line, player })
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

  const getAllFreeLines = useCallback(() => {
    const lines: Line[] = []
    for (let r = 0; r <= gridSizeRef.current; r++) {
      for (let c = 0; c < gridSizeRef.current; c++) {
        if (!hLinesRef.current[r][c]) lines.push({ type: 'h', r, c })
      }
    }
    for (let r = 0; r < gridSizeRef.current; r++) {
      for (let c = 0; c <= gridSizeRef.current; c++) {
        if (!vLinesRef.current[r][c]) lines.push({ type: 'v', r, c })
      }
    }
    return lines
  }, [])

  const lineCompletesBox = useCallback(
    (line: Line) => {
      if (line.type === 'h') {
        if (line.r > 0 && countEdgesBox(line.r - 1, line.c) === 3) return true
        if (line.r < gridSizeRef.current && countEdgesBox(line.r, line.c) === 3) return true
      } else {
        if (line.c > 0 && countEdgesBox(line.r, line.c - 1) === 3) return true
        if (line.c < gridSizeRef.current && countEdgesBox(line.r, line.c) === 3) return true
      }
      return false
    },
    [countEdgesBox],
  )

  const lineGivesOpponent = useCallback(
    (line: Line) => {
      if (line.type === 'h') {
        if (line.r > 0 && countEdgesBox(line.r - 1, line.c) === 2) return true
        if (line.r < gridSizeRef.current && countEdgesBox(line.r, line.c) === 2) return true
      } else {
        if (line.c > 0 && countEdgesBox(line.r, line.c - 1) === 2) return true
        if (line.c < gridSizeRef.current && countEdgesBox(line.r, line.c) === 2) return true
      }
      return false
    },
    [countEdgesBox],
  )

  const aiMove = useCallback(() => {
    if (!gameActiveRef.current || currentPlayerRef.current !== 2) return

    const all = getAllFreeLines()
    const completing = all.find((line) => lineCompletesBox(line))
    const safe = all.find((line) => !lineGivesOpponent(line))
    const random = all.length ? all[Math.floor(Math.random() * all.length)] : null
    const move = completing ?? safe ?? random
    if (move) {
      applyMove(move)
    }
  }, [applyMove, getAllFreeLines, lineCompletesBox, lineGivesOpponent])

  const rebuildFromHistory = useCallback((moves: MoveRecord[]) => {
    const empty = createEmptyState(gridSizeRef.current)
    const nextScores: [number, number] = [0, 0]

    for (const move of moves) {
      if (move.line.type === 'h') {
        empty.hLines[move.line.r][move.line.c] = move.player
      } else {
        empty.vLines[move.line.r][move.line.c] = move.player
      }

      for (let r = 0; r < gridSizeRef.current; r++) {
        for (let c = 0; c < gridSizeRef.current; c++) {
          if (empty.boxes[r][c]) continue
          if (
            empty.hLines[r][c] &&
            empty.hLines[r + 1][c] &&
            empty.vLines[r][c] &&
            empty.vLines[r][c + 1]
          ) {
            empty.boxes[r][c] = move.player
            nextScores[move.player - 1] += 1
          }
        }
      }
    }

    hLinesRef.current = empty.hLines
    vLinesRef.current = empty.vLines
    boxesRef.current = empty.boxes
    setScoresSafe(nextScores)
  }, [setScoresSafe])

  const undoMove = useCallback(() => {
    if (!moveHistoryRef.current.length) {
      showToast('Không có nước để hoàn tác!')
      return
    }

    const last = moveHistoryRef.current.pop()
    if (!last) return

    rebuildFromHistory(moveHistoryRef.current)
    setCurrentPlayerSafe(last.player)
    setTotalMovesSafe(moveHistoryRef.current.length)
    setDrawVersion((v) => v + 1)
  }, [rebuildFromHistory, setCurrentPlayerSafe, setTotalMovesSafe, showToast])

  const startGame = useCallback(() => {
    const empty = createEmptyState(gridSize)
    hLinesRef.current = empty.hLines
    vLinesRef.current = empty.vLines
    boxesRef.current = empty.boxes
    moveHistoryRef.current = []

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
    setRoomCountdown(null)
    setJoinCode('')
    setChatMsg('')
    setScreen('home')
  }, [clearTimers])

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

  const createRoom = useCallback(() => {
    const code = genRoomCode()
    setRoomCode(code)
    setRoomPlayers(1)
    setRoomChat([
      { id: 1, user: 'System', msg: `Phòng ${code} đã được tạo. Chia sẻ mã để đối thủ tham gia.` },
    ])
    setRoomCountdown(null)
    setScreen('waiting')

    if (roomJoinTimeoutRef.current) {
      window.clearTimeout(roomJoinTimeoutRef.current)
    }

    roomJoinTimeoutRef.current = window.setTimeout(() => {
      setRoomPlayers(2)
      setRoomChat((prev) => [
        ...prev,
        { id: Date.now(), user: 'System', msg: 'Đối thủ đã tham gia! Bắt đầu sau 5 giây...' },
      ])

      let remaining = 5
      setRoomCountdown(remaining)
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current)
      }

      countdownRef.current = window.setInterval(() => {
        remaining -= 1
        setRoomCountdown(remaining)
        if (remaining <= 0) {
          if (countdownRef.current) {
            window.clearInterval(countdownRef.current)
            countdownRef.current = null
          }
          setRoomCountdown(null)
          startGame()
        }
      }, 1000)
    }, 5000)
  }, [startGame])

  const joinRoom = useCallback(() => {
    if (!joinCode.trim()) {
      showToast('Nhập mã phòng!')
      return
    }

    const code = joinCode.trim().toUpperCase()
    setRoomCode(code)
    setRoomPlayers(2)
    setRoomChat([
      { id: 1, user: 'System', msg: `Đã tham gia phòng ${code}.` },
      { id: 2, user: 'System', msg: 'Bắt đầu sau 3 giây...' },
    ])
    setJoinCode('')
    setScreen('waiting')

    if (roomJoinTimeoutRef.current) {
      window.clearTimeout(roomJoinTimeoutRef.current)
    }
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current)
    }

    let remaining = 3
    setRoomCountdown(remaining)
    countdownRef.current = window.setInterval(() => {
      remaining -= 1
      setRoomCountdown(remaining)
      if (remaining <= 0) {
        if (countdownRef.current) {
          window.clearInterval(countdownRef.current)
          countdownRef.current = null
        }
        setRoomCountdown(null)
        startGame()
      }
    }, 1000)
  }, [joinCode, showToast, startGame])

  const sendChat = useCallback(() => {
    if (!chatMsg.trim()) return

    setRoomChat((prev) => [...prev, { id: Date.now(), user: 'Bạn', msg: chatMsg }])
    setChatMsg('')

    window.setTimeout(() => {
      setRoomChat((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          user: 'Đối thủ',
          msg: ['Sẵn sàng rồi!', 'Tôi sẽ thắng 😄', 'Gg!'][Math.floor(Math.random() * 3)],
        },
      ])
    }, 1200 + Math.random() * 800)
  }, [chatMsg])

  const connectWallet = useCallback(() => {
    const addr =
      '0x' +
      Array.from({ length: 4 }, () =>
        Math.floor(Math.random() * 0xffff)
          .toString(16)
          .padStart(4, '0'),
      ).join('') +
      '...'
    const balance = (Math.random() * 2 + 0.1).toFixed(4)

    window.setTimeout(() => {
      setWalletConnected(true)
      setWalletAddress(addr)
      setWalletBalance(balance)
      showToast('Kết nối ví thành công!')
    }, 1200)
  }, [showToast])

  const confirmForfeit = useCallback(() => {
    if (!window.confirm('Xác nhận bỏ cuộc? Đối thủ sẽ thắng.')) return

    gameActiveRef.current = false
    setGameActive(false)
    if (blockIntervalRef.current) {
      window.clearInterval(blockIntervalRef.current)
      blockIntervalRef.current = null
    }

    const winner = currentPlayerRef.current === 1 ? 2 : 1
    const full = gridSizeRef.current * gridSizeRef.current
    const nextScores: [number, number] = winner === 1 ? [full, 0] : [0, full]
    setScoresSafe(nextScores)
    setCurrentPlayerSafe(winner)
    setDrawVersion((v) => v + 1)
    endGame()
  }, [endGame, setCurrentPlayerSafe, setScoresSafe])

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

      applyMove(line)
    },
    [applyMove, getLineFromPos],
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
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current)
      }
    }
  }, [clearTimers])

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
                  disabled={walletConnected}
                >
                  {walletConnected ? '✓ Đã kết nối' : 'Kết Nối'}
                </button>
              </div>
              {walletConnected && (
                <div className="wallet-balance">
                  Số dư: <span className="balance-val">{walletBalance}</span> ETH · <span className="network-val">Sepolia</span>
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
                <label>Stake (ETH)</label>
                <div className="stake-wrap">
                  <input
                    className="stake-inp"
                    type="number"
                    min="0"
                    step="0.001"
                    value={stakeEth}
                    onChange={(e) => setStakeEth(Number.parseFloat(e.target.value) || 0)}
                  />
                  <span className="stake-unit">ETH</span>
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

              <div className="row">
                <label>Chế Độ Nền</label>
                <div className="mode-btns">
                  <button className={`md-btn ${themeMode === 'light' ? 'on' : ''}`} onClick={() => setThemeMode('light')}>
                    ☀ Sáng
                  </button>
                  <button className={`md-btn ${themeMode === 'dark' ? 'on' : ''}`} onClick={() => setThemeMode('dark')}>
                    🌙 Tối
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
                  <div className="profile-stat-label">Tổng Stake ETH</div>
                </div>
              </div>

              <div className="profile-wallet-card">
                <div className="profile-wallet-title">⬡ Ví Blockchain</div>
                <div className="profile-wallet-row">
                  <span className={`wallet-dot ${walletConnected ? 'connected' : ''}`} />
                  <span className="profile-wallet-address">{walletAddress}</span>
                  <button className="btn-ghost profile-wallet-btn" onClick={connectWallet} disabled={walletConnected}>
                    {walletConnected ? '✓ Đã kết nối' : 'Kết Nối'}
                  </button>
                </div>
                <div className="profile-wallet-meta">
                  {walletConnected ? (
                    <>
                      Số dư: <span className="balance-val">{walletBalance}</span> ETH · <span className="network-val">Sepolia</span>
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
                  <label>Stake (ETH)</label>
                  <div className="stake-wrap">
                    <input
                      className="stake-inp"
                      type="number"
                      min="0"
                      step="0.001"
                      value={stakeEth}
                      onChange={(e) => setStakeEth(Number.parseFloat(e.target.value) || 0)}
                    />
                    <span className="stake-unit">ETH</span>
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
                <div className="p-score" style={{ color: 'var(--p1)' }}>{scores[0]}</div>
                <div className="p-boxes">{scores[0]} ô</div>
              </div>
              <div className="vs">VS</div>
              <div className={`p-card p2 ${currentPlayer === 2 ? 'active' : ''}`} id="p2Card">
                <div className="p-name">
                  {gameMode === 'ai' ? 'AI' : 'NGƯỜI CHƠI'} <span className="player-color player-p2">O</span>
                </div>
                <div className="p-score" style={{ color: 'var(--p2)' }}>{scores[1]}</div>
                <div className="p-boxes">{scores[1]} ô</div>
              </div>
            </div>

            <div className="ticker">
              <div className="ticker-item"><span className="t-lbl">Block</span><span className="t-val green">#{blockNum.toLocaleString()}</span></div>
              <span className="t-sep">|</span>
              <div className="ticker-item"><span className="t-lbl">Stake</span><span className="t-val gold">{stakeEth.toFixed(3)} ETH</span></div>
              <span className="t-sep">|</span>
              <div className="ticker-item"><span className="t-lbl">Gas</span><span className="t-val pink">12 gwei</span></div>
              <span className="t-sep">|</span>
              <div className="ticker-item"><span className="t-lbl">Moves</span><span className="t-val green">{totalMoves}</span></div>
              <span className="t-sep">|</span>
              <div className="ticker-item"><span className="t-lbl">Contract</span><span className="t-val contract">0x4a2f...c3e1</span></div>
            </div>

            <div className="turn-pill">
              Lượt:{' '}
              <span style={{ color: currentPlayer === 1 ? 'var(--p1)' : 'var(--p2)' }}>
                {currentPlayer === 1 ? 'X' : gameMode === 'ai' ? 'AI (O) 🤖' : 'O'}
              </span>
            </div>

            <div className="board-wrap">
              <canvas
                id="gameBoard"
                ref={canvasRef}
                width={canvasSize}
                height={canvasSize}
                style={{ width: `${canvasSize}px`, height: `${canvasSize}px`, cursor: hoveredLine ? 'pointer' : 'default' }}
                onMouseMove={onCanvasMouseMove}
                onMouseLeave={() => setHoveredLine(null)}
                onClick={onCanvasClick}
              />
            </div>

            <div className="game-actions">
              <button className="btn-ghost" onClick={goHome}>← Thoát</button>
              <button className="btn-ghost" onClick={undoMove} disabled={!gameActive}>↩ Hoàn Tác</button>
              <button className="forfeit-btn" onClick={confirmForfeit} disabled={!gameActive}>Bỏ Cuộc</button>
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
                  Sepolia Testnet · Smart Contract 0x4a2f...c3e1
                </div>
              </div>
              <button className="btn-ghost" onClick={goHome}>← Quay Lại</button>
            </div>

            <div className="stats-row">
              <div className="stat-card"><div className="s-val c1">{gameHistory.length}</div><div className="s-lbl">Ván Đã Chơi</div></div>
              <div className="stat-card"><div className="s-val c3">{totalEth.toFixed(3)}</div><div className="s-lbl">Tổng ETH</div></div>
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
