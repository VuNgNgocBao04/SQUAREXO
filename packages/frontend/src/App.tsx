import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

type Screen = "home" | "game" | "history";
type GameMode = "pvp" | "ai";
type LineType = "h" | "v";
type ThemeMode = "dark" | "light";

type Line = {
  type: LineType;
  r: number;
  c: number;
};

type MoveRecord = {
  line: Line;
  player: number;
};

type HistoryRecord = {
  id: number;
  date: string;
  gridSize: number;
  mode: GameMode;
  scores: [number, number];
  winner: number;
  stake: number;
  tx: string;
  moves: number;
};

const DOT = 18;
const PAD = 32;
const SNAP = 20;

function createEmptyState(size: number) {
  return {
    hLines: Array.from({ length: size + 1 }, () => new Array(size).fill(0)),
    vLines: Array.from({ length: size }, () => new Array(size + 1).fill(0)),
    boxes: Array.from({ length: size }, () => new Array(size).fill(0)),
  };
}

function genTxHash() {
  return (
    "0x" +
    Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0"),
    ).join("")
  );
}

function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("dbTheme");
    return saved === "light" ? "light" : "dark";
  });

  const [screen, setScreen] = useState<Screen>("home");
  const [gridSize, setGridSize] = useState(3);
  const [gameMode, setGameMode] = useState<GameMode>("pvp");
  const [stakeEth, setStakeEth] = useState(1);

  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("Chưa kết nối");
  const [walletBalance, setWalletBalance] = useState("0.0000");

  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [totalMoves, setTotalMoves] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [blockNum, setBlockNum] = useState(4892341);
  const [hoveredLine, setHoveredLine] = useState<Line | null>(null);
  const [canvasSize, setCanvasSize] = useState(420);
  const [drawVersion, setDrawVersion] = useState(0);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const [gameHistory, setGameHistory] = useState<HistoryRecord[]>(() => {
    try {
      const raw = localStorage.getItem("dbChainHistory");
      return raw ? (JSON.parse(raw) as HistoryRecord[]) : [];
    } catch {
      return [];
    }
  });

  const [modalState, setModalState] = useState({
    open: false,
    icon: "🏆",
    title: "X THẮNG!",
    sub: "Kết quả đang được ghi lên blockchain...",
    tx: "Tx: 0x...",
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blockIntervalRef = useRef<number | null>(null);
  const aiTimeoutRef = useRef<number | null>(null);
  const chainTimeoutRef = useRef<number | null>(null);

  const hLinesRef = useRef<number[][]>([]);
  const vLinesRef = useRef<number[][]>([]);
  const boxesRef = useRef<number[][]>([]);
  const moveHistoryRef = useRef<MoveRecord[]>([]);

  const currentPlayerRef = useRef(1);
  const scoresRef = useRef<[number, number]>([0, 0]);
  const totalMovesRef = useRef(0);
  const gameActiveRef = useRef(false);
  const gridSizeRef = useRef(3);
  const gameModeRef = useRef<GameMode>("pvp");
  const stakeEthRef = useRef(1);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3000);
  }, []);

  const setCurrentPlayerSafe = useCallback((player: number) => {
    currentPlayerRef.current = player;
    setCurrentPlayer(player);
  }, []);

  const setScoresSafe = useCallback((nextScores: [number, number]) => {
    scoresRef.current = nextScores;
    setScores(nextScores);
  }, []);

  const setTotalMovesSafe = useCallback((moves: number) => {
    totalMovesRef.current = moves;
    setTotalMoves(moves);
  }, []);

  const clearTimers = useCallback(() => {
    if (blockIntervalRef.current) {
      window.clearInterval(blockIntervalRef.current);
      blockIntervalRef.current = null;
    }
    if (aiTimeoutRef.current) {
      window.clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
    }
    if (chainTimeoutRef.current) {
      window.clearTimeout(chainTimeoutRef.current);
      chainTimeoutRef.current = null;
    }
  }, []);

  const isGameOver = useCallback(() => {
    const [p1, p2] = scoresRef.current;
    return p1 + p2 === gridSizeRef.current * gridSizeRef.current;
  }, []);

  const getCellSize = useCallback(() => {
    return Math.floor((canvasSize - PAD * 2) / gridSizeRef.current);
  }, [canvasSize]);

  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cell = getCellSize();
    const size = canvasSize;
    const styles = getComputedStyle(document.documentElement);
    const canvasDot =
      styles.getPropertyValue("--canvas-dot").trim() || "#e0f0ff";
    const emptyLine =
      styles.getPropertyValue("--canvas-line-empty").trim() ||
      "rgba(255,255,255,0.1)";

    ctx.clearRect(0, 0, size, size);

    for (let r = 0; r < gridSizeRef.current; r++) {
      for (let c = 0; c < gridSizeRef.current; c++) {
        if (boxesRef.current[r][c]) {
          const x = PAD + c * cell;
          const y = PAD + r * cell;
          const p = boxesRef.current[r][c];
          ctx.fillStyle =
            p === 1 ? "rgba(0,245,255,0.12)" : "rgba(255,0,110,0.12)";
          ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);

          ctx.fillStyle =
            p === 1 ? "rgba(0,245,255,0.5)" : "rgba(255,0,110,0.5)";
          ctx.font = `bold ${Math.floor(cell * 0.3)}px Orbitron`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(p === 1 ? "X" : "O", x + cell / 2, y + cell / 2);
        }
      }
    }

    for (let r = 0; r <= gridSizeRef.current; r++) {
      for (let c = 0; c < gridSizeRef.current; c++) {
        const x1 = PAD + c * cell;
        const y1 = PAD + r * cell;
        const x2 = x1 + cell;
        const owned = hLinesRef.current[r][c];
        const isHover =
          hoveredLine &&
          hoveredLine.type === "h" &&
          hoveredLine.r === r &&
          hoveredLine.c === c;

        ctx.beginPath();
        ctx.moveTo(x1 + DOT / 2, y1);
        ctx.lineTo(x2 - DOT / 2, y1);
        ctx.lineWidth = owned ? 4 : isHover ? 3 : 2;
        ctx.strokeStyle = owned
          ? owned === 1
            ? "#00f5ff"
            : "#ff006e"
          : isHover
            ? currentPlayerRef.current === 1
              ? "rgba(0,245,255,0.7)"
              : "rgba(255,0,110,0.7)"
            : emptyLine;
        ctx.stroke();

        if (owned) {
          ctx.shadowColor = owned === 1 ? "#00f5ff" : "#ff006e";
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    }

    for (let r = 0; r < gridSizeRef.current; r++) {
      for (let c = 0; c <= gridSizeRef.current; c++) {
        const x1 = PAD + c * cell;
        const y1 = PAD + r * cell;
        const y2 = y1 + cell;
        const owned = vLinesRef.current[r][c];
        const isHover =
          hoveredLine &&
          hoveredLine.type === "v" &&
          hoveredLine.r === r &&
          hoveredLine.c === c;

        ctx.beginPath();
        ctx.moveTo(x1, y1 + DOT / 2);
        ctx.lineTo(x1, y2 - DOT / 2);
        ctx.lineWidth = owned ? 4 : isHover ? 3 : 2;
        ctx.strokeStyle = owned
          ? owned === 1
            ? "#00f5ff"
            : "#ff006e"
          : isHover
            ? currentPlayerRef.current === 1
              ? "rgba(0,245,255,0.7)"
              : "rgba(255,0,110,0.7)"
            : emptyLine;
        ctx.stroke();

        if (owned) {
          ctx.shadowColor = owned === 1 ? "#00f5ff" : "#ff006e";
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    }

    for (let r = 0; r <= gridSizeRef.current; r++) {
      for (let c = 0; c <= gridSizeRef.current; c++) {
        const x = PAD + c * cell;
        const y = PAD + r * cell;
        ctx.beginPath();
        ctx.arc(x, y, DOT / 2, 0, Math.PI * 2);
        ctx.fillStyle = canvasDot;
        ctx.fill();
        ctx.shadowColor = "rgba(0,245,255,0.6)";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }, [canvasSize, getCellSize, hoveredLine, themeMode]);

  const resizeCanvas = useCallback(() => {
    const maxW = Math.min(window.innerWidth - 120, 560);
    const cell = Math.floor((maxW - PAD * 2) / gridSizeRef.current);
    const size = cell * gridSizeRef.current + PAD * 2;
    setCanvasSize(size);
  }, []);

  const countEdgesBox = useCallback((r: number, c: number) => {
    return (
      (hLinesRef.current[r][c] ? 1 : 0) +
      (hLinesRef.current[r + 1][c] ? 1 : 0) +
      (vLinesRef.current[r][c] ? 1 : 0) +
      (vLinesRef.current[r][c + 1] ? 1 : 0)
    );
  }, []);

  const checkBoxes = useCallback(
    (player: number) => {
      let captured = false;
      const nextScores: [number, number] = [...scoresRef.current] as [
        number,
        number,
      ];

      for (let r = 0; r < gridSizeRef.current; r++) {
        for (let c = 0; c < gridSizeRef.current; c++) {
          if (boxesRef.current[r][c]) continue;
          if (
            hLinesRef.current[r][c] &&
            hLinesRef.current[r + 1][c] &&
            vLinesRef.current[r][c] &&
            vLinesRef.current[r][c + 1]
          ) {
            boxesRef.current[r][c] = player;
            nextScores[player - 1] += 1;
            captured = true;
          }
        }
      }

      setScoresSafe(nextScores);
      return captured;
    },
    [setScoresSafe],
  );

  const getLineFromPos = useCallback(
    (mx: number, my: number): Line | null => {
      const cell = getCellSize();

      for (let r = 0; r <= gridSizeRef.current; r++) {
        for (let c = 0; c < gridSizeRef.current; c++) {
          const y = PAD + r * cell;
          if (
            Math.abs(my - y) < SNAP &&
            mx > PAD + c * cell + DOT &&
            mx < PAD + (c + 1) * cell - DOT
          ) {
            return { type: "h", r, c };
          }
        }
      }

      for (let r = 0; r < gridSizeRef.current; r++) {
        for (let c = 0; c <= gridSizeRef.current; c++) {
          const x = PAD + c * cell;
          if (
            Math.abs(mx - x) < SNAP &&
            my > PAD + r * cell + DOT &&
            my < PAD + (r + 1) * cell - DOT
          ) {
            return { type: "v", r, c };
          }
        }
      }

      return null;
    },
    [getCellSize],
  );

  const startBlockTicker = useCallback(() => {
    if (blockIntervalRef.current) {
      window.clearInterval(blockIntervalRef.current);
    }
    const startBlock = 4892341 + Math.floor(Math.random() * 1000);
    setBlockNum(startBlock);
    blockIntervalRef.current = window.setInterval(() => {
      setBlockNum((prev) => prev + 1);
    }, 12000);
  }, []);

  const saveHistory = useCallback((record: HistoryRecord) => {
    setGameHistory((prev) => {
      const next = [record, ...prev].slice(0, 50);
      localStorage.setItem("dbChainHistory", JSON.stringify(next));
      return next;
    });
  }, []);

  const spawnConfetti = useCallback(() => {
    const colors = ["#00f5ff", "#ff006e", "#7b2fff", "#ffd60a", "#ffffff"];
    for (let i = 0; i < 60; i++) {
      const el = document.createElement("div");
      el.className = "confetti-piece";
      el.style.left = `${Math.random() * 100}vw`;
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
      el.style.animationDuration = `${2 + Math.random() * 2}s`;
      el.style.animationDelay = `${Math.random() * 0.5}s`;
      el.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(el);
      window.setTimeout(() => {
        el.remove();
      }, 4000);
    }
  }, []);

  const endGame = useCallback(() => {
    gameActiveRef.current = false;
    setGameActive(false);
    if (blockIntervalRef.current) {
      window.clearInterval(blockIntervalRef.current);
      blockIntervalRef.current = null;
    }

    const [p1, p2] = scoresRef.current;
    let winner = 0;
    let icon = "🤝";
    let title = "HÒA!";
    let sub = "Cả hai đều xuất sắc! Đang ghi kết quả lên blockchain...";

    if (p1 > p2) {
      winner = 1;
      icon = "🏆";
      title = "X THẮNG!";
      sub = `Tỉ số ${p1} - ${p2}. Đang ghi kết quả lên blockchain...`;
    } else if (p2 > p1) {
      winner = 2;
      icon = gameModeRef.current === "ai" ? "🤖" : "🏆";
      title = `${gameModeRef.current === "ai" ? "AI (O)" : "O"} THẮNG!`;
      sub = `Tỉ số ${p2} - ${p1}. Đang ghi kết quả lên blockchain...`;
    }

    if (winner === 1 || winner === 0) {
      spawnConfetti();
    }

    setModalState({
      open: true,
      icon,
      title,
      sub,
      tx: "Tx: Đang xử lý...",
    });

    const delay = 1500 + Math.random() * 1000;
    chainTimeoutRef.current = window.setTimeout(() => {
      const tx = genTxHash();
      setModalState((prev) => ({
        ...prev,
        sub: `Kết quả đã được ghi on-chain thành công! ${stakeEthRef.current > 0 ? `Stake ${stakeEthRef.current.toFixed(3)} ROSE đã được chuyển.` : ""}`,
        tx: `Tx: ${tx}`,
      }));

      saveHistory({
        id: Date.now(),
        date: new Date().toLocaleString("vi-VN"),
        gridSize: gridSizeRef.current,
        mode: gameModeRef.current,
        scores: [scoresRef.current[0], scoresRef.current[1]],
        winner,
        stake: stakeEthRef.current,
        tx,
        moves: totalMovesRef.current,
      });
    }, delay);
  }, [saveHistory, spawnConfetti]);

  const applyMove = useCallback(
    (line: Line) => {
      if (!gameActiveRef.current) return;

      const player = currentPlayerRef.current;
      if (line.type === "h") {
        hLinesRef.current[line.r][line.c] = player;
      } else {
        vLinesRef.current[line.r][line.c] = player;
      }

      moveHistoryRef.current.push({ line, player });
      setTotalMovesSafe(totalMovesRef.current + 1);

      const captured = checkBoxes(player);
      setDrawVersion((v) => v + 1);

      if (isGameOver()) {
        window.setTimeout(endGame, 250);
        return;
      }

      if (!captured) {
        const nextPlayer = player === 1 ? 2 : 1;
        setCurrentPlayerSafe(nextPlayer);
      }

      if (
        gameModeRef.current === "ai" &&
        currentPlayerRef.current === 2 &&
        gameActiveRef.current
      ) {
        aiTimeoutRef.current = window.setTimeout(
          () => {
            aiMove();
          },
          500 + Math.random() * 400,
        );
      }
    },
    [checkBoxes, endGame, isGameOver, setCurrentPlayerSafe, setTotalMovesSafe],
  );

  const getAllFreeLines = useCallback(() => {
    const lines: Line[] = [];
    for (let r = 0; r <= gridSizeRef.current; r++) {
      for (let c = 0; c < gridSizeRef.current; c++) {
        if (!hLinesRef.current[r][c]) lines.push({ type: "h", r, c });
      }
    }
    for (let r = 0; r < gridSizeRef.current; r++) {
      for (let c = 0; c <= gridSizeRef.current; c++) {
        if (!vLinesRef.current[r][c]) lines.push({ type: "v", r, c });
      }
    }
    return lines;
  }, []);

  const lineCompletesBox = useCallback(
    (line: Line) => {
      if (line.type === "h") {
        if (line.r > 0 && countEdgesBox(line.r - 1, line.c) === 3) return true;
        if (line.r < gridSizeRef.current && countEdgesBox(line.r, line.c) === 3)
          return true;
      } else {
        if (line.c > 0 && countEdgesBox(line.r, line.c - 1) === 3) return true;
        if (line.c < gridSizeRef.current && countEdgesBox(line.r, line.c) === 3)
          return true;
      }
      return false;
    },
    [countEdgesBox],
  );

  const lineGivesOpponent = useCallback(
    (line: Line) => {
      if (line.type === "h") {
        if (line.r > 0 && countEdgesBox(line.r - 1, line.c) === 2) return true;
        if (line.r < gridSizeRef.current && countEdgesBox(line.r, line.c) === 2)
          return true;
      } else {
        if (line.c > 0 && countEdgesBox(line.r, line.c - 1) === 2) return true;
        if (line.c < gridSizeRef.current && countEdgesBox(line.r, line.c) === 2)
          return true;
      }
      return false;
    },
    [countEdgesBox],
  );

  const aiMove = useCallback(() => {
    if (!gameActiveRef.current || currentPlayerRef.current !== 2) return;

    const all = getAllFreeLines();
    const completing = all.find((line) => lineCompletesBox(line));
    const safe = all.find((line) => !lineGivesOpponent(line));
    const random = all.length
      ? all[Math.floor(Math.random() * all.length)]
      : null;
    const move = completing ?? safe ?? random;
    if (move) {
      applyMove(move);
    }
  }, [applyMove, getAllFreeLines, lineCompletesBox, lineGivesOpponent]);

  const rebuildFromHistory = useCallback(
    (moves: MoveRecord[]) => {
      const empty = createEmptyState(gridSizeRef.current);
      const nextScores: [number, number] = [0, 0];

      for (const move of moves) {
        if (move.line.type === "h") {
          empty.hLines[move.line.r][move.line.c] = move.player;
        } else {
          empty.vLines[move.line.r][move.line.c] = move.player;
        }

        for (let r = 0; r < gridSizeRef.current; r++) {
          for (let c = 0; c < gridSizeRef.current; c++) {
            if (empty.boxes[r][c]) continue;
            if (
              empty.hLines[r][c] &&
              empty.hLines[r + 1][c] &&
              empty.vLines[r][c] &&
              empty.vLines[r][c + 1]
            ) {
              empty.boxes[r][c] = move.player;
              nextScores[move.player - 1] += 1;
            }
          }
        }
      }

      hLinesRef.current = empty.hLines;
      vLinesRef.current = empty.vLines;
      boxesRef.current = empty.boxes;
      setScoresSafe(nextScores);
    },
    [setScoresSafe],
  );

  const undoMove = useCallback(() => {
    if (!moveHistoryRef.current.length) {
      showToast("Không có nước để hoàn tác!");
      return;
    }

    const last = moveHistoryRef.current.pop();
    if (!last) return;

    rebuildFromHistory(moveHistoryRef.current);
    setCurrentPlayerSafe(last.player);
    setTotalMovesSafe(moveHistoryRef.current.length);
    setDrawVersion((v) => v + 1);
  }, [rebuildFromHistory, setCurrentPlayerSafe, setTotalMovesSafe, showToast]);

  const startGame = useCallback(() => {
    const empty = createEmptyState(gridSize);
    hLinesRef.current = empty.hLines;
    vLinesRef.current = empty.vLines;
    boxesRef.current = empty.boxes;
    moveHistoryRef.current = [];

    setScoresSafe([0, 0]);
    setCurrentPlayerSafe(1);
    setTotalMovesSafe(0);
    gameActiveRef.current = true;
    setGameActive(true);
    setHoveredLine(null);
    setScreen("game");

    startBlockTicker();
    setDrawVersion((v) => v + 1);

    if (gameMode === "ai") {
      aiTimeoutRef.current = window.setTimeout(() => {
        if (currentPlayerRef.current === 2) {
          aiMove();
        }
      }, 700);
    }
  }, [
    aiMove,
    gameMode,
    gridSize,
    setCurrentPlayerSafe,
    setScoresSafe,
    setTotalMovesSafe,
    startBlockTicker,
  ]);

  const goHome = useCallback(() => {
    if (
      gameActiveRef.current &&
      !window.confirm("Bạn có chắc muốn thoát ván chơi?")
    ) {
      return;
    }
    gameActiveRef.current = false;
    setGameActive(false);
    clearTimers();
    setScreen("home");
  }, [clearTimers]);

  const showHistory = useCallback(() => {
    setScreen("history");
  }, []);

  const connectWallet = useCallback(async () => {
    const { ethereum } = window as any;
    if (!ethereum) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }

    try {
      // 1. Yêu cầu kết nối tài khoản (Bật popup MetaMask)
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      const account = accounts[0];

      // 2. Định nghĩa thông số mạng Oasis Sapphire Testnet
      const OASIS_CHAIN_ID = "0x5aff"; // 23295
      const chainId = await ethereum.request({ method: "eth_chainId" });

      // 3. Nếu sai mạng, yêu cầu MetaMask tự chuyển mạng
      if (chainId !== OASIS_CHAIN_ID) {
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: OASIS_CHAIN_ID }],
          });
        } catch (switchError: any) {
          // Nếu mạng chưa được thêm vào ví (Lỗi 4902)
          if (switchError.code === 4902) {
            await ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: OASIS_CHAIN_ID,
                  chainName: "Oasis Sapphire Testnet",
                  nativeCurrency: {
                    name: "ROSE",
                    symbol: "ROSE",
                    decimals: 18,
                  },
                  rpcUrls: ["https://testnet.sapphire.oasis.io"],
                  blockExplorerUrls: [
                    "https://testnet.explorer.sapphire.oasis.io",
                  ],
                },
              ],
            });
          } else {
            throw switchError;
          }
        }
      }

      // 4. Lấy số dư thật sau khi đã đúng mạng
      const balanceHex = await ethereum.request({
        method: "eth_getBalance",
        params: [account, "latest"],
      });
      const balance = Number(BigInt(balanceHex)) / 10 ** 18;

      // 5. Cập nhật State
      setWalletAddress(account.slice(0, 6) + "..." + account.slice(-4));
      setWalletBalance(balance.toFixed(4));
      setWalletConnected(true);
      showToast("Kết nối thành công!");
    } catch (error: any) {
      if (error.code === 4001) {
        showToast("Bạn đã hủy yêu cầu kết nối.");
      } else {
        console.error(error);
        showToast("Lỗi: " + error.message);
      }
    }
  }, [showToast]);

  const confirmForfeit = useCallback(() => {
    if (!window.confirm("Xác nhận bỏ cuộc? Đối thủ sẽ thắng.")) return;

    gameActiveRef.current = false;
    setGameActive(false);
    if (blockIntervalRef.current) {
      window.clearInterval(blockIntervalRef.current);
      blockIntervalRef.current = null;
    }

    const winner = currentPlayerRef.current === 1 ? 2 : 1;
    const full = gridSizeRef.current * gridSizeRef.current;
    const nextScores: [number, number] = winner === 1 ? [full, 0] : [0, full];
    setScoresSafe(nextScores);
    setCurrentPlayerSafe(winner);
    setDrawVersion((v) => v + 1);
    endGame();
  }, [endGame, setCurrentPlayerSafe, setScoresSafe]);

  const playAgain = useCallback(() => {
    setModalState((prev) => ({ ...prev, open: false }));
    startGame();
  }, [startGame]);

  const onCanvasMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!gameActiveRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (event.clientX - rect.left) * scaleX;
      const my = (event.clientY - rect.top) * scaleY;

      const line = getLineFromPos(mx, my);
      const taken =
        line &&
        (line.type === "h"
          ? hLinesRef.current[line.r][line.c]
          : vLinesRef.current[line.r][line.c]);
      setHoveredLine(line && !taken ? line : null);
    },
    [getLineFromPos],
  );

  const onCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!gameActiveRef.current) return;
      if (gameModeRef.current === "ai" && currentPlayerRef.current === 2)
        return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (event.clientX - rect.left) * scaleX;
      const my = (event.clientY - rect.top) * scaleY;

      const line = getLineFromPos(mx, my);
      if (!line) return;

      const taken =
        line.type === "h"
          ? hLinesRef.current[line.r][line.c]
          : vLinesRef.current[line.r][line.c];
      if (taken) return;

      applyMove(line);
    },
    [applyMove, getLineFromPos],
  );

  const totalEth = useMemo(() => {
    return gameHistory.reduce((sum, game) => sum + (game.stake || 0), 0);
  }, [gameHistory]);

  const p1Wins = useMemo(() => {
    return gameHistory.filter((game) => game.winner === 1).length;
  }, [gameHistory]);

  const winRate = useMemo(() => {
    if (!gameHistory.length) return 0;
    return Math.round((p1Wins / gameHistory.length) * 100);
  }, [gameHistory, p1Wins]);

  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  useEffect(() => {
    gridSizeRef.current = gridSize;
    resizeCanvas();
    setDrawVersion((v) => v + 1);
  }, [gridSize, resizeCanvas]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  useEffect(() => {
    stakeEthRef.current = stakeEth;
  }, [stakeEth]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    localStorage.setItem("dbTheme", themeMode);
    setDrawVersion((v) => v + 1);
  }, [themeMode]);

  useEffect(() => {
    if (screen !== "game") return;
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [resizeCanvas, screen]);

  useEffect(() => {
    drawBoard();
  }, [canvasSize, currentPlayer, drawBoard, drawVersion, hoveredLine, screen]);

  useEffect(() => {
    return () => {
      clearTimers();
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [clearTimers]);

  return (
    <div className="db-app">
      <div className="bg-grid" />
      <div className="bg-orbs">
        <div className="orb orb1" />
        <div className="orb orb2" />
        <div className="orb orb3" />
      </div>

      {screen !== "home" && (
        <nav className="nav-bar">
          <div className="nav-logo">D&amp;B // CHAIN</div>
          <div className="nav-links">
            <button className="btn-ghost" onClick={toggleTheme}>
              {themeMode === "dark" ? "☀ Sáng" : "🌙 Tối"}
            </button>
            <button className="btn-ghost" onClick={goHome}>
              Home
            </button>
            <button className="btn-ghost" onClick={showHistory}>
              Lịch Sử
            </button>
          </div>
        </nav>
      )}

      <div className="wrap">
        {screen === "home" && (
          <section className="screen active" id="homeScreen">
            <div className="logo-wrap">
              <div className="logo-title">DOTS &amp; BOXES</div>
              <div className="logo-sub">Blockchain Edition // Testnet</div>
            </div>

            <div className="wallet-card">
              <div className="wallet-label">⬡ Ví Blockchain</div>
              <div className="wallet-status">
                <div
                  className={`wallet-dot ${walletConnected ? "connected" : ""}`}
                />
                <div className="wallet-addr">{walletAddress}</div>
                <button
                  className="btn-ghost connect-btn"
                  onClick={connectWallet}
                  disabled={walletConnected}
                >
                  {walletConnected ? "✓ Đã kết nối" : "Kết Nối"}
                </button>
              </div>
              {walletConnected && (
                <div className="wallet-balance">
                  Số dư: <span className="balance-val">{walletBalance}</span>{" "}
                  ROSE &nbsp;·&nbsp; Ví:{" "}
                  <span className="network-val">oasis</span>
                </div>
              )}
            </div>

            <div className="config-card">
              <div className="config-title">⬡ Cấu Hình Ván Chơi</div>

              <div className="config-row">
                <label>Kích Thước Bảng</label>
                <div className="size-btns">
                  {[3, 4, 5, 6].map((size) => (
                    <button
                      key={size}
                      className={`size-btn ${gridSize === size ? "active" : ""}`}
                      onClick={() => setGridSize(size)}
                    >
                      {size}×{size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="config-row">
                <label>Stake (ROSE)</label>
                <div className="stake-input-wrap">
                  <input
                    className="stake-input"
                    type="number"
                    min="0"
                    step="0.001"
                    value={stakeEth}
                    onChange={(e) => {
                      const value = Number.parseFloat(e.target.value);
                      setStakeEth(Number.isFinite(value) ? value : 0);
                    }}
                  />
                  <span className="stake-unit">ROSE</span>
                </div>
              </div>

              <div className="config-row">
                <label>Chế Độ Chơi</label>
                <div className="mode-btns">
                  <button
                    className={`mode-btn ${gameMode === "pvp" ? "active" : ""}`}
                    onClick={() => setGameMode("pvp")}
                  >
                    👥 PvP Local
                  </button>
                  <button
                    className={`mode-btn ${gameMode === "ai" ? "active" : ""}`}
                    onClick={() => setGameMode("ai")}
                  >
                    🤖 vs AI
                  </button>
                </div>
              </div>

              <div className="config-row">
                <label>Chế Độ Nền</label>
                <div className="mode-btns">
                  <button
                    className={`mode-btn ${themeMode === "light" ? "active" : ""}`}
                    onClick={() => setThemeMode("light")}
                  >
                    ☀ Sáng
                  </button>
                  <button
                    className={`mode-btn ${themeMode === "dark" ? "active" : ""}`}
                    onClick={() => setThemeMode("dark")}
                  >
                    🌙 Tối
                  </button>
                </div>
              </div>
            </div>

            <button className="btn-primary" onClick={startGame}>
              ⚡ BẮT ĐẦU VÁN CHƠI
            </button>

            <button className="btn-ghost history-btn" onClick={showHistory}>
              📋 Xem Lịch Sử On-chain
            </button>
          </section>
        )}

        {screen === "game" && (
          <section className="screen active game-screen" id="gameScreen">
            <div className="scoreboard">
              <div
                className={`player-card ${currentPlayer === 1 ? "active" : ""}`}
                id="p1Card"
              >
                <div className="player-name">
                  NGƯỜI CHƠI <span className="player-color">X</span>
                </div>
                <div className="player-score score-p1">{scores[0]}</div>
                <div className="player-boxes">{scores[0]} ô</div>
              </div>
              <div className="vs-badge">VS</div>
              <div
                className={`player-card p2 ${currentPlayer === 2 ? "active" : ""}`}
                id="p2Card"
              >
                <div className="player-name">
                  {gameMode === "ai" ? "AI" : "NGƯỜI CHƠI"}{" "}
                  <span className="player-color player-p2">O</span>
                </div>
                <div className="player-score score-p2">{scores[1]}</div>
                <div className="player-boxes">{scores[1]} ô</div>
              </div>
            </div>

            <div className="chain-ticker">
              <div className="ticker-item">
                <span className="ticker-label">Block</span>
                <span className="ticker-val green">
                  #{blockNum.toLocaleString()}
                </span>
              </div>
              <span className="ticker-sep">|</span>
              <div className="ticker-item">
                <span className="ticker-label">Stake</span>
                <span className="ticker-val gold">
                  {stakeEth.toFixed(3)} ROSE
                </span>
              </div>
              <span className="ticker-sep">|</span>
              <div className="ticker-item">
                <span className="ticker-label">Gas</span>
                <span className="ticker-val pink">12 gwei</span>
              </div>
              <span className="ticker-sep">|</span>
              <div className="ticker-item">
                <span className="ticker-label">Moves</span>
                <span className="ticker-val green">{totalMoves}</span>
              </div>
              <span className="ticker-sep">|</span>
              <div className="ticker-item">
                <span className="ticker-label">Contract</span>
                <span className="ticker-val contract">0x4a2f...c3e1</span>
              </div>
            </div>

            <div className="turn-pill">
              Lượt:{" "}
              <span
                style={{
                  color: currentPlayer === 1 ? "var(--p1)" : "var(--p2)",
                }}
              >
                {currentPlayer === 1
                  ? "X"
                  : gameMode === "ai"
                    ? "AI (O) 🤖"
                    : "O"}
              </span>
            </div>

            <div className="board-wrap">
              <canvas
                id="gameBoard"
                ref={canvasRef}
                width={canvasSize}
                height={canvasSize}
                style={{
                  width: `${canvasSize}px`,
                  height: `${canvasSize}px`,
                  cursor: hoveredLine ? "pointer" : "default",
                }}
                onMouseMove={onCanvasMouseMove}
                onMouseLeave={() => setHoveredLine(null)}
                onClick={onCanvasClick}
              />
            </div>

            <div className="game-actions">
              <button className="btn-ghost" onClick={goHome}>
                ← Thoát
              </button>
              <button
                className="btn-ghost"
                onClick={undoMove}
                disabled={!gameActive}
              >
                ↩ Hoàn Tác
              </button>
              <button
                className="btn-primary forfeit-btn"
                onClick={confirmForfeit}
                disabled={!gameActive}
              >
                Bỏ Cuộc
              </button>
            </div>
          </section>
        )}

        {screen === "history" && (
          <section className="screen active history-screen" id="historyScreen">
            <div className="history-header">
              <div>
                <div className="history-title">⬡ Lịch Sử On-Chain</div>
                <div className="history-subtitle">
                  Sepolia Testnet · Smart Contract 0x4a2f...c3e1
                </div>
              </div>
              <button className="btn-ghost" onClick={goHome}>
                ← Quay Lại
              </button>
            </div>

            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-val c1">{gameHistory.length}</div>
                <div className="stat-lbl">Ván Đã Chơi</div>
              </div>
              <div className="stat-card">
                <div className="stat-val c3">{totalEth.toFixed(3)}</div>
                <div className="stat-lbl">Tổng ROSE</div>
              </div>
              <div className="stat-card">
                <div className="stat-val c2">
                  {gameHistory.length ? `${winRate}%` : "—"}
                </div>
                <div className="stat-lbl">Win Rate X</div>
              </div>
            </div>

            <div className="history-list">
              {!gameHistory.length && (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div>Chưa có ván nào được ghi on-chain</div>
                </div>
              )}

              {gameHistory.map((game, idx) => {
                const badgeClass =
                  game.winner === 0 ? "draw" : game.winner === 1 ? "p1" : "p2";
                const badgeText =
                  game.winner === 0
                    ? "HÒA"
                    : game.winner === 1
                      ? "X THẮNG"
                      : `${game.mode === "ai" ? "AI (O)" : "O"} THẮNG`;

                return (
                  <div className="history-item" key={game.id}>
                    <div className="h-num">#{gameHistory.length - idx}</div>
                    <div className="h-info">
                      <div className="h-players">
                        X vs {game.mode === "ai" ? "AI (O) 🤖" : "O"} ·{" "}
                        {game.gridSize}×{game.gridSize}
                      </div>
                      <div className="h-meta">
                        {game.date} · {game.moves} nước đi
                      </div>
                    </div>
                    <div className="h-result">
                      <span className={`win-badge ${badgeClass}`}>
                        {badgeText}
                      </span>
                      <div className="h-score">
                        {game.scores[0]} - {game.scores[1]}
                      </div>
                    </div>
                    <div className="h-tx">
                      <div className="h-tx-hash">
                        {game.tx.slice(0, 10)}...{game.tx.slice(-6)}
                      </div>
                      <div className="h-amount">
                        {game.stake > 0
                          ? `${game.stake.toFixed(3)} ROSE`
                          : "Free"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {modalState.open && (
        <div className="modal-overlay active">
          <div className="modal">
            <div className="modal-icon">{modalState.icon}</div>
            <div className="modal-title">{modalState.title}</div>
            <div className="modal-sub">{modalState.sub}</div>
            <div className="modal-tx">{modalState.tx}</div>
            <div className="modal-btns">
              <button className="btn-ghost" onClick={showHistory}>
                📋 Lịch Sử
              </button>
              <button className="btn-primary" onClick={playAgain}>
                ▶ Chơi Lại
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
