# SQUAREXO

SQUAREXO là game 1v1 dạng Dots & Boxes (biến thể XO theo cạnh và ô), có 2 mode chính: local (PvP/AI) và online realtime qua Socket.IO.  
Blockchain Oasis Sapphire được dùng cho luồng cược và settle kết quả trận (`createMatch`, `joinMatch`, `submitResult`, `claimReward`).  
Codebase là monorepo pnpm gồm frontend React/Vite, backend Express + Socket.IO, smart contract Hardhat, và package game-core dùng chung.

## Demo

- Web: chưa thấy URL public trong repository
- Video: chưa thấy link demo video trong repository
- Contract (Sapphire testnet):
  - Address: `0x2011069BBe427Fd168a65a364d9C205bCa7aa0C9`
  - Sourcify: https://repo.sourcify.dev/contracts/partial_match/23295/0x2011069BBe427Fd168a65a364d9C205bCa7aa0C9/
  - Oasis Explorer (testnet): https://explorer.oasis.io/testnet/sapphire/address/0x2011069BBe427Fd168a65a364d9C205bCa7aa0C9

## Kiến trúc hệ thống

```text
Frontend (React/Vite)
  ├─ HTTP: /api/auth, /api/history
  └─ WebSocket: join_room, make_move, chat_message
        ↓
Backend (Express + Socket.IO)
  ├─ Auth (JWT)
  ├─ RoomManager + authoritative realtime state
  ├─ MatchService (save result, ELO)
  ├─ BlockchainService (submitResult)
  └─ Prisma (PostgreSQL) hoặc fallback in-memory
        ↓
Oasis Sapphire (SquarexoMatch.sol)
```

### Frontend
- React 18 + Vite + TypeScript.
- UI game local chủ yếu nằm trong `packages/frontend/src/App.tsx`.
- Kết nối ví bằng `ethers` + `@oasisprotocol/sapphire-paratime`.
- Có `socket.io-client` cho online room.
- Auth token/user lưu localStorage (`squarexo-access-token`, `squarexo-user`, ...).

### Backend
- Express 5 + Socket.IO server.
- HTTP routes:
  - `/health`, `/metrics`
  - `/api/auth/*`
  - `/api/history`, `/api/history/sync`
  - `/users/*`, `/matches/*` (auth required)
- Realtime:
  - join room, move, sync state, chat
  - room reconnect window + dedupe actionId
- Validation dùng Zod.

### Blockchain layer
- Hardhat + Solidity 0.8.24.
- Contract chính: `SquarexoMatch.sol`.
- Mạng cấu hình sẵn: Sapphire testnet (`0x5aff`) và mainnet (`0x5afe`).
- Backend signer submit kết quả qua `submitResult(roomId, winner)`.

### Database
- Prisma schema dùng PostgreSQL (`User`, `Match`, `MatchMove`).
- Docker compose cung cấp Postgres local (`localhost:55432`).
- Nếu thiếu `DATABASE_URL`, backend rơi về in-memory store cho một số service.

### Realtime / game sync
- Socket events chính: `join_room`, `make_move`, `sync_state`, `chat_message`.
- Server giữ trạng thái phòng (`RoomManager`) và broadcast `game_state`.
- Kết thúc trận online: backend thử ghi on-chain rồi phát `match_settled`.

## Công nghệ sử dụng

### Frontend
- React, TypeScript, Vite
- socket.io-client
- ethers v6
- zustand (đã có store nhưng hiện chưa được App chính sử dụng)

### Backend
- Node.js, Express, Socket.IO
- Prisma, PostgreSQL
- JWT + bcrypt
- Zod, Vitest

### Blockchain
- Solidity, Hardhat, OpenZeppelin
- Oasis Sapphire RPC + sapphire signer wrapper

### Infrastructure / Dev tooling
- pnpm workspace
- Docker Compose (Postgres)
- GitHub Actions (`.github/workflows/oasis.yml`)

## Cấu trúc thư mục

```text
packages/
  frontend/      React app
  backend/       Express + Socket.IO + Prisma
  contracts/     Hardhat + Solidity contracts
  game-core/     Engine Dots & Boxes + AI heuristic

docs/            Tài liệu vận hành và checklist
docker-compose.yml
```

## Luồng hoạt động thực tế

1. User đăng ký/đăng nhập qua `/api/auth/*` để lấy JWT.  
2. User link ví bằng `/api/auth/wallet`.  
3. Tạo phòng online:
   - Frontend có thể gọi `createMatch` on-chain (nếu có `VITE_CONTRACT_ADDRESS`),
   - rồi `join_room` qua Socket.IO.
4. Trong trận online, client gửi `make_move`; backend validate turn + dedupe + cập nhật state authoritative.
5. Khi board full, backend `saveResult` vào DB và thử `submitResult` on-chain.
6. Frontend nhận `match_settled`, hiển thị tx hash; winner tự `claimReward` từ contract.

## Smart Contract

- File: `packages/contracts/contracts/SquarexoMatch.sol`
- Chức năng chính:
  - `createMatch(roomId, betAmount)`
  - `joinMatch(roomId)`
  - `submitResult(roomId, winner)` (role `BACKEND_SIGNER_ROLE`)
  - `claimReward(roomId)`
  - `cancelUnjoinedMatch(roomId)`
  - `forceDrawOnTimeout(roomId)`
