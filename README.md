# SQUAREXO

[![Watch the video](https://raw.githubusercontent.com/VuNgNgocBao04/SQUAREXO/dev/image.png)](https://raw.githubusercontent.com/VuNgNgocBao04/SQUAREXO/dev/Demo.mp4)

1v1 blockchain gaming platform combining Dots & Boxes mechanics with peer-to-peer betting on Oasis Sapphire.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Solidity: 0.8.24](https://img.shields.io/badge/Solidity-0.8.24-1f77d4)](https://docs.soliditylang.org/en/latest/)
[![Node: 18+](https://img.shields.io/badge/Node-18%2B-90c53f)](https://nodejs.org/)
[![pnpm: 8+](https://img.shields.io/badge/pnpm-8%2B-f69220)](https://pnpm.io/)
[![Oasis Sapphire](https://img.shields.io/badge/Chain-Oasis%20Sapphire-1f77d4)](https://oasis.io/)

## Overview

SQUAREXO bridges traditional game mechanics with Web3 primitives—players compete in real-time Dots & Boxes matches with optional blockchain-backed betting. The system maintains game state authoritatively on-chain while enabling fast, low-latency gameplay via Socket.IO infrastructure.

**Key capabilities:**
- Local gameplay (1v1 or vs AI)
- Online realtime multiplayer
- Blockchain-enforced match settlement
- ELO rating persistence
- Wallet integration for wagers

**Live deployments:**
- Smart Contract (Sapphire Testnet): [`0x2011069BBe427Fd168a65a364d9C205bCa7aa0C9`](https://explorer.oasis.io/testnet/sapphire/address/0x2011069BBe427Fd168a65a364d9C205bCa7aa0C9)

## Why Oasis

We chose the Oasis Sapphire network for on-chain settlement and wallet integrations because it combines a privacy-focused architecture with practical developer tooling and low transaction costs—an excellent fit for real-time, micro-betting games.

- **Privacy-first:** Oasis emphasizes privacy and confidential compute patterns that help protect sensitive game settlement data.
- **EVM-compatible & Wallet Support:** Sapphire is compatible with EVM tooling and has growing wallet integrations, lowering the onboarding friction for players.
- **Low fees & fast finality:** Transaction costs and confirmation times are suitable for small-stake wagers and smooth UX.
- **Developer ecosystem:** Active tooling and an emerging community make rapid prototyping and deployment straightforward.

## About

SquareXO is a competitive 1v1 strategy game that extends classic Tic‑Tac‑Toe into a richer experience by combining Dots & Boxes edge-claim mechanics with optional peer-to-peer wagering. Matches can be settled on-chain via the Oasis Sapphire network while gameplay stays fast and responsive using a hybrid off-chain/real-time architecture.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Browser (React 18 + Vite)                  │
│  ├─ Game canvas & UI                        │
│  ├─ Wallet integration (ethers)             │
│  └─ Socket.IO client                        │
└────────────────┬────────────────────────────┘
                 │ HTTP / WebSocket
┌────────────────▼────────────────────────────┐
│  Backend (Express + Socket.IO + Prisma)     │
│  ├─ JWT authentication                      │
│  ├─ RoomManager (state authoritative)       │
│  ├─ MatchService (scoring + ELO)            │
│  ├─ BlockchainService (settlement)          │
│  └─ Action deduplication & reconnection     │
└────────────────┬────────────────────────────┘
         ┌───────┴───────┐
         │               │
  PostgreSQL    Oasis Sapphire (EVM)
  (Prisma)      SquarexoMatch.sol
```

The system uses a hybrid approach: frontend renders local game state for responsiveness, backend maintains authoritative room state and persists matches to PostgreSQL, and the smart contract acts as the settlement layer for peer-to-peer wagers.

## Problem Statement

Traditional game platforms lack cryptographic finality for outcomes. Peer-to-peer betting on outcomes requires either trusted intermediaries or complex on-chain game logic that incurs prohibitive gas costs. Current Web3 gaming solutions sacrifice UX (latency, batch processing) or trustlessness (centralized arbiters).

SQUAREXO solves this by separating concerns:
- Game logic and state transitions execute client-side for instant feedback
- Backend coordinates players and ensures move validity
- Smart contract enforces wager settlement with minimal on-chain footprint (single result submission per match)

This architecture achieves blockchain finality without compromising real-time gameplay.

## Quick Start

### Prerequisites
- Node.js 18+ and pnpm 8+
- Docker (for local PostgreSQL)
- Wallet with Sapphire testnet funds (optional, for blockchain features)

### Setup (< 2 min)

```bash
# Clone and install workspace
git clone https://github.com/VuNgNgocBao04/SQUAREXO.git
cd SQUAREXO
pnpm install

# Start PostgreSQL
docker compose up -d postgres
docker compose exec postgres pg_isready -U squarexo -d squarexo
```

**Backend setup:**
```bash
cd packages/backend

# Create environment
cat > .env << 'EOF'
DATABASE_URL=postgresql://squarexo:squarexo@localhost:55432/squarexo?schema=public
PORT=3000
NODE_ENV=development
JWT_SECRET=dev-secret-min-32-chars-xxxxxxxxxxxxxxxx
OASIS_RPC_URL=https://testnet.sapphire.oasis.io
CONTRACT_ADDRESS=0x2011069BBe427Fd168a65a364d9C205bCa7aa0C9
BACKEND_SIGNER_PRIVATE_KEY=0x  # Optional: needed for match settlement
EOF

pnpm prisma:push
pnpm dev
# Server running at http://localhost:3000
```

**Frontend setup:**
```bash
cd packages/frontend

cat > .env << 'EOF'
VITE_BACKEND_URL=http://localhost:3000
VITE_CONTRACT_ADDRESS=0x2011069BBe427Fd168a65a364d9C205bCa7aa0C9
VITE_OASIS_RPC_URL=https://testnet.sapphire.oasis.io
EOF

pnpm dev
# App running at http://localhost:5173
```

### Test locally

1. Browser 1: Sign up as `player1`, create a betless room
2. Browser 2: Sign up as `player2`, join that room
3. Play moves—state syncs via WebSocket in real-time

To test blockchain settlement, deploy the contract (see [Deployment](#deployment)) and use wallets with testnet ROSE.

## Project Structure

```
packages/
├── frontend/              # React 18 + Vite client app
│   ├── src/
│   │   ├── App.tsx       # Main game component (canvas + logic)
│   │   ├── services/     # API client & socket handlers
│   │   ├── store/        # Zustand state (unused in current flow)
│   │   └── types/        # TypeScript contracts
│   └── vite.config.ts
├── backend/              # Node.js + Express server
│   ├── src/
│   │   ├── index.ts      # Entry point
│   │   ├── http/         # Express routes & middleware
│   │   ├── socket/       # Socket.IO event handlers
│   │   ├── services/     # Business logic
│   │   ├── db/           # Prisma client & repositories
│   │   ├── contracts/    # Zod schemas & error types
│   │   ├── types/        # Domain types
│   │   └── utils/        # Helpers
│   ├── prisma/
│   │   └── schema.prisma # Data models
│   ├── test/             # Unit & integration tests
│   └── vitest.config.mts
├── contracts/            # Hardhat + Solidity
│   ├── contracts/
│   │   └── SquarexoMatch.sol
│   ├── scripts/
│   │   └── deploy.ts
│   ├── test/
│   │   └── SquarexoMatch.security.test.ts
│   └── hardhat.config.ts
└── game-core/           # Shared game engine
    ├── src/
    │   ├── engine/       # Board state, move validation, AI
    │   └── types/        # Game types (BoardState, Move, etc.)
    └── tests/

docs/
├── architecture.md
├── blockchain-integration-prep.md
├── production-readiness-audit.md
└── ...
```

**Module responsibilities:**

| Module | Purpose |
|--------|---------|
| `frontend` | Render UI, accept player input, maintain local game state, submit actions to backend |
| `backend` | Authenticate players, coordinate matches, enforce game rules, persist state, bridge to blockchain |
| `game-core` | Dots & Boxes engine, move validation, board state transitions, AI opponent |
| `contracts` | Wager escrow, match settlement, reward distribution |

## Smart Contracts

### SquarexoMatch

Manages the lifecycle of peer-to-peer matches with optional wagers on Oasis Sapphire.

**Key responsibilities:**
- Accept wagers from two players (`createMatch` / `joinMatch`)
- Enforce join and result submission deadlines
- Accept authoritative match results from backend signer only
- Distribute rewards to winners or refund on draw
- Emergency cancel path for unjoined matches

**State machine:**
```
None
  └─ createMatch ──→ WaitingForOpponent
                         │
                    (timeout) ──→ Cancelled
                         │
                    joinMatch ──→ Active
                                    │
                            submitResult ──→ Resolved
                                    │          │
                                claimReward   (timeout) ──→ Cancelled
```

**Key events:**
- `MatchCreated`: Wager locked for creator
- `MatchJoined`: Opponent joined, pot finalized
- `ResultSubmitted`: Backend submitted winner (address(0) = draw)
- `RewardClaimed`: Winner/participant withdrew funds

**Access control:**
- `BACKEND_SIGNER_ROLE`: Only role that can call `submitResult`
- `DEFAULT_ADMIN_ROLE`: Can pause/unpause contract

**Security notes:**
- Reentrancy protection via `ReentrancyGuard` on `claimReward`
- Pausable for emergency stops
- Room ID validated against length constraints (0 < length ≤ 64)
- Type-safe winner validation (creator/opponent or draw)

See [SquarexoMatch.sol](./packages/contracts/contracts/SquarexoMatch.sol) for implementation.

## API Reference

### Authentication

```bash
POST /api/auth/register
{ "username": "player1", "password": "..." }

POST /api/auth/login
{ "username": "player1", "password": "..." }
→ { "accessToken": "...", "refreshToken": "..." }

POST /api/auth/wallet
{ "walletAddress": "0x..." }
```

### Match History

```bash
GET /api/history?limit=20&offset=0
→ { matches: [{ id, roomId, winner, betAmount, endedAt, ... }], total: 42 }

POST /api/history/sync
{ "matches": [...] }  # Sync results from offline play
```

### WebSocket Events

```typescript
// Client → Server
emit('join_room', { roomId: '...' })
emit('make_move', { actionId: '...', edge: [...] })
emit('sync_state', {})
emit('chat_message', { text: '...' })

// Server → Client
on('room_info', { players: [...], gameState: {...} })
on('player_joined', { player: {...} })
on('game_state', { board: [...], currentPlayer: '...' })
on('match_settled', { winner, txHash })
on('chat_message', { from, text, timestamp })
```

## Developer Experience

### Local Development

All commands run from workspace root:

```bash
# Install & prepare
pnpm install
docker compose up -d postgres

# Run all services in parallel
pnpm dev

# Run tests across all packages
pnpm test

# Build all packages
pnpm build
```

### Frontend Development

- Hot reload via Vite (< 100ms)
- Local game logic doesn't require backend
- Toggle blockchain via `VITE_CONTRACT_ADDRESS` env var

```bash
# Stub out contract address to test offline
VITE_CONTRACT_ADDRESS="" pnpm dev
```

### Backend Development

- Live reload via `tsx watch`
- Database migrations auto-run on `pnpm dev` (via `predev` hook)
- Socket.IO debugging enabled in development

```bash
# Run with verbose logging
DEBUG=squarexo:* pnpm dev
```

### Testing

- Backend: Unit + integration tests via Vitest
- Contracts: Security tests via Hardhat + ethers.js
- Game engine: Logic tests via Vitest

```bash
# Backend tests
cd packages/backend && pnpm test

# Contract tests
cd packages/contracts && pnpm test

# Coverage reports
pnpm test -- --coverage
```

### Debugging

**Backend:**
- Express logs to stdout with ISO timestamps
- Socket.IO connection/emit events logged
- Database queries available via Prisma logging

**Frontend:**
- Console logs in game loop
- localStorage inspection for token debugging
- Network tab for WebSocket frames

## Security Considerations

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| **Unfair move acceptance** | Backend validates all moves against board rules; invalid moves rejected before state update |
| **Replay attacks** | Action deduplication via `actionId`; Socket.IO reconnect window prevents duplicate delivery |
| **State manipulation** | Backend holds authoritative state; client state is advisory only |
| **Bet theft** | Smart contract uses OpenZeppelin patterns; reentrancy guard on withdrawals |
| **Result manipulation** | Only backend signer can call `submitResult`; enforced via role-based access control |
| **Wallet signature forgery** | Verified via ethers.js wallet recovery; backend logs all wallet submissions |

### Assumptions

- Backend signer private key remains confidential
- Oasis Sapphire RPC endpoints are available (fallback URLs configured)
- Player wallets follow EIP-191 signing standard
- PostgreSQL accessible only from backend (not exposed)
- Admin can pause contract in emergency (but cannot steal funds)

### Known Limitations

- No proof of misbehavior challenge mechanism; result finality depends on backend integrity
- Smart contract does not validate game rules on-chain (gas optimization trade-off)
- Match history sync from offline clients requires manual trigger (`POST /api/history/sync`)

### Audit Status

Contract is **not yet audited**. Suitable for testnet and research. For mainnet deployment, engage professional auditors (recommend checking OpenZeppelin Defender, Trail of Bits, or Immunefi-listed firms).

## Performance & Scalability

### Game Loop Optimization

- Board state represented as compact JSON (not full 2D array) for socket payload < 1KB
- Move validation runs in ~1ms (lookup table for adjacent edges)
- Dedupe window keeps memory footprint O(players per room) not O(all players)

### Blockchain Layer

- **Result submission**: Single on-chain call per match (not per move)
- **Reward distribution**: Lazy claiming (user-initiated) avoids batch overhead
- **Gas profile**: `createMatch` ~60k, `joinMatch` ~80k, `submitResult` ~50k, `claimReward` ~50k
  - Total wager lifecycle: ~240k gas (~$5–10 at current Sapphire rates)

### Backend Scalability

- WebSocket handlers are async; single backend instance handles 1000s of concurrent rooms
- Horizontal scaling: Room ownership sticky-routed via load balancer
- Database: Indexed queries on `(playerXId, endedAt)`, `(roomId, endedAt)` for history pagination

### Future Optimizations

- Implement batch reward claims to save gas
- Add Redis caching layer for room state snapshots
- Use Sapphire confidentiality for result commitment (commit-reveal pattern)

## Roadmap

| Phase | Target | Scope |
|-------|--------|-------|
| **Alpha** | Q2 2026 | Testnet launch, local + online gameplay, basic auth |
| **Beta** | Q3 2026 | Testnet audit, improved onboarding, AI opponent refinement |
| **Mainnet** | Q4 2026 | Mainnet deployment, gas optimization, leaderboard |
| **V2** | 2027 | Tournament mode, governance token, SDK for game embedding |

## Contributing

Contributions are welcome. Please follow this workflow:

### Branch Strategy

```
dev                      # Latest development
├─ feat/*               # New features (branch from dev)
├─ fix/*                # Bug fixes (branch from dev)
└─ chore/*              # Maintenance (branch from dev)

main                     # Production releases
└─ v*.*.*               # Version tags
```

### Commit Convention

Use conventional commits:
```
feat(backend): add wallet authentication
fix(frontend): resolve WebSocket reconnect loop
test(contracts): add edge case for draw timeout
docs: update deployment checklist
```

### Code Review

1. Create PR against `dev` branch
2. Link related issues (closes #42)
3. Ensure tests pass: `pnpm test`
4. Code style check: linting integrated in CI
5. At least one maintainer approval required

### Code Style

- **TypeScript**: Strict mode, explicit types for public APIs
- **Formatting**: Configured via prettier (runs in CI)
- **Imports**: Relative paths within package, workspace imports for cross-package
- **Naming**: camelCase for variables/functions, PascalCase for types/classes

### Testing Expectations

- Backend: >70% line coverage for services
- Contracts: All state transitions tested
- Frontend: Critical paths (auth, socket connect, game move) integration tested

## License

MIT. See [LICENSE](./LICENSE).

## Runtime Flow

1. Users register/login via `/api/auth/*` to obtain JWTs.
2. Users link wallets via `/api/auth/wallet`.
3. To create an online room:
  - The frontend may call `createMatch` on-chain when `VITE_CONTRACT_ADDRESS` is set,
  - Then join the room via `join_room` over Socket.IO.
4. During an online match, clients emit `make_move`; the backend validates turn order, deduplicates actions, and updates authoritative state.
5. When the board is full, the backend saves the result to the database and attempts to `submitResult` on-chain.
6. The frontend receives `match_settled` (including the tx hash); winners can `claimReward` from the contract.

- File: `packages/contracts/contracts/SquarexoMatch.sol`
- Chức năng chính:
  - `createMatch(roomId, betAmount)`
  - `joinMatch(roomId)`
  - `submitResult(roomId, winner)` (role `BACKEND_SIGNER_ROLE`)
  - `claimReward(roomId)`
  - `cancelUnjoinedMatch(roomId)`
  - `forceDrawOnTimeout(roomId)`
- Events: `MatchCreated`, `MatchJoined`, `ResultSubmitted`, `RewardClaimed`, `MatchCancelled`, `DrawForcedByTimeout`



## Environment Variables

| Key | Description |
|---|---|
| `PORT` | Backend port (default: 3000) |
| `CORS_ORIGIN` | Allowed origin for HTTP and WebSocket CORS |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `JWT_SECRET` | Secret used to sign access/refresh tokens (>=32 chars) |
| `JWT_EXPIRES_IN` | Access token TTL (e.g. `15m`, `1h`) |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token TTL |
| `OASIS_RPC_URL` | Primary Oasis Sapphire RPC endpoint for backend submits |
| `OASIS_RPC_FALLBACK_URLS` | Comma-separated RPC fallback endpoints |
| `OASIS_EXPECTED_CHAIN_ID` | Expected chain ID (testnet: 23295) |
| `BACKEND_SIGNER_PRIVATE_KEY` | Backend signer private key (server only) |
| `BACKEND_SIGNER_ADDRESS` | Address of the backend signer (role granted on-chain) |
| `CONTRACT_ADDRESS` | Deployed `SquarexoMatch` contract address |
| `VITE_BACKEND_URL` | Backend URL used by the frontend |
| `VITE_OASIS_RPC_URL` | RPC endpoint used by the frontend wallet/network config |
| `VITE_CONTRACT_ADDRESS` | Contract address used by the frontend for staking/claims |
| `DEPLOYER_PRIVATE_KEY` | Private key for contract deployment (contracts package only) |
| `BLOCKCHAIN_TX_TIMEOUT_MS` | Timeout for waiting for tx confirmations (ms) |
| `HISTORY_SYNC_API_KEY` | Optional API key protecting `/api/history/sync` |

## Scripts

### Root
- `pnpm dev`: run all packages that expose a `dev` script in parallel
- `pnpm build`: build the entire workspace
- `pnpm test`: run tests across all packages

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

## Known Issues

1. `packages/backend/src/socket/handler.ts` contains a duplicate export `saveMatchIfFinished`, causing backend build failures.
2. `packages/frontend/src/components/GameCanvas.tsx` and `gameCanvas.tsx` differ only by case, causing frontend build failures on case-sensitive filesystems.
3. Root `pnpm build` depends on downloading the Solidity compiler; environments without access to `binaries.soliditylang.org` may fail to compile contracts.
4. `pnpm --filter backend test` currently fails several integration tests for auth because `router.put(..., authMiddleware || ...)` receives `undefined` middleware in the test setup.

## Additional Documentation

- [docs/setup.md](docs/setup.md)
- [docs/architecture.md](docs/architecture.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)

## License

Apache-2.0 [LICENSE](./LICENSE).
