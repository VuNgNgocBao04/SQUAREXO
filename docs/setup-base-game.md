# Setup Base Game – Hướng Dẫn Từng Bước

> Tài liệu này mô tả trình tự các bước để thiết lập và chạy **SquareXO** từ đầu.  
> Dành cho mọi thành viên tham gia vào issue _"Setup Base Game"_.

---

## Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Tổng quan kiến trúc](#2-tổng-quan-kiến-trúc)
3. [Clone & cài đặt dependencies](#3-clone--cài-đặt-dependencies)
4. [Chạy development server](#4-chạy-development-server)
5. [Cấu trúc thư mục](#5-cấu-trúc-thư-mục)
6. [Chi tiết từng package](#6-chi-tiết-từng-package)
   - [game-core](#61-game-core)
   - [frontend](#62-frontend)
   - [backend](#63-backend)
7. [Luồng dữ liệu (Data Flow)](#7-luồng-dữ-liệu-data-flow)
8. [Build production](#8-build-production)
9. [Lộ trình tiếp theo (Phase 2+)](#9-lộ-trình-tiếp-theo-phase-2)

---

## 1. Yêu cầu hệ thống

| Công cụ | Phiên bản tối thiểu | Ghi chú |
|---------|---------------------|---------|
| Node.js | ≥ 18 | LTS khuyến nghị |
| pnpm    | ≥ 9  | `npm install -g pnpm` |
| Git     | bất kỳ | — |

---

## 2. Tổng quan kiến trúc

```
squarexo/
│
├── package.json          ← root workspace (pnpm)
├── pnpm-workspace.yaml   ← khai báo packages/*
│
├── packages/
│   ├── game-core/        ← TypeScript thuần, không phụ thuộc framework
│   ├── frontend/         ← Vite + React + Zustand + Canvas API
│   └── backend/          ← Node.js + Express + Socket.IO
│
└── docs/
    └── setup-base-game.md  ← tài liệu này
```

### Tech Stack

| Layer | Công nghệ | Lý do chọn |
|-------|-----------|------------|
| **Game Logic** | TypeScript (no framework) | Tái sử dụng được ở cả FE và BE |
| **Frontend** | Vite + React 18 + Zustand | Khởi động nhanh, state management nhẹ |
| **Rendering** | Canvas API (HTML5) | Đủ mạnh cho Phase 1, không cần Phaser |
| **Backend** | Node.js + Express | Quen thuộc, minimal setup |
| **Realtime** | Socket.IO | Hỗ trợ WebSocket + fallback tự động |
| **Monorepo** | pnpm workspaces | Chia sẻ `game-core` giữa FE & BE |

> ❌ **Chưa dùng**: Redis (chưa cần scale ở MVP), Phaser (tránh overload Phase 1).

---

## 3. Clone & cài đặt dependencies

```bash
# 1. Clone repo
git clone https://github.com/VuNgNgocBao04/SQUAREXO.git
cd SQUAREXO

# 2. Cài đặt tất cả dependencies (tất cả packages cùng lúc)
pnpm install
```

`pnpm install` tự động:
- Cài dependencies cho **tất cả** packages trong `packages/`
- Tạo symlink `node_modules/@squarexo/game-core` trong FE & BE (workspace protocol)

---

## 4. Chạy development server

### Tất cả cùng một lúc (khuyến nghị)

```bash
pnpm dev
```

Lệnh này chạy song song:
- **game-core** → TypeScript watch (`tsc --watch`)
- **frontend** → Vite dev server tại `http://localhost:5173`
- **backend** → ts-node-dev tại `http://localhost:3001`

### Từng package riêng lẻ

```bash
# Chỉ backend
pnpm --filter @squarexo/backend dev

# Chỉ frontend
pnpm --filter @squarexo/frontend dev

# Chỉ game-core (watch mode)
pnpm --filter @squarexo/game-core dev
```

### Kiểm tra backend health

```bash
curl http://localhost:3001/health
# → {"status":"ok","timestamp":"..."}
```

---

## 5. Cấu trúc thư mục

```
packages/
│
├── game-core/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts        ← Types + Engine (createGame, applyMove, ...)
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── components/
│       │   └── GameCanvas.tsx  ← Canvas API rendering
│       └── store/
│           └── gameStore.ts    ← Zustand store
│
└── backend/
    ├── package.json
    ├── tsconfig.json
    └── src/
        └── index.ts        ← Express + Socket.IO server
```

---

## 6. Chi tiết từng package

### 6.1 game-core

**Mục đích**: Chứa toàn bộ logic game – không phụ thuộc vào bất kỳ framework nào. Được dùng lại ở cả FE (Zustand store) và BE (Socket.IO handler).

**Các exports chính**:

| Symbol | Loại | Mô tả |
|--------|------|-------|
| `GameState` | interface | Trạng thái đầy đủ của ván chơi |
| `Player` | type | `"X"` hoặc `"O"` |
| `Edge` | interface | Một cạnh giữa hai điểm |
| `createGame(rows, cols)` | function | Tạo trạng thái ban đầu |
| `applyMove(state, edge)` | function | Áp dụng nước đi, trả về state mới (immutable) |
| `isEdgeTaken(state, edge)` | function | Kiểm tra cạnh đã được chọn chưa |

**Logic quan trọng**:
- `applyMove` luôn trả về **state mới** (không mutate) → an toàn cho React / Zustand
- Sau khi đặt cạnh, engine tự động kiểm tra các ô vuông mới được hoàn thành
- Người chơi **giữ lượt** khi hoàn thành ít nhất một ô vuông (đúng luật Dots & Boxes)

### 6.2 frontend

**Mục đích**: Giao diện người dùng, rendering bằng Canvas API.

**Điểm quan trọng**:

```
src/
├── store/gameStore.ts   ← Zustand store gọi game-core
└── components/
    └── GameCanvas.tsx   ← useRef<HTMLCanvasElement> + draw loop
```

**Cách Canvas hoạt động**:
1. `GameCanvas.tsx` giữ một `ref` đến `<canvas>`
2. Mỗi khi `game` state thay đổi (qua Zustand), `useEffect` gọi lại hàm `draw()`
3. `draw()` vẽ theo thứ tự: nền → ô vuông đã hoàn thành → cạnh → điểm → nhãn
4. Hover effect: `onMouseMove` tìm cạnh gần nhất và highlight bằng màu của người chơi hiện tại

**Zustand store** (`gameStore.ts`):
```typescript
const useGameStore = create<GameStore>((set) => ({
  game: createGame(5, 5),
  resetGame: () => set({ game: createGame(5, 5) }),
  makeMove: (edge) => set((state) => ({ game: applyMove(state.game, edge) })),
}));
```

### 6.3 backend

**Mục đích**: Quản lý nhiều phòng chơi qua Socket.IO, đồng bộ trạng thái game cho tất cả client trong cùng phòng.

**Các Socket.IO events**:

| Event | Hướng | Payload | Mô tả |
|-------|-------|---------|-------|
| `join_room` | Client → Server | `roomId: string` | Vào/tạo phòng, nhận state hiện tại |
| `make_move` | Client → Server | `{ roomId, edge }` | Đặt cạnh |
| `reset_game` | Client → Server | `roomId: string` | Đặt lại ván chơi |
| `game_state` | Server → Client | `GameState` | Broadcast state mới |
| `error` | Server → Client | `{ message }` | Thông báo lỗi nước đi |

**In-memory room store** (đủ cho MVP):
```typescript
const rooms = new Map<string, GameState>();
```
> 💡 Khi cần scale (nhiều server instance), thay bằng Redis pub/sub. Tuy nhiên ở MVP một instance là đủ.

---

## 7. Luồng dữ liệu (Data Flow)

```
[Browser Player 1]                    [Browser Player 2]
       │                                      │
       │ click on edge                        │
       ▼                                      │
[GameCanvas onClick]                          │
       │                                      │
       ▼                                      │
[Zustand makeMove]  ──(local update)──►  [Canvas re-renders]
       │
       │ (Phase 2: emit to socket)
       ▼
[Socket.IO Client]
       │  make_move { roomId, edge }
       ▼
[Express/Socket.IO Server]
       │
       ▼
[game-core applyMove]  ←── shared package
       │
       │  game_state (broadcast)
       ▼
[Socket.IO Client]  ──► [Zustand set game]  ──► [Canvas re-renders]
```

> **Phase 1 hiện tại**: Chỉ có local state (Zustand). Tích hợp Socket.IO sẽ thực hiện ở Phase 2.

---

## 8. Build production

```bash
# Build tất cả packages
pnpm build

# Kết quả:
# packages/game-core/dist/      ← compiled TypeScript
# packages/frontend/dist/       ← static files (HTML/CSS/JS)
# packages/backend/dist/        ← compiled backend
```

Để chạy backend production:

```bash
cd packages/backend
node dist/index.js
```

---

## 9. Lộ trình tiếp theo (Phase 2+)

| Phase | Tính năng |
|-------|-----------|
| **Phase 2** | Kết nối Socket.IO từ frontend → backend, chế độ 2 người chơi thực sự |
| **Phase 2** | Phòng chơi (room system) với URL chia sẻ |
| **Phase 3** | Thêm AI opponent (minimax hoặc MCTS trong `game-core`) |
| **Phase 3** | Nâng cấp Canvas rendering (animation, particle effects) |
| **Phase 4** | Tích hợp Blockchain (Oasis Network) |
| **Phase 4** | Persistent leaderboard (PostgreSQL hoặc PlanetScale) |

---

*Tài liệu này được tạo cho issue **Setup Base Game**. Mọi thắc mắc vui lòng tạo comment trong issue hoặc hỏi trực tiếp team lead.*
