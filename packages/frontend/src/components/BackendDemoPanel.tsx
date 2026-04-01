import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type Player = 'X' | 'O';

type RoomInfoPayload = {
  roomId: string;
  assignedPlayer: Player | null;
  isFull: boolean;
  boardSize: { rows: number; cols: number };
};

type GameStatePayload = {
  roomId: string;
  currentPlayer: Player;
};

type ErrorPayload = {
  message: string;
  code?: string;
};

type LogLine = {
  id: number;
  text: string;
};

const DEFAULT_BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL && typeof import.meta.env.VITE_BACKEND_URL === 'string'
    ? import.meta.env.VITE_BACKEND_URL
    : 'http://localhost:3000';

function trimLogs(lines: LogLine[]): LogLine[] {
  return lines.slice(-8);
}

export default function BackendDemoPanel() {
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [roomId, setRoomId] = useState('demo_room_1');
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  const [connected, setConnected] = useState(false);
  const [assignedPlayer, setAssignedPlayer] = useState<Player | null>(null);
  const [currentTurn, setCurrentTurn] = useState<Player | null>(null);
  const [lastError, setLastError] = useState('');
  const [logs, setLogs] = useState<LogLine[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const idRef = useRef(0);

  const addLog = useCallback((text: string) => {
    idRef.current += 1;
    setLogs((prev) => trimLogs([...prev, { id: idRef.current, text }]));
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    const socket = io(backendUrl, {
      transports: ['websocket'],
      timeout: 5000,
    });

    socket.on('connect', () => {
      setConnected(true);
      addLog(`Connected: ${socket.id}`);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setAssignedPlayer(null);
      setCurrentTurn(null);
      addLog('Disconnected');
    });

    socket.on('room_info', (payload: RoomInfoPayload) => {
      setAssignedPlayer(payload.assignedPlayer);
      addLog(
        `Room ${payload.roomId}: player=${payload.assignedPlayer ?? 'spectator'}, size=${payload.boardSize.rows}x${payload.boardSize.cols}, full=${payload.isFull}`,
      );
    });

    socket.on('game_state', (payload: GameStatePayload) => {
      setCurrentTurn(payload.currentPlayer);
      addLog(`Game state @${payload.roomId}: current=${payload.currentPlayer}`);
    });

    socket.on('error', (payload: ErrorPayload) => {
      const next = `[${payload.code ?? 'UNKNOWN'}] ${payload.message}`;
      setLastError(next);
      addLog(`Error: ${next}`);
    });

    socketRef.current = socket;
  }, [addLog, backendUrl]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  const joinRoom = useCallback(() => {
    if (!socketRef.current) {
      addLog('Cannot join: socket not connected');
      return;
    }

    socketRef.current.emit('join_room', {
      roomId,
      rows,
      cols,
    });
  }, [addLog, cols, roomId, rows]);

  const sendInvalidJoin = useCallback(() => {
    if (!socketRef.current) {
      addLog('Cannot send invalid join: socket not connected');
      return;
    }

    socketRef.current.emit('join_room', {
      roomId: '***',
      rows: 999,
      cols: 999,
    });
  }, [addLog]);

  const sendMalformedMove = useCallback(() => {
    if (!socketRef.current) {
      addLog('Cannot send malformed move: socket not connected');
      return;
    }

    socketRef.current.emit('make_move', {
      roomId,
      edge: { from: { row: 0 }, to: { row: 0, col: 1 } },
    });
  }, [addLog, roomId]);

  const resetGame = useCallback(() => {
    if (!socketRef.current) {
      addLog('Cannot reset: socket not connected');
      return;
    }

    socketRef.current.emit('reset_game', { roomId });
  }, [addLog, roomId]);

  const emitResetWithoutJoin = useCallback(() => {
    if (!socketRef.current) {
      addLog('Cannot test reset permission: socket not connected');
      return;
    }

    socketRef.current.emit('reset_game', { roomId: 'room_not_joined' });
  }, [addLog]);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const connectionLabel = useMemo(() => (connected ? 'Online' : 'Offline'), [connected]);

  return (
    <section className="backend-demo-card">
      <div className="backend-demo-title">Socket Backend Demo</div>
      <div className="backend-demo-subtitle">Test nhanh validation + permission của backend</div>

      <div className="backend-grid">
        <label className="backend-field">
          Backend URL
          <input value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} />
        </label>

        <label className="backend-field">
          Room ID
          <input value={roomId} onChange={(event) => setRoomId(event.target.value)} />
        </label>

        <label className="backend-field">
          Rows
          <input
            type="number"
            min={2}
            max={12}
            value={rows}
            onChange={(event) => setRows(Number.parseInt(event.target.value || '3', 10))}
          />
        </label>

        <label className="backend-field">
          Cols
          <input
            type="number"
            min={2}
            max={12}
            value={cols}
            onChange={(event) => setCols(Number.parseInt(event.target.value || '3', 10))}
          />
        </label>
      </div>

      <div className="backend-status-row">
        <span className={`backend-dot ${connected ? 'on' : ''}`} />
        <span>
          {connectionLabel} · Assigned: {assignedPlayer ?? 'none'} · Turn: {currentTurn ?? 'unknown'}
        </span>
      </div>

      <div className="backend-actions">
        <button className="btn-ghost" onClick={connect} disabled={connected}>
          Connect
        </button>
        <button className="btn-ghost" onClick={disconnect}>
          Disconnect
        </button>
        <button className="btn-primary" onClick={joinRoom}>
          Join Room
        </button>
        <button className="btn-ghost" onClick={sendInvalidJoin}>
          Invalid Join
        </button>
        <button className="btn-ghost" onClick={sendMalformedMove}>
          Malformed Move
        </button>
        <button className="btn-ghost" onClick={emitResetWithoutJoin}>
          Reset (No Room)
        </button>
        <button className="btn-primary" onClick={resetGame}>
          Reset Joined Room
        </button>
      </div>

      {lastError && <div className="backend-last-error">Last error: {lastError}</div>}

      <div className="backend-log-box">
        {logs.length === 0 && <div className="backend-log-line muted">No events yet</div>}
        {logs.map((line) => (
          <div className="backend-log-line" key={line.id}>
            {line.text}
          </div>
        ))}
      </div>
    </section>
  );
}
