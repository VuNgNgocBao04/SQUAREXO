# Architecture

## 1) Overview

SQUAREXO is organized as a pnpm monorepo workspace with four main packages:

- `frontend`: React app and gameplay UI
- `backend`: HTTP API, Socket.IO, and persistence
- `game-core`: shared Dots & Boxes engine
- `contracts`: Solidity contract for staking and settlement

The current design is hybrid:
- local mode: the frontend runs the game loop itself
- online mode: the backend keeps authoritative room state

## 2) Runtime Diagram

```text
Browser (React)
  ├─ REST (/api/auth, /api/history)
  └─ WebSocket (join_room, make_move, chat)
            ↓
Express + Socket.IO (backend)
  ├─ Auth/JWT
  ├─ RoomManager (reconnect + dedupe)
  ├─ MatchService (DB + ELO)
  └─ BlockchainService (submitResult)
            ↓
PostgreSQL (Prisma)      Oasis Sapphire (SquarexoMatch)
```

## 3) Frontend Details

The primary entry point is `packages/frontend/src/App.tsx`.

### State
- The app primarily uses `useState`, `useRef`, and `useCallback` inside a large component.
- There is a `store/gameStore.ts` file that uses Zustand, but it is not currently imported into the main app.

### Auth
- Login and registration call the backend through `src/services/auth.ts`.
- Tokens and user profile data are stored in `localStorage`.

### Wallet and Blockchain Calls
- When online play uses stakes, the frontend calls the contract directly:
  - create room -> `createMatch`
  - join room -> `joinMatch`
  - claim -> `claimReward`
- If `VITE_CONTRACT_ADDRESS` is missing, the frontend falls back to off-chain realtime mode.

### Realtime
- Connects `socket.io-client` to `VITE_BACKEND_URL`.
- Incoming events: `room_info`, `player_joined`, `game_state`, `chat_message`, and `match_settled`.

## 4) Backend Details

### HTTP
- `createApp()` mount routes:
  - public: `/health`, `/metrics`
  - auth: `/auth/*` và `/api/auth/*`
  - history: `/api/history`
  - protected: `/users`, `/matches`

### Auth
- `JwtTokenService` manages access and refresh tokens.
- Password hashing uses bcrypt.
- Wallet linking happens through `/api/auth/wallet`.

### Realtime engine
- `registerSocketHandlers()` handles room, join, move, chat, and sync events.
- `RoomManager` keeps socket-player mappings, pending reconnects, and action deduplication.
- When a game ends, the backend saves the match and attempts to submit the result on-chain.

### Persistence
- Prisma is used when `DATABASE_URL` is available.
- If there is no DB, many services fall back to in-memory mode for minimal operation.

## 5) Blockchain Contract

`SquarexoMatch.sol` manages the lifecycle of wagered matches:
- `createMatch`
- `joinMatch`
- `submitResult` (chỉ backend signer role)
- `claimReward`
- timeout paths (`cancelUnjoinedMatch`, `forceDrawOnTimeout`)

The backend only submits results; it does not claim rewards on behalf of users.

## 6) Data Model (Prisma)

- `User`: account, wallet, elo
- `Match`: match metadata, winner, tx hash
- `MatchMove`: ordered move details

ELO updates are handled when `saveResult` runs.

## 7) Existing CI/CD

The `.github/workflows/oasis.yml` workflow includes:
- install dependencies
- build backend/frontend
- compile + test contracts
- job deploy testnet thủ công (`workflow_dispatch`)

## 8) Technical Notes

1. There is currently a duplicate `saveMatchIfFinished` function in `socket/handler.ts` that affects build and test.
2. The frontend contains two files, `GameCanvas.tsx` and `gameCanvas.tsx`, that only differ by casing.
3. Contract compilation requires downloading solc from `binaries.soliditylang.org`; network-restricted environments will fail.
