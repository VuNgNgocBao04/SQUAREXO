import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import {
  GameState,
  createGame,
  applyMove,
  Edge,
} from "@squarexo/game-core";

const PORT = Number(process.env.PORT) || 3001;

// ─── Express ─────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const httpServer = createServer(app);

// ─── Socket.IO ───────────────────────────────────────────────────────────

const io = new Server(httpServer, {
  cors: { origin: "*" },
});

/** In-memory room store (sufficient for MVP – no Redis needed) */
const rooms = new Map<string, GameState>();

io.on("connection", (socket: Socket) => {
  console.log(`[connect] ${socket.id}`);

  /** Create or join a room */
  socket.on("join_room", (roomId: string) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, createGame(5, 5));
      console.log(`[room] created ${roomId}`);
    }

    // Send current state to the joining client
    socket.emit("game_state", rooms.get(roomId)!);
  });

  /** Receive a move from a client */
  socket.on("make_move", ({ roomId, edge }: { roomId: string; edge: Edge }) => {
    const state = rooms.get(roomId);
    if (!state) {
      socket.emit("error", { message: `Room ${roomId} not found.` });
      return;
    }

    try {
      const next = applyMove(state, edge);
      rooms.set(roomId, next);
      // Broadcast updated state to everyone in the room
      io.to(roomId).emit("game_state", next);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid move";
      socket.emit("error", { message });
    }
  });

  /** Reset the game in a room */
  socket.on("reset_game", (roomId: string) => {
    const fresh = createGame(5, 5);
    rooms.set(roomId, fresh);
    io.to(roomId).emit("game_state", fresh);
  });

  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);
  });
});

// ─── Start ───────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`SquareXO backend listening on http://localhost:${PORT}`);
});
