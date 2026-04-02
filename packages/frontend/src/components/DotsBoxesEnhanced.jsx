import { useCallback, useEffect, useRef, useState, useMemo } from "react";

/* ─── CONSTANTS ─────────────────────────────────────────── */
const DOT = 18;
const PAD = 32;
const SNAP = 20;
const COLORS = {
  p1: "#00f5ff",
  p2: "#ff006e",
  p1Box: "rgba(0,245,255,0.13)",
  p2Box: "rgba(255,0,110,0.13)",
  dot: "#e0f0ff",
  empty: "rgba(255,255,255,0.1)",
};

function createEmptyState(size) {
  return {
    hLines: Array.from({ length: size + 1 }, () => new Array(size).fill(0)),
    vLines: Array.from({ length: size }, () => new Array(size + 1).fill(0)),
    boxes: Array.from({ length: size }, () => new Array(size).fill(0)),
  };
}
function genTxHash() {
  return "0x" + Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
}
function genRoomCode() {
  return Array.from({ length: 6 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
}

/* ─── PARTICLE ENGINE ───────────────────────────────────── */
class Particle {
  constructor(x, y, color) {
    this.x = x; this.y = y;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4 - 1;
    this.life = 1; this.decay = 0.02 + Math.random() * 0.03;
    this.size = 2 + Math.random() * 4;
    this.color = color;
    this.gravity = 0.08;
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    this.vy += this.gravity;
    this.life -= this.decay;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class LineFlash {
  constructor(x1, y1, x2, y2, color) {
    this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
    this.color = color; this.life = 1; this.decay = 0.04;
  }
  update() { this.life -= this.decay; }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.life * 0.8;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 6 + this.life * 6;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 20 * this.life;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(this.x2, this.y2);
    ctx.stroke();
    ctx.restore();
  }
}

/* ─── MAIN APP ───────────────────────────────────────────── */
export default function App() {
  /* screens: home | game | history | room | waiting | settings */
  const [screen, setScreen] = useState("home");
  const [gridSize, setGridSize] = useState(3);
  const [gameMode, setGameMode] = useState("pvp");
  const [stakeEth, setStakeEth] = useState(0.01);
  const [themeMode, setThemeMode] = useState("dark");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("Chưa kết nối");
  const [walletBalance, setWalletBalance] = useState("0.0000");

  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [scores, setScores] = useState([0, 0]);
  const [totalMoves, setTotalMoves] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [blockNum, setBlockNum] = useState(4892341);
  const [hoveredLine, setHoveredLine] = useState(null);
  const [canvasSize, setCanvasSize] = useState(420);
  const [drawVersion, setDrawVersion] = useState(0);
  const [toast, setToast] = useState(null);
  const [modalState, setModalState] = useState({ open: false, icon: "🏆", title: "", sub: "", tx: "" });
  const [gameHistory, setGameHistory] = useState([]);

  /* room state */
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomPlayers, setRoomPlayers] = useState(1);
  const [roomCountdown, setRoomCountdown] = useState(null);
  const [roomChat, setRoomChat] = useState([
    { id: 1, user: "System", msg: "Phòng chờ đã được tạo. Chia sẻ mã phòng để đối thủ tham gia." }
  ]);
  const [chatMsg, setChatMsg] = useState("");

  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const lineFlashesRef = useRef([]);
  const animFrameRef = useRef(null);
  const blockIntervalRef = useRef(null);
  const aiTimeoutRef = useRef(null);
  const chainTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const countdownRef = useRef(null);

  const hLinesRef = useRef([]);
  const vLinesRef = useRef([]);
  const boxesRef = useRef([]);
  const moveHistoryRef = useRef([]);
  const currentPlayerRef = useRef(1);
  const scoresRef = useRef([0, 0]);
  const totalMovesRef = useRef(0);
  const gameActiveRef = useRef(false);
  const gridSizeRef = useRef(3);
  const gameModeRef = useRef("pvp");
  const stakeEthRef = useRef(0.01);

  /* ── THEME ── */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
  }, [themeMode]);

  /* ── TOAST ── */
  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── SAFE SETTERS ── */
  const setCP = useCallback((p) => { currentPlayerRef.current = p; setCurrentPlayer(p); }, []);
  const setSc = useCallback((s) => { scoresRef.current = s; setScores(s); }, []);
  const setTM = useCallback((n) => { totalMovesRef.current = n; setTotalMoves(n); }, []);

  /* ── CANVAS SIZE ── */
  const getCellSize = useCallback(() =>
    Math.floor((canvasSize - PAD * 2) / gridSizeRef.current), [canvasSize]);

  const resizeCanvas = useCallback(() => {
    const maxW = Math.min(window.innerWidth - 80, 560);
    const cell = Math.floor((maxW - PAD * 2) / gridSizeRef.current);
    setCanvasSize(cell * gridSizeRef.current + PAD * 2);
  }, []);

  /* ── PARTICLE HELPERS ── */
  const spawnLineParticles = useCallback((x1, y1, x2, y2, color) => {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const px = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 4;
      const py = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 4;
      particlesRef.current.push(new Particle(px, py, color));
    }
    lineFlashesRef.current.push(new LineFlash(x1, y1, x2, y2, color));
  }, []);

  const spawnBoxParticles = useCallback((x, y, size, color) => {
    for (let i = 0; i < 20; i++) {
      const px = x + Math.random() * size;
      const py = y + Math.random() * size;
      particlesRef.current.push(new Particle(px, py, color));
    }
  }, []);

  /* ── DRAW BOARD ── */
  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cell = getCellSize();
    const size = canvasSize;

    ctx.clearRect(0, 0, size, size);

    /* boxes */
    for (let r = 0; r < gridSizeRef.current; r++) {
      for (let c = 0; c < gridSizeRef.current; c++) {
        if (boxesRef.current[r]?.[c]) {
          const x = PAD + c * cell, y = PAD + r * cell;
          const p = boxesRef.current[r][c];
          const grad = ctx.createRadialGradient(x + cell / 2, y + cell / 2, 0, x + cell / 2, y + cell / 2, cell * 0.7);
          grad.addColorStop(0, p === 1 ? "rgba(0,245,255,0.25)" : "rgba(255,0,110,0.25)");
          grad.addColorStop(1, p === 1 ? "rgba(0,245,255,0.05)" : "rgba(255,0,110,0.05)");
          ctx.fillStyle = grad;
          ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);

          ctx.fillStyle = p === 1 ? "rgba(0,245,255,0.6)" : "rgba(255,0,110,0.6)";
          ctx.font = `bold ${Math.floor(cell * 0.32)}px Orbitron, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = p === 1 ? COLORS.p1 : COLORS.p2;
          ctx.shadowBlur = 12;
          ctx.fillText(p === 1 ? "X" : "O", x + cell / 2, y + cell / 2);
          ctx.shadowBlur = 0;
        }
      }
    }

    /* hlines */
    for (let r = 0; r <= gridSizeRef.current; r++) {
      for (let c = 0; c < gridSizeRef.current; c++) {
        const x1 = PAD + c * cell, y1 = PAD + r * cell;
        const x2 = x1 + cell;
        const owned = hLinesRef.current[r]?.[c];
        const isHover = hoveredLine?.type === "h" && hoveredLine.r === r && hoveredLine.c === c;
        ctx.beginPath();
        ctx.moveTo(x1 + DOT / 2, y1);
        ctx.lineTo(x2 - DOT / 2, y1);
        ctx.lineWidth = owned ? 4 : isHover ? 3 : 2;
        ctx.strokeStyle = owned
          ? owned === 1 ? COLORS.p1 : COLORS.p2
          : isHover ? (currentPlayerRef.current === 1 ? "rgba(0,245,255,0.7)" : "rgba(255,0,110,0.7)")
          : COLORS.empty;
        if (owned) { ctx.shadowColor = owned === 1 ? COLORS.p1 : COLORS.p2; ctx.shadowBlur = 10; }
        ctx.stroke(); ctx.shadowBlur = 0;
      }
    }

    /* vlines */
    for (let r = 0; r < gridSizeRef.current; r++) {
      for (let c = 0; c <= gridSizeRef.current; c++) {
        const x1 = PAD + c * cell, y1 = PAD + r * cell;
        const y2 = y1 + cell;
        const owned = vLinesRef.current[r]?.[c];
        const isHover = hoveredLine?.type === "v" && hoveredLine.r === r && hoveredLine.c === c;
        ctx.beginPath();
        ctx.moveTo(x1, y1 + DOT / 2);
        ctx.lineTo(x1, y2 - DOT / 2);
        ctx.lineWidth = owned ? 4 : isHover ? 3 : 2;
        ctx.strokeStyle = owned
          ? owned === 1 ? COLORS.p1 : COLORS.p2
          : isHover ? (currentPlayerRef.current === 1 ? "rgba(0,245,255,0.7)" : "rgba(255,0,110,0.7)")
          : COLORS.empty;
        if (owned) { ctx.shadowColor = owned === 1 ? COLORS.p1 : COLORS.p2; ctx.shadowBlur = 10; }
        ctx.stroke(); ctx.shadowBlur = 0;
      }
    }

    /* dots */
    for (let r = 0; r <= gridSizeRef.current; r++) {
      for (let c = 0; c <= gridSizeRef.current; c++) {
        const x = PAD + c * cell, y = PAD + r * cell;
        const pulse = 1 + Math.sin(Date.now() * 0.003 + r * 0.7 + c * 0.5) * 0.15;
        ctx.beginPath();
        ctx.arc(x, y, (DOT / 2) * pulse, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.dot;
        ctx.shadowColor = "rgba(0,245,255,0.6)";
        ctx.shadowBlur = 8;
        ctx.fill(); ctx.shadowBlur = 0;
      }
    }

    /* particles */
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    particlesRef.current.forEach(p => { p.update(); p.draw(ctx); });

    lineFlashesRef.current = lineFlashesRef.current.filter(f => f.life > 0);
    lineFlashesRef.current.forEach(f => { f.update(); f.draw(ctx); });
  }, [canvasSize, getCellSize, hoveredLine]);

  /* ── ANIMATION LOOP ── */
  useEffect(() => {
    if (screen !== "game") return;
    const loop = () => {
      drawBoard();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [screen, drawBoard]);

  /* ── GAME HELPERS ── */
  const isGameOver = useCallback(() => {
    const [p1, p2] = scoresRef.current;
    return p1 + p2 === gridSizeRef.current * gridSizeRef.current;
  }, []);

  const countEdges = useCallback((r, c) =>
    (hLinesRef.current[r]?.[c] ? 1 : 0) +
    (hLinesRef.current[r + 1]?.[c] ? 1 : 0) +
    (vLinesRef.current[r]?.[c] ? 1 : 0) +
    (vLinesRef.current[r]?.[c + 1] ? 1 : 0), []);

  const checkBoxes = useCallback((player) => {
    let captured = false;
    const next = [...scoresRef.current];
    const cell = getCellSize();
    for (let r = 0; r < gridSizeRef.current; r++) {
      for (let c = 0; c < gridSizeRef.current; c++) {
        if (boxesRef.current[r][c]) continue;
        if (hLinesRef.current[r][c] && hLinesRef.current[r + 1][c] &&
          vLinesRef.current[r][c] && vLinesRef.current[r][c + 1]) {
          boxesRef.current[r][c] = player;
          next[player - 1] += 1;
          captured = true;
          const bx = PAD + c * cell, by = PAD + r * cell;
          spawnBoxParticles(bx, by, cell, player === 1 ? COLORS.p1 : COLORS.p2);
        }
      }
    }
    setSc(next);
    return captured;
  }, [getCellSize, setSc, spawnBoxParticles]);

  const getLineFromPos = useCallback((mx, my) => {
    const cell = getCellSize();
    for (let r = 0; r <= gridSizeRef.current; r++)
      for (let c = 0; c < gridSizeRef.current; c++) {
        const y = PAD + r * cell;
        if (Math.abs(my - y) < SNAP && mx > PAD + c * cell + DOT && mx < PAD + (c + 1) * cell - DOT)
          return { type: "h", r, c };
      }
    for (let r = 0; r < gridSizeRef.current; r++)
      for (let c = 0; c <= gridSizeRef.current; c++) {
        const x = PAD + c * cell;
        if (Math.abs(mx - x) < SNAP && my > PAD + r * cell + DOT && my < PAD + (r + 1) * cell - DOT)
          return { type: "v", r, c };
      }
    return null;
  }, [getCellSize]);

  const getAllFree = useCallback(() => {
    const lines = [];
    for (let r = 0; r <= gridSizeRef.current; r++)
      for (let c = 0; c < gridSizeRef.current; c++)
        if (!hLinesRef.current[r]?.[c]) lines.push({ type: "h", r, c });
    for (let r = 0; r < gridSizeRef.current; r++)
      for (let c = 0; c <= gridSizeRef.current; c++)
        if (!vLinesRef.current[r]?.[c]) lines.push({ type: "v", r, c });
    return lines;
  }, []);

  const lineCompletesBox = useCallback((line) => {
    if (line.type === "h") {
      if (line.r > 0 && countEdges(line.r - 1, line.c) === 3) return true;
      if (line.r < gridSizeRef.current && countEdges(line.r, line.c) === 3) return true;
    } else {
      if (line.c > 0 && countEdges(line.r, line.c - 1) === 3) return true;
      if (line.c < gridSizeRef.current && countEdges(line.r, line.c) === 3) return true;
    }
    return false;
  }, [countEdges]);

  const lineGivesOpp = useCallback((line) => {
    if (line.type === "h") {
      if (line.r > 0 && countEdges(line.r - 1, line.c) === 2) return true;
      if (line.r < gridSizeRef.current && countEdges(line.r, line.c) === 2) return true;
    } else {
      if (line.c > 0 && countEdges(line.r, line.c - 1) === 2) return true;
      if (line.c < gridSizeRef.current && countEdges(line.r, line.c) === 2) return true;
    }
    return false;
  }, [countEdges]);

  const spawnConfetti = useCallback(() => {
    const colors = [COLORS.p1, COLORS.p2, "#7b2fff", "#ffd60a", "#fff"];
    for (let i = 0; i < 60; i++) {
      const el = document.createElement("div");
      el.style.cssText = `position:fixed;width:8px;height:8px;top:-10px;
        left:${Math.random() * 100}vw;background:${colors[Math.floor(Math.random() * colors.length)]};
        border-radius:${Math.random() > 0.5 ? "50%" : "2px"};z-index:9999;pointer-events:none;
        animation:confettiFall ${2 + Math.random() * 2}s ${Math.random() * 0.5}s linear forwards;
        transform:rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    }
  }, []);

  const endGame = useCallback(() => {
    gameActiveRef.current = false; setGameActive(false);
    if (blockIntervalRef.current) { clearInterval(blockIntervalRef.current); blockIntervalRef.current = null; }
    const [p1, p2] = scoresRef.current;
    let winner = 0, icon = "🤝", title = "HÒA!", sub = "Cả hai đều xuất sắc!";
    if (p1 > p2) { winner = 1; icon = "🏆"; title = "X THẮNG!"; sub = `Tỉ số ${p1} - ${p2}.`; }
    else if (p2 > p1) { winner = 2; icon = gameModeRef.current === "ai" ? "🤖" : "🏆"; title = `${gameModeRef.current === "ai" ? "AI (O)" : "O"} THẮNG!`; sub = `Tỉ số ${p2} - ${p1}.`; }
    if (winner === 1 || winner === 0) spawnConfetti();
    setModalState({ open: true, icon, title, sub: sub + " Đang ghi lên blockchain...", tx: "Tx: Đang xử lý..." });
    chainTimeoutRef.current = setTimeout(() => {
      const tx = genTxHash();
      setModalState(prev => ({ ...prev, sub: sub + " Đã ghi on-chain thành công!", tx: `Tx: ${tx}` }));
      setGameHistory(prev => [{ id: Date.now(), date: new Date().toLocaleString("vi-VN"), gridSize: gridSizeRef.current, mode: gameModeRef.current, scores: [...scoresRef.current], winner, stake: stakeEthRef.current, tx, moves: totalMovesRef.current }, ...prev].slice(0, 50));
    }, 1500 + Math.random() * 1000);
  }, [spawnConfetti]);

  const applyMove = useCallback((line) => {
    if (!gameActiveRef.current) return;
    const player = currentPlayerRef.current;
    const cell = getCellSize();
    const color = player === 1 ? COLORS.p1 : COLORS.p2;

    if (line.type === "h") {
      hLinesRef.current[line.r][line.c] = player;
      const x1 = PAD + line.c * cell, y1 = PAD + line.r * cell;
      spawnLineParticles(x1 + DOT / 2, y1, x1 + cell - DOT / 2, y1, color);
    } else {
      vLinesRef.current[line.r][line.c] = player;
      const x1 = PAD + line.c * cell, y1 = PAD + line.r * cell;
      spawnLineParticles(x1, y1 + DOT / 2, x1, y1 + cell - DOT / 2, color);
    }

    moveHistoryRef.current.push({ line, player });
    setTM(totalMovesRef.current + 1);
    const captured = checkBoxes(player);
    setDrawVersion(v => v + 1);

    if (isGameOver()) { setTimeout(endGame, 250); return; }
    if (!captured) setCP(player === 1 ? 2 : 1);

    if (gameModeRef.current === "ai" && currentPlayerRef.current === 2 && gameActiveRef.current) {
      aiTimeoutRef.current = setTimeout(() => {
        const all = getAllFree();
        const move = all.find(l => lineCompletesBox(l)) ?? all.find(l => !lineGivesOpp(l)) ?? (all.length ? all[Math.floor(Math.random() * all.length)] : null);
        if (move) applyMove(move);
      }, 500 + Math.random() * 400);
    }
  }, [checkBoxes, endGame, getCellSize, getAllFree, isGameOver, lineCompletesBox, lineGivesOpp, setCP, setTM, spawnLineParticles]);

  const startGame = useCallback(() => {
    const empty = createEmptyState(gridSize);
    hLinesRef.current = empty.hLines;
    vLinesRef.current = empty.vLines;
    boxesRef.current = empty.boxes;
    moveHistoryRef.current = [];
    particlesRef.current = [];
    lineFlashesRef.current = [];
    setSc([0, 0]); setCP(1); setTM(0);
    gameActiveRef.current = true; setGameActive(true);
    setHoveredLine(null); setScreen("game");
    gridSizeRef.current = gridSize;
    blockIntervalRef.current = setInterval(() => setBlockNum(p => p + 1), 12000);
    setDrawVersion(v => v + 1);
  }, [gridSize, setCP, setSc, setTM]);

  const goHome = useCallback(() => {
    if (gameActiveRef.current && !window.confirm("Thoát ván chơi?")) return;
    gameActiveRef.current = false; setGameActive(false);
    if (blockIntervalRef.current) clearInterval(blockIntervalRef.current);
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    if (chainTimeoutRef.current) clearTimeout(chainTimeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setScreen("home");
  }, []);

  const undoMove = useCallback(() => {
    if (!moveHistoryRef.current.length) { showToast("Không có nước để hoàn tác!"); return; }
    const last = moveHistoryRef.current.pop();
    if (!last) return;
    // rebuild
    const empty = createEmptyState(gridSizeRef.current);
    const nextSc = [0, 0];
    for (const mv of moveHistoryRef.current) {
      if (mv.line.type === "h") empty.hLines[mv.line.r][mv.line.c] = mv.player;
      else empty.vLines[mv.line.r][mv.line.c] = mv.player;
      for (let r = 0; r < gridSizeRef.current; r++)
        for (let c = 0; c < gridSizeRef.current; c++) {
          if (empty.boxes[r][c]) continue;
          if (empty.hLines[r][c] && empty.hLines[r + 1][c] && empty.vLines[r][c] && empty.vLines[r][c + 1]) {
            empty.boxes[r][c] = mv.player; nextSc[mv.player - 1]++;
          }
        }
    }
    hLinesRef.current = empty.hLines; vLinesRef.current = empty.vLines; boxesRef.current = empty.boxes;
    setSc(nextSc); setCP(last.player); setTM(moveHistoryRef.current.length);
    setDrawVersion(v => v + 1);
  }, [setCP, setSc, setTM, showToast]);

  const confirmForfeit = useCallback(() => {
    if (!window.confirm("Xác nhận bỏ cuộc?")) return;
    gameActiveRef.current = false; setGameActive(false);
    if (blockIntervalRef.current) clearInterval(blockIntervalRef.current);
    const winner = currentPlayerRef.current === 1 ? 2 : 1;
    const full = gridSizeRef.current * gridSizeRef.current;
    setSc(winner === 1 ? [full, 0] : [0, full]);
    setCP(winner); setDrawVersion(v => v + 1); endGame();
  }, [endGame, setCP, setSc]);

  const onMouseMove = useCallback((e) => {
    if (!gameActiveRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const line = getLineFromPos(mx, my);
    const taken = line && (line.type === "h" ? hLinesRef.current[line.r]?.[line.c] : vLinesRef.current[line.r]?.[line.c]);
    setHoveredLine(line && !taken ? line : null);
  }, [getLineFromPos]);

  const onClick = useCallback((e) => {
    if (!gameActiveRef.current || !canvasRef.current) return;
    if (gameModeRef.current === "ai" && currentPlayerRef.current === 2) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const line = getLineFromPos(mx, my);
    if (!line) return;
    const taken = line.type === "h" ? hLinesRef.current[line.r]?.[line.c] : vLinesRef.current[line.r]?.[line.c];
    if (taken) return;
    applyMove(line);
  }, [applyMove, getLineFromPos]);

  /* ── ROOM ACTIONS ── */
  const createRoom = useCallback(() => {
    const code = genRoomCode();
    setRoomCode(code);
    setRoomPlayers(1);
    setRoomChat([{ id: 1, user: "System", msg: `Phòng ${code} đã được tạo. Chia sẻ mã để đối thủ tham gia.` }]);
    setRoomCountdown(null);
    setScreen("waiting");
    // simulate opponent joining after 5s
    setTimeout(() => {
      setRoomPlayers(2);
      setRoomChat(prev => [...prev, { id: Date.now(), user: "System", msg: "Đối thủ đã tham gia! Bắt đầu sau 5 giây..." }]);
      let t = 5;
      setRoomCountdown(t);
      countdownRef.current = setInterval(() => {
        t--;
        setRoomCountdown(t);
        if (t <= 0) {
          clearInterval(countdownRef.current);
          setRoomCountdown(null);
          startGame();
        }
      }, 1000);
    }, 5000);
  }, [startGame]);

  const joinRoom = useCallback(() => {
    if (!joinCode.trim()) { showToast("Nhập mã phòng!"); return; }
    setRoomCode(joinCode.toUpperCase());
    setRoomPlayers(2);
    setRoomChat([
      { id: 1, user: "System", msg: `Đã tham gia phòng ${joinCode.toUpperCase()}.` },
      { id: 2, user: "System", msg: "Bắt đầu sau 3 giây..." }
    ]);
    setJoinCode("");
    setScreen("waiting");
    let t = 3; setRoomCountdown(t);
    countdownRef.current = setInterval(() => {
      t--; setRoomCountdown(t);
      if (t <= 0) { clearInterval(countdownRef.current); setRoomCountdown(null); startGame(); }
    }, 1000);
  }, [joinCode, showToast, startGame]);

  const sendChat = useCallback(() => {
    if (!chatMsg.trim()) return;
    setRoomChat(prev => [...prev, { id: Date.now(), user: "Bạn", msg: chatMsg }]);
    setChatMsg("");
    // echo
    setTimeout(() => {
      setRoomChat(prev => [...prev, { id: Date.now() + 1, user: "Đối thủ", msg: ["Sẵn sàng rồi!", "Tôi sẽ thắng 😄", "Gg!"][Math.floor(Math.random() * 3)] }]);
    }, 1200 + Math.random() * 800);
  }, [chatMsg]);

  /* ── EFFECTS ── */
  useEffect(() => { gridSizeRef.current = gridSize; resizeCanvas(); }, [gridSize, resizeCanvas]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { stakeEthRef.current = stakeEth; }, [stakeEth]);
  useEffect(() => { if (screen === "game") { resizeCanvas(); const h = () => resizeCanvas(); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); } }, [screen, resizeCanvas]);

  const totalEth = useMemo(() => gameHistory.reduce((s, g) => s + (g.stake || 0), 0), [gameHistory]);
  const winRate = useMemo(() => gameHistory.length ? Math.round(gameHistory.filter(g => g.winner === 1).length / gameHistory.length * 100) : 0, [gameHistory]);

  /* ─── STYLES ─────────────────────────────────────────── */
  const css = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;600&display=swap');
@keyframes confettiFall{to{transform:translateY(110vh) rotate(720deg);opacity:0}}
@keyframes gridShift{to{background-position:40px 40px}}
@keyframes orbFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-30px) scale(1.1)}}
@keyframes titlePulse{0%,100%{filter:drop-shadow(0 0 30px rgba(0,245,255,.5))}50%{filter:drop-shadow(0 0 60px rgba(123,47,255,.8))}}
@keyframes slideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes countdownPop{0%{transform:scale(2);opacity:0}50%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
:root{
  --bg:#020810;--surface:#0a1628;--surface2:#0f1f3d;
  --accent:#00f5ff;--accent2:#ff006e;--accent3:#7b2fff;
  --gold:#ffd60a;--p1:#00f5ff;--p2:#ff006e;
  --text:#e0f0ff;--muted:#4a6fa5;--border:rgba(0,245,255,.15);
  --glow:0 0 20px rgba(0,245,255,.4);--nav-bg:rgba(2,8,16,.85);
}
:root[data-theme=light]{
  --bg:#eef3f9;--surface:#fff;--surface2:#eaf1fb;
  --accent:#0aa9d8;--accent2:#d94a82;--accent3:#3d73d9;
  --gold:#c78a07;--p1:#0aa9d8;--p2:#d94a82;
  --text:#122033;--muted:#4f6178;--border:rgba(10,169,216,.28);
  --glow:0 0 20px rgba(10,169,216,.28);--nav-bg:rgba(235,242,251,.9);
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Rajdhani',sans-serif;overflow-x:hidden}
.app{min-height:100vh;position:relative}
.bg-grid{position:fixed;inset:0;z-index:0;background-image:linear-gradient(rgba(0,245,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,245,255,.03) 1px,transparent 1px);background-size:40px 40px;animation:gridShift 20s linear infinite}
.bg-orbs{position:fixed;inset:0;z-index:0;pointer-events:none}
.orb{position:absolute;border-radius:50%;filter:blur(80px);opacity:.15;animation:orbFloat 8s ease-in-out infinite}
.orb1{width:400px;height:400px;background:var(--accent3);top:-100px;left:-100px}
.orb2{width:300px;height:300px;background:var(--accent2);bottom:-50px;right:-50px;animation-delay:3s}
.orb3{width:200px;height:200px;background:var(--accent);top:50%;left:50%;animation-delay:6s}
.wrap{position:relative;z-index:1}
.screen{min-height:100vh;padding:20px;display:flex;flex-direction:column;align-items:center}
#homeScreen{justify-content:center;gap:28px;padding-top:40px;padding-bottom:40px}
.logo-title{font-family:'Orbitron',monospace;font-size:clamp(28px,6vw,72px);font-weight:900;letter-spacing:4px;background:linear-gradient(135deg,var(--accent),var(--accent3),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:titlePulse 3s ease-in-out infinite;text-align:center}
.logo-sub{font-size:13px;letter-spacing:7px;color:var(--muted);text-transform:uppercase;margin-top:8px;text-align:center}
.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:480px;padding:24px 28px;position:relative;overflow:hidden;animation:slideIn .4s ease both}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--accent),var(--accent3),transparent)}
.card-title{font-family:'Orbitron',monospace;font-size:12px;letter-spacing:3px;color:var(--accent);text-transform:uppercase;margin-bottom:18px}
.row{margin-bottom:16px}
.row label{display:block;color:var(--muted);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px}
.size-btns,.mode-btns{display:flex;gap:8px}
.sz-btn,.md-btn{flex:1;padding:10px;border:1px solid var(--border);background:transparent;color:var(--muted);border-radius:8px;cursor:pointer;font-family:'Orbitron',monospace;font-size:12px;transition:.2s}
.sz-btn.on,.sz-btn:hover{border-color:var(--accent);color:var(--accent);background:rgba(0,245,255,.08);box-shadow:var(--glow)}
.md-btn.on,.md-btn:hover{border-color:var(--accent3);color:var(--accent3);background:rgba(123,47,255,.1)}
.stake-wrap{display:flex;align-items:center;gap:12px}
.stake-inp{flex:1;padding:10px 14px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:'Orbitron',monospace;font-size:14px;border-radius:8px;outline:none}
.stake-inp:focus{border-color:var(--accent);box-shadow:var(--glow)}
.stake-unit{color:var(--gold);font-weight:700}
.btn-primary{width:100%;max-width:480px;border:none;border-radius:12px;padding:15px;background:linear-gradient(135deg,var(--accent3),var(--accent2));color:#fff;font-family:'Orbitron',monospace;font-size:13px;font-weight:700;letter-spacing:3px;cursor:pointer;transition:.25s}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(255,0,110,.4)}
.btn-ghost{padding:9px 18px;border:1px solid var(--border);background:transparent;color:var(--muted);border-radius:8px;cursor:pointer;font-size:13px;font-family:'Rajdhani',sans-serif;transition:.2s}
.btn-ghost:hover{border-color:var(--accent);color:var(--accent)}
.wallet-dot{width:9px;height:9px;border-radius:50%;background:var(--accent2);box-shadow:0 0 8px var(--accent2);flex-shrink:0}
.wallet-dot.on{background:var(--accent);box-shadow:0 0 8px var(--accent)}
.wallet-status{display:flex;align-items:center;gap:10px}
.wallet-addr{font-family:'Orbitron',monospace;font-size:12px;flex:1}
.wallet-bal{margin-top:6px;color:var(--muted);font-size:11px}
.bal-val{color:var(--gold);font-weight:700}
/* nav */
.nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:13px 24px;display:flex;align-items:center;background:var(--nav-bg);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav-logo{font-family:'Orbitron',monospace;font-size:13px;font-weight:900;color:var(--accent);letter-spacing:2px}
.nav-links{margin-left:auto;display:flex;gap:6px}
/* game screen */
.game-screen{padding-top:80px;padding-bottom:40px;gap:20px}
.scoreboard{display:flex;gap:12px;align-items:center;width:100%;max-width:800px}
.p-card{flex:1;border-radius:12px;padding:14px 18px;background:var(--surface);border:1px solid var(--border)}
.p-card.active{border-color:var(--p1);box-shadow:0 0 20px rgba(0,245,255,.2)}
.p-card.p2.active{border-color:var(--p2);box-shadow:0 0 20px rgba(255,0,110,.2)}
.p-name{font-family:'Orbitron',monospace;font-size:10px;letter-spacing:2px;color:var(--muted);text-transform:uppercase}
.p-score{font-family:'Orbitron',monospace;font-size:30px;font-weight:900}
.p-boxes{color:var(--muted);font-size:11px}
.vs{width:42px;height:42px;border-radius:50%;background:var(--surface2);border:1px solid var(--border);display:flex;justify-content:center;align-items:center;font-family:'Orbitron',monospace;font-size:10px;font-weight:700;color:var(--muted);flex-shrink:0}
.ticker{width:100%;max-width:800px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:9px 16px;display:flex;gap:16px;overflow-x:auto}
.ticker-item{white-space:nowrap;flex-shrink:0}
.t-lbl{font-size:10px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-right:6px}
.t-val{font-family:'Orbitron',monospace;font-size:11px}
.green{color:var(--accent)}.pink{color:var(--accent2)}.gold{color:var(--gold)}.purple{color:var(--accent3)}
.t-sep{color:var(--border)}
.turn-pill{padding:7px 20px;border-radius:999px;background:var(--surface2);border:1px solid var(--border);font-family:'Orbitron',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase}
.board-wrap{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;box-shadow:0 0 60px rgba(0,0,0,.5)}
.game-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.forfeit-btn{border:none;border-radius:8px;padding:10px 20px;background:linear-gradient(135deg,var(--accent3),var(--accent2));color:#fff;font-family:'Orbitron',monospace;font-size:11px;letter-spacing:2px;cursor:pointer}
/* history */
.history-screen{padding-top:80px;padding-bottom:40px;max-width:900px;margin:0 auto;width:100%;gap:20px;align-items:stretch}
.h-title{font-family:'Orbitron',monospace;font-size:18px;font-weight:700;color:var(--accent)}
.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 20px;text-align:center}
.s-val{font-family:'Orbitron',monospace;font-size:28px;font-weight:900}
.s-lbl{font-size:10px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-top:4px}
.c1{color:var(--accent)}.c2{color:var(--accent2)}.c3{color:var(--gold)}
.h-list{display:flex;flex-direction:column;gap:8px}
.h-item{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 18px;display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:14px}
.h-num{font-family:'Orbitron',monospace;font-size:11px;color:var(--muted)}
.h-players{font-size:14px;font-weight:600}
.h-meta{color:var(--muted);font-size:11px}
.h-tx-hash{font-family:'Orbitron',monospace;font-size:10px;color:var(--accent3)}
.h-amount{font-size:12px;color:var(--gold)}
.badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;letter-spacing:1px}
.badge.p1{background:rgba(0,245,255,.1);color:var(--p1);border:1px solid rgba(0,245,255,.3)}
.badge.p2{background:rgba(255,0,110,.1);color:var(--p2);border:1px solid rgba(255,0,110,.3)}
.badge.draw{background:rgba(255,214,10,.1);color:var(--gold);border:1px solid rgba(255,214,10,.3)}
.empty-state{text-align:center;padding:60px;color:var(--muted)}
/* room */
.room-screen{padding-top:80px;padding-bottom:40px;gap:24px;max-width:560px;margin:0 auto;width:100%}
.room-btns{display:flex;gap:12px;width:100%;max-width:480px}
.room-btn{flex:1;padding:14px;border:1px solid var(--border);background:var(--surface);border-radius:12px;cursor:pointer;font-family:'Orbitron',monospace;font-size:12px;letter-spacing:2px;color:var(--muted);transition:.2s}
.room-btn:hover,.room-btn.on{border-color:var(--accent3);color:var(--accent3);background:rgba(123,47,255,.1);box-shadow:0 0 20px rgba(123,47,255,.2)}
.join-row{display:flex;gap:8px}
.join-inp{flex:1;padding:11px 14px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:'Orbitron',monospace;font-size:14px;letter-spacing:3px;border-radius:8px;outline:none;text-transform:uppercase}
.join-inp:focus{border-color:var(--accent);box-shadow:var(--glow)}
/* waiting */
.waiting-screen{padding-top:80px;padding-bottom:40px;gap:24px;max-width:560px;margin:0 auto;width:100%;align-items:center}
.room-code-box{background:var(--surface);border:2px solid var(--accent3);border-radius:16px;padding:24px 32px;text-align:center;width:100%;max-width:480px;position:relative;overflow:hidden}
.room-code-box::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--accent),var(--accent3),var(--accent2))}
.code-label{font-size:11px;letter-spacing:3px;color:var(--muted);text-transform:uppercase;margin-bottom:10px}
.code-val{font-family:'Orbitron',monospace;font-size:36px;font-weight:900;color:var(--accent3);letter-spacing:8px}
.code-hint{font-size:12px;color:var(--muted);margin-top:8px}
.players-row{display:flex;gap:16px;justify-content:center;align-items:center;margin-top:16px}
.player-slot{display:flex;flex-direction:column;align-items:center;gap:6px}
.slot-avatar{width:48px;height:48px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;font-size:20px;font-family:'Orbitron',monospace}
.slot-avatar.p1{border-color:var(--p1);box-shadow:0 0 16px rgba(0,245,255,.3);color:var(--p1)}
.slot-avatar.p2{border-color:var(--p2);box-shadow:0 0 16px rgba(255,0,110,.3);color:var(--p2)}
.slot-avatar.empty{border-color:var(--border);color:var(--muted);animation:pulse 1.5s ease-in-out infinite}
.slot-name{font-size:11px;letter-spacing:2px;color:var(--muted);text-transform:uppercase}
.vs-sep{font-family:'Orbitron',monospace;font-size:12px;color:var(--muted)}
.chat-box{background:var(--surface);border:1px solid var(--border);border-radius:12px;width:100%;max-width:480px;overflow:hidden}
.chat-header{padding:12px 16px;border-bottom:1px solid var(--border);font-family:'Orbitron',monospace;font-size:11px;color:var(--accent);letter-spacing:2px;text-transform:uppercase}
.chat-messages{padding:12px 16px;height:140px;overflow-y:auto;display:flex;flex-direction:column;gap:6px}
.chat-msg{font-size:13px;line-height:1.4}
.chat-msg .user{font-weight:700;margin-right:6px}
.chat-msg .user.sys{color:var(--muted)}
.chat-msg .user.you{color:var(--p1)}
.chat-msg .user.opp{color:var(--p2)}
.chat-send{display:flex;gap:0;border-top:1px solid var(--border)}
.chat-inp{flex:1;padding:10px 14px;border:none;background:transparent;color:var(--text);font-family:'Rajdhani',sans-serif;font-size:13px;outline:none}
.chat-send-btn{padding:10px 16px;border:none;border-left:1px solid var(--border);background:rgba(123,47,255,.15);color:var(--accent3);cursor:pointer;font-size:12px;font-family:'Orbitron',monospace;letter-spacing:1px;transition:.2s}
.chat-send-btn:hover{background:rgba(123,47,255,.3)}
.countdown{font-family:'Orbitron',monospace;font-size:56px;font-weight:900;color:var(--accent3);text-shadow:0 0 40px rgba(123,47,255,.8);animation:countdownPop .4s ease}
.waiting-label{font-family:'Orbitron',monospace;font-size:12px;letter-spacing:3px;color:var(--muted);text-transform:uppercase;animation:pulse 1.5s ease-in-out infinite}
/* settings overlay */
.settings-overlay{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px}
.settings-modal{background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:36px;max-width:420px;width:100%;position:relative;overflow:hidden;animation:slideIn .25s ease both}
.settings-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--accent),var(--accent3),var(--accent2))}
.settings-title{font-family:'Orbitron',monospace;font-size:14px;font-weight:700;color:var(--accent);letter-spacing:3px;text-transform:uppercase;margin-bottom:24px}
.setting-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border)}
.setting-row:last-child{border-bottom:none}
.setting-label{font-size:14px;font-weight:600;color:var(--text)}
.setting-sub{font-size:11px;color:var(--muted);margin-top:2px}
.toggle{width:44px;height:24px;border-radius:12px;background:var(--surface);border:1px solid var(--border);cursor:pointer;position:relative;transition:.3s;flex-shrink:0}
.toggle.on{background:rgba(0,245,255,.2);border-color:var(--accent)}
.toggle-knob{position:absolute;width:18px;height:18px;border-radius:50%;background:var(--muted);top:2px;left:2px;transition:.3s}
.toggle.on .toggle-knob{left:22px;background:var(--accent)}
.nav-btn{background:none;border:none;cursor:pointer;padding:4px;color:var(--muted);font-size:18px;border-radius:6px;transition:.2s}
.nav-btn:hover{color:var(--accent);background:rgba(0,245,255,.08)}
.screens-list{display:flex;flex-direction:column;gap:4px;margin-top:4px}
.screen-link{display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--muted);cursor:pointer;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:600;transition:.2s;text-align:left;width:100%}
.screen-link:hover{border-color:var(--accent3);color:var(--accent3);background:rgba(123,47,255,.08)}
.screen-link .icon{font-size:16px;width:20px}
/* modal */
.modal-overlay{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.8);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:36px;max-width:420px;width:100%;text-align:center;position:relative;overflow:hidden}
.modal::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--accent),var(--accent3),var(--accent2))}
.modal-icon{font-size:52px;margin-bottom:14px}
.modal-title{font-family:'Orbitron',monospace;font-size:20px;font-weight:900;margin-bottom:8px}
.modal-sub{color:var(--muted);font-size:13px;margin-bottom:20px;line-height:1.6}
.modal-tx{background:var(--surface);border-radius:8px;padding:10px 14px;font-family:'Orbitron',monospace;font-size:10px;margin-bottom:20px;word-break:break-all;color:var(--accent3)}
.modal-btns{display:flex;gap:8px}
.modal-btns .btn-ghost,.modal-btns .btn-primary{flex:1;font-size:12px;padding:12px;max-width:none}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--surface2);border:1px solid var(--accent3);border-radius:10px;padding:11px 22px;z-index:500;font-family:'Orbitron',monospace;font-size:11px;letter-spacing:1px;box-shadow:0 0 30px rgba(123,47,255,.4);animation:slideIn .2s ease}
@media(max-width:600px){
  .scoreboard{flex-direction:column}
  .stats-row{grid-template-columns:1fr}
  .h-item{grid-template-columns:1fr}
}
`;

  /* ─── JSX ─────────────────────────────────────────────── */
  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="bg-grid" />
        <div className="bg-orbs">
          <div className="orb orb1" /><div className="orb orb2" /><div className="orb orb3" />
        </div>

        {/* NAV */}
        {screen !== "home" && (
          <nav className="nav">
            <div className="nav-logo">D&amp;B // CHAIN</div>
            <div className="nav-links">
              <button className="btn-ghost" onClick={() => setSettingsOpen(true)}>⚙</button>
              <button className="btn-ghost" onClick={goHome}>🏠 Home</button>
              <button className="btn-ghost" onClick={() => setScreen("history")}>📋</button>
            </div>
          </nav>
        )}

        <div className="wrap">
          {/* ── HOME ── */}
          {screen === "home" && (
            <section className="screen" id="homeScreen">
              <div>
                <div className="logo-title">DOTS &amp; BOXES</div>
                <div className="logo-sub">Blockchain Edition // Testnet</div>
              </div>

              {/* Wallet */}
              <div className="card">
                <div className="card-title">⬡ Ví Blockchain</div>
                <div className="wallet-status">
                  <div className={`wallet-dot ${walletConnected ? "on" : ""}`} />
                  <div className="wallet-addr">{walletAddress}</div>
                  <button className="btn-ghost" style={{ marginLeft: "auto", fontSize: 11 }} onClick={() => {
                    const addr = "0x" + Array.from({ length: 4 }, () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0")).join("") + "...";
                    setTimeout(() => { setWalletConnected(true); setWalletAddress(addr); setWalletBalance((Math.random() * 2 + .1).toFixed(4)); showToast("Kết nối ví thành công!"); }, 1000);
                  }} disabled={walletConnected}>
                    {walletConnected ? "✓ Đã kết nối" : "Kết Nối"}
                  </button>
                </div>
                {walletConnected && <div className="wallet-bal">Số dư: <span className="bal-val">{walletBalance}</span> ETH · <span style={{ color: "var(--accent3)" }}>Sepolia</span></div>}
              </div>

              {/* Config */}
              <div className="card">
                <div className="card-title">⬡ Cấu Hình Ván Chơi</div>
                <div className="row">
                  <label>Kích Thước Bảng</label>
                  <div className="size-btns">
                    {[3, 4, 5, 6].map(s => (
                      <button key={s} className={`sz-btn ${gridSize === s ? "on" : ""}`} onClick={() => setGridSize(s)}>{s}×{s}</button>
                    ))}
                  </div>
                </div>
                <div className="row">
                  <label>Stake (ETH)</label>
                  <div className="stake-wrap">
                    <input className="stake-inp" type="number" min="0" step="0.001" value={stakeEth} onChange={e => setStakeEth(+e.target.value || 0)} />
                    <span className="stake-unit">ETH</span>
                  </div>
                </div>
                <div className="row">
                  <label>Chế Độ Chơi</label>
                  <div className="mode-btns">
                    <button className={`md-btn ${gameMode === "pvp" ? "on" : ""}`} onClick={() => setGameMode("pvp")}>👥 PvP Local</button>
                    <button className={`md-btn ${gameMode === "ai" ? "on" : ""}`} onClick={() => setGameMode("ai")}>🤖 vs AI</button>
                  </div>
                </div>
              </div>

              <button className="btn-primary" onClick={startGame}>⚡ BẮT ĐẦU VÁN CHƠI</button>

              {/* Room buttons */}
              <div className="room-btns">
                <button className="room-btn" onClick={() => setScreen("room")}>🚪 Tạo / Vào Phòng</button>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setScreen("history")}>📋 Lịch Sử</button>
                <button className="btn-ghost" onClick={() => setSettingsOpen(true)}>⚙</button>
              </div>
            </section>
          )}

          {/* ── ROOM SETUP ── */}
          {screen === "room" && (
            <section className="screen room-screen">
              <div style={{ width: "100%", maxWidth: 480 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <button className="btn-ghost" onClick={goHome}>← Quay lại</button>
                  <div style={{ fontFamily: "Orbitron, monospace", fontSize: 16, color: "var(--accent)" }}>Phòng Chơi Online</div>
                </div>
                <div className="card" style={{ marginBottom: 0 }}>
                  <div className="card-title">🚪 Tạo Phòng Mới</div>
                  <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>Tạo phòng riêng và chia sẻ mã cho đối thủ để bắt đầu ván đấu.</p>
                  <div className="row">
                    <label>Kích Thước Bảng</label>
                    <div className="size-btns">
                      {[3, 4, 5, 6].map(s => (
                        <button key={s} className={`sz-btn ${gridSize === s ? "on" : ""}`} onClick={() => setGridSize(s)}>{s}×{s}</button>
                      ))}
                    </div>
                  </div>
                  <div className="row">
                    <label>Stake (ETH)</label>
                    <div className="stake-wrap">
                      <input className="stake-inp" type="number" min="0" step="0.001" value={stakeEth} onChange={e => setStakeEth(+e.target.value || 0)} />
                      <span className="stake-unit">ETH</span>
                    </div>
                  </div>
                  <button className="btn-primary" style={{ marginTop: 4 }} onClick={createRoom}>⚡ TẠO PHÒNG</button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0", color: "var(--muted)", fontSize: 12 }}>
                  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                  <span>HOẶC</span>
                  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                </div>

                <div className="card" style={{ marginBottom: 0 }}>
                  <div className="card-title">🔑 Vào Phòng</div>
                  <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>Nhập mã phòng 6 ký tự để tham gia ván đấu.</p>
                  <div className="join-row">
                    <input className="join-inp" placeholder="XXXXXX" value={joinCode} maxLength={6}
                      onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && joinRoom()} />
                    <button className="btn-primary" style={{ width: "auto", padding: "11px 20px" }} onClick={joinRoom}>Vào →</button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── WAITING ROOM ── */}
          {screen === "waiting" && (
            <section className="screen waiting-screen">
              <div style={{ fontFamily: "Orbitron, monospace", fontSize: 14, color: "var(--accent)", letterSpacing: 3, textTransform: "uppercase" }}>Phòng Chờ</div>

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
                    <div className={`slot-avatar ${roomPlayers >= 2 ? "p2" : "empty"}`}>
                      {roomPlayers >= 2 ? "O" : "?"}
                    </div>
                    <div className="slot-name">{roomPlayers >= 2 ? "Đối thủ" : "Đang chờ..."}</div>
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
                  {roomChat.map(msg => (
                    <div key={msg.id} className="chat-msg">
                      <span className={`user ${msg.user === "System" ? "sys" : msg.user === "Bạn" ? "you" : "opp"}`}>{msg.user}:</span>
                      {msg.msg}
                    </div>
                  ))}
                </div>
                <div className="chat-send">
                  <input className="chat-inp" placeholder="Nhắn tin..." value={chatMsg}
                    onChange={e => setChatMsg(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendChat()} />
                  <button className="chat-send-btn" onClick={sendChat}>Gửi</button>
                </div>
              </div>

              <button className="btn-ghost" onClick={goHome}>← Thoát Phòng</button>
            </section>
          )}

          {/* ── GAME ── */}
          {screen === "game" && (
            <section className="screen game-screen">
              <div className="scoreboard">
                <div className={`p-card ${currentPlayer === 1 ? "active" : ""}`}>
                  <div className="p-name">NGƯỜI CHƠI <span style={{ color: "var(--p1)" }}>X</span></div>
                  <div className="p-score" style={{ color: "var(--p1)" }}>{scores[0]}</div>
                  <div className="p-boxes">{scores[0]} ô</div>
                </div>
                <div className="vs">VS</div>
                <div className={`p-card p2 ${currentPlayer === 2 ? "active" : ""}`}>
                  <div className="p-name">{gameMode === "ai" ? "AI" : "NGƯỜI CHƠI"} <span style={{ color: "var(--p2)" }}>O</span></div>
                  <div className="p-score" style={{ color: "var(--p2)" }}>{scores[1]}</div>
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
              </div>

              <div className="turn-pill">
                Lượt:{" "}
                <span style={{ color: currentPlayer === 1 ? "var(--p1)" : "var(--p2)" }}>
                  {currentPlayer === 1 ? "X" : gameMode === "ai" ? "AI (O) 🤖" : "O"}
                </span>
              </div>

              <div className="board-wrap">
                <canvas ref={canvasRef} width={canvasSize} height={canvasSize}
                  style={{ width: canvasSize, height: canvasSize, cursor: hoveredLine ? "pointer" : "default", display: "block" }}
                  onMouseMove={onMouseMove} onMouseLeave={() => setHoveredLine(null)} onClick={onClick} />
              </div>

              <div className="game-actions">
                <button className="btn-ghost" onClick={goHome}>← Thoát</button>
                <button className="btn-ghost" onClick={undoMove} disabled={!gameActive}>↩ Hoàn Tác</button>
                <button className="forfeit-btn" onClick={confirmForfeit} disabled={!gameActive}>Bỏ Cuộc</button>
                <button className="btn-ghost" onClick={() => setSettingsOpen(true)}>⚙ Cài đặt</button>
              </div>
            </section>
          )}

          {/* ── HISTORY ── */}
          {screen === "history" && (
            <section className="screen history-screen">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="h-title">⬡ Lịch Sử On-Chain</div>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: "var(--muted)", textTransform: "uppercase", marginTop: 4 }}>Sepolia · Contract 0x4a2f...c3e1</div>
                </div>
                <button className="btn-ghost" onClick={goHome}>← Quay Lại</button>
              </div>
              <div className="stats-row">
                <div className="stat-card"><div className="s-val c1">{gameHistory.length}</div><div className="s-lbl">Ván Đã Chơi</div></div>
                <div className="stat-card"><div className="s-val c3">{totalEth.toFixed(3)}</div><div className="s-lbl">Tổng ETH</div></div>
                <div className="stat-card"><div className="s-val c2">{gameHistory.length ? `${winRate}%` : "—"}</div><div className="s-lbl">Win Rate X</div></div>
              </div>
              <div className="h-list">
                {!gameHistory.length && <div className="empty-state"><div style={{ fontSize: 40, marginBottom: 12, opacity: .4 }}>📭</div><div>Chưa có ván nào được ghi on-chain</div></div>}
                {gameHistory.map((g, idx) => {
                  const bc = g.winner === 0 ? "draw" : g.winner === 1 ? "p1" : "p2";
                  const bt = g.winner === 0 ? "HÒA" : g.winner === 1 ? "X THẮNG" : `${g.mode === "ai" ? "AI (O)" : "O"} THẮNG`;
                  return (
                    <div className="h-item" key={g.id}>
                      <div className="h-num">#{gameHistory.length - idx}</div>
                      <div><div className="h-players">X vs {g.mode === "ai" ? "AI (O) 🤖" : "O"} · {g.gridSize}×{g.gridSize}</div><div className="h-meta">{g.date} · {g.moves} nước</div></div>
                      <div style={{ textAlign: "center" }}><span className={`badge ${bc}`}>{bt}</span><div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>{g.scores[0]} - {g.scores[1]}</div></div>
                      <div style={{ textAlign: "right" }}><div className="h-tx-hash">{g.tx.slice(0, 10)}...{g.tx.slice(-6)}</div><div className="h-amount">{g.stake > 0 ? `${g.stake.toFixed(3)} ETH` : "Free"}</div></div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* ── SETTINGS OVERLAY ── */}
        {settingsOpen && (
          <div className="settings-overlay" onClick={e => e.target === e.currentTarget && setSettingsOpen(false)}>
            <div className="settings-modal">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div className="settings-title" style={{ marginBottom: 0 }}>⚙ Cài Đặt</div>
                <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setSettingsOpen(false)}>✕ Đóng</button>
              </div>

              <div className="setting-row">
                <div><div className="setting-label">Giao Diện</div><div className="setting-sub">{themeMode === "dark" ? "Chế độ tối" : "Chế độ sáng"}</div></div>
                <div className={`toggle ${themeMode === "light" ? "on" : ""}`} onClick={() => setThemeMode(t => t === "dark" ? "light" : "dark")}>
                  <div className="toggle-knob" />
                </div>
              </div>

              <div className="setting-row">
                <div><div className="setting-label">Kích Thước Bảng</div><div className="setting-sub">Hiện tại: {gridSize}×{gridSize}</div></div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[3, 4, 5, 6].map(s => (
                    <button key={s} className={`sz-btn ${gridSize === s ? "on" : ""}`} style={{ width: 36, padding: "6px 0", fontSize: 11 }} onClick={() => setGridSize(s)}>{s}</button>
                  ))}
                </div>
              </div>

              <div className="setting-row">
                <div><div className="setting-label">Chế Độ Chơi</div><div className="setting-sub">{gameMode === "pvp" ? "Người vs Người" : "Người vs AI"}</div></div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className={`md-btn ${gameMode === "pvp" ? "on" : ""}`} style={{ padding: "6px 10px", fontSize: 11 }} onClick={() => setGameMode("pvp")}>PvP</button>
                  <button className={`md-btn ${gameMode === "ai" ? "on" : ""}`} style={{ padding: "6px 10px", fontSize: 11 }} onClick={() => setGameMode("ai")}>AI</button>
                </div>
              </div>

              <div style={{ margin: "20px 0 12px", fontFamily: "Orbitron, monospace", fontSize: 10, letterSpacing: 2, color: "var(--muted)", textTransform: "uppercase" }}>Chuyển Màn Hình</div>
              <div className="screens-list">
                {[
                  { id: "home", icon: "🏠", label: "Trang Chủ" },
                  { id: "game", icon: "🎮", label: "Ván Chơi" },
                  { id: "room", icon: "🚪", label: "Tạo / Vào Phòng" },
                  { id: "history", icon: "📋", label: "Lịch Sử On-Chain" },
                ].map(s => (
                  <button key={s.id} className="screen-link" onClick={() => { setSettingsOpen(false); if (s.id === "game") { startGame(); } else { setScreen(s.id); } }}>
                    <span className="icon">{s.icon}</span>{s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── END MODAL ── */}
        {modalState.open && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-icon">{modalState.icon}</div>
              <div className="modal-title">{modalState.title}</div>
              <div className="modal-sub">{modalState.sub}</div>
              <div className="modal-tx">{modalState.tx}</div>
              <div className="modal-btns">
                <button className="btn-ghost" onClick={() => { setModalState(p => ({ ...p, open: false })); setScreen("history"); }}>📋 Lịch Sử</button>
                <button className="btn-primary" onClick={() => { setModalState(p => ({ ...p, open: false })); startGame(); }}>▶ Chơi Lại</button>
              </div>
            </div>
          </div>
        )}

        {/* TOAST */}
        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}