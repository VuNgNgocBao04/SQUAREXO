import express, { Express } from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import { registerSocketHandlers } from "./socket/handler";

const app: Express = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "SQUAREXO Backend Server",
    timestamp: new Date(),
  });
});

// Register Socket.IO handlers
registerSocketHandlers(io);

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready for connections`);
});