- Events: `MatchCreated`, `MatchJoined`, `ResultSubmitted`, `RewardClaimed`, `MatchCancelled`, `DrawForcedByTimeout`

## Cài đặt local

Chi tiết đầy đủ: [`docs/setup.md`](docs/setup.md)

Quick start tối thiểu:

```bash
git clone https://github.com/VuNgNgocBao04/SQUAREXO.git
cd SQUAREXO
corepack enable
docker compose up -d postgres
pnpm install --fix-lockfile

cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
cp packages/contracts/.env.example packages/contracts/.env

pnpm --filter backend prisma:generate
pnpm --filter backend prisma:push
pnpm dev
```

## Environment Variables

| Key | Description |
|---|---|
| `PORT` | Port backend (mặc định 3000) |
| `CORS_ORIGIN` | Origin cho HTTP + Socket CORS |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL cho Prisma |
| `JWT_SECRET` | Secret ký access/refresh token (>=32 ký tự) |
| `JWT_EXPIRES_IN` | TTL access token |
| `REFRESH_TOKEN_EXPIRES_IN` | TTL refresh token |
| `OASIS_RPC_URL` | RPC chính cho backend blockchain submit |
| `OASIS_RPC_FALLBACK_URLS` | RPC fallback (comma-separated) |
| `OASIS_EXPECTED_CHAIN_ID` | Chain ID mong đợi (testnet: 23295) |
| `BACKEND_SIGNER_PRIVATE_KEY` | Private key signer backend (server only) |
| `CONTRACT_ADDRESS` | Address `SquarexoMatch` |
| `BLOCKCHAIN_TX_TIMEOUT_MS` | Timeout chờ tx confirm |
| `HISTORY_SYNC_API_KEY` | Key bảo vệ `/api/history/sync` (optional) |
| `VITE_BACKEND_URL` | URL backend cho frontend |
| `VITE_OASIS_NETWORK` | `testnet` hoặc `mainnet` |
| `VITE_OASIS_RPC_URL` | RPC cho wallet/network config phía frontend |
| `VITE_CONTRACT_ADDRESS` | Address contract để frontend gọi stake/reward |
| `DEPLOYER_PRIVATE_KEY` | Key deploy contract (chỉ package contracts) |
| `BACKEND_SIGNER_ADDRESS` | Address signer được cấp role on-chain |

## Scripts

### Root
- `pnpm dev`: chạy dev song song các package có script `dev`
- `pnpm build`: build toàn workspace
- `pnpm test`: chạy test toàn workspace

### Backend
- `pnpm --filter backend dev`
- `pnpm --filter backend build`
- `pnpm --filter backend test`
- `pnpm --filter backend prisma:generate`
- `pnpm --filter backend prisma:push`

### Frontend
- `pnpm --filter frontend dev`
- `pnpm --filter frontend build`
- `pnpm --filter frontend preview`

### Contracts
- `pnpm --filter contracts build`
- `pnpm --filter contracts test`
- `pnpm --filter contracts deploy:testnet`
- `pnpm --filter contracts deploy:mainnet`

### Game core
- `pnpm --filter game-core build`
- `pnpm --filter game-core test`

## Quy trình phát triển

- Branch theo feature/fix riêng.
- Với backend có DB change: cập nhật `prisma/schema.prisma` rồi chạy `prisma:generate` + `prisma:push`/`prisma:migrate`.
- Với contracts: compile + test trước khi deploy; sau deploy cập nhật `CONTRACT_ADDRESS` cho backend/frontend env.
- Trước PR nên chạy ít nhất:
  - `pnpm --filter game-core test`
  - `pnpm --filter backend test`
  - `pnpm --filter backend build`
  - `pnpm --filter frontend build`

## Testing

- `game-core`: unit tests cho engine.
- `backend`: unit + integration (auth/history/socket/http).
- `contracts`: security tests trong `SquarexoMatch.security.test.ts`.

## Roadmap (thực tế, chưa có trong code hiện tại)

- Matchmaking thay vì join bằng room code thủ công.
- Spectator mode riêng (hiện có trạng thái spectator tạm trong room full).
- Replay/move timeline từ `MatchMove` cho UI history.
- Anti-cheat mở rộng (rate + dedupe đã có, chưa có signed action từ client).
- Tối ưu chi phí gas và chiến lược settle khi mạng chậm.

## Known Issues

1. `packages/backend/src/socket/handler.ts` đang có duplicate export `saveMatchIfFinished` → backend build lỗi.  
2. `packages/frontend/src/components/GameCanvas.tsx` và `gameCanvas.tsx` trùng tên khác casing → frontend build lỗi trên môi trường case-sensitive.  
3. `pnpm build` ở root phụ thuộc compile contract; trong môi trường không truy cập `binaries.soliditylang.org` sẽ fail tải compiler.  
4. `pnpm --filter backend test` hiện fail một loạt integration auth do `router.put(..., authMiddleware || ...)` nhận `undefined` middleware trong test setup.

## Tài liệu thêm

- [docs/setup.md](docs/setup.md)
- [docs/architecture.md](docs/architecture.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)

## License

Repository đã có `LICENSE` theo MIT.
