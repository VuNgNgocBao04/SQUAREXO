# Architecture

## 1) Tổng quan

SQUAREXO được tổ chức theo monorepo pnpm workspace với 4 package chính:

- `frontend`: React app + UI gameplay
- `backend`: HTTP API + Socket.IO + persistence
- `game-core`: engine Dots & Boxes dùng chung
- `contracts`: Solidity contract cho stake/settlement

Thiết kế hiện tại là hybrid:
- local mode: frontend tự chạy game loop
- online mode: backend giữ state authoritative theo room

## 2) Sơ đồ runtime

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

## 3) Frontend details

Nguồn chính nằm trong `packages/frontend/src/App.tsx`.

### Trạng thái
- Chủ yếu dùng `useState/useRef/useCallback` trong một component lớn.
- Có file `store/gameStore.ts` dùng Zustand nhưng hiện chưa được App chính import.

### Auth
- Login/register gọi backend qua `src/services/auth.ts`.
- Token và user profile lưu localStorage.

### Ví + blockchain call
- Khi chơi online có stake, frontend gọi trực tiếp contract:
  - create room -> `createMatch`
  - join room -> `joinMatch`
  - claim -> `claimReward`
- Nếu thiếu `VITE_CONTRACT_ADDRESS`, frontend fallback sang chế độ realtime off-chain.

### Realtime
- Kết nối `socket.io-client` tới `VITE_BACKEND_URL`.
- Event nhận: `room_info`, `player_joined`, `game_state`, `chat_message`, `match_settled`.

## 4) Backend details

### HTTP
- `createApp()` mount routes:
  - public: `/health`, `/metrics`
  - auth: `/auth/*` và `/api/auth/*`
  - history: `/api/history`
  - protected: `/users`, `/matches`

### Auth
- `JwtTokenService` quản lý access/refresh token.
- Password hash dùng bcrypt.
- Wallet link qua `/api/auth/wallet`.

### Realtime engine
- `registerSocketHandlers()` xử lý room/join/move/chat/sync.
- `RoomManager` giữ mapping socket-player, pending reconnect, và dedupe action.
- Khi game kết thúc: backend save match + cố gắng submit kết quả on-chain.

### Persistence
- Prisma dùng khi có `DATABASE_URL`.
- Nếu không có DB, nhiều service fallback in-memory để chạy tối thiểu.

## 5) Blockchain contract

`SquarexoMatch.sol` quản lý vòng đời match có cược:
- `createMatch`
- `joinMatch`
- `submitResult` (chỉ backend signer role)
- `claimReward`
- timeout paths (`cancelUnjoinedMatch`, `forceDrawOnTimeout`)

Backend chỉ submit kết quả, không claim thay user.

## 6) Data model (Prisma)

- `User`: account, wallet, elo
- `Match`: metadata trận, winner, tx hash
- `MatchMove`: chi tiết move theo thứ tự

ELO update được xử lý khi `saveResult`.

## 7) CI/CD hiện có

Workflow `.github/workflows/oasis.yml` gồm:
- install dependencies
- build backend/frontend
- compile + test contracts
- job deploy testnet thủ công (`workflow_dispatch`)

## 8) Điểm cần lưu ý kỹ thuật

1. Hiện có duplicate function `saveMatchIfFinished` trong `socket/handler.ts` (ảnh hưởng build/test).  
2. Frontend có 2 file `GameCanvas.tsx` và `gameCanvas.tsx` trùng casing.  
3. Contract compile cần tải solc từ `binaries.soliditylang.org`; môi trường bị chặn mạng sẽ fail.
