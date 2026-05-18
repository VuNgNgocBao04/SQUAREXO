# SQUAREXO

SQUAREXO là monorepo cho game dạng Dots & Boxes (2 người chơi hoặc chơi với bot) viết bằng TypeScript.
Dự án tách `game-core` (luật game thuần) khỏi frontend/backend để tái sử dụng.
Backend có Socket.IO để đồng bộ phòng chơi theo thời gian thực, nhưng frontend hiện tại đang chạy game local trong trình duyệt.
Các chi tiết blockchain trong UI hiện là mô phỏng (mock), chưa có tích hợp ví hoặc smart contract thật.

## Demo

- Website: Chưa công bố
- Video: Chưa công bố
- Smart contract explorer: Chưa có contract triển khai trong repository

## Kiến trúc hệ thống

```text
Frontend (React + Canvas)
   ├─ Chế độ hiện tại: local state trong browser
   └─ Hiển thị thông tin "on-chain" dạng mô phỏng

Backend (Express + Socket.IO)
   ├─ REST: GET /
   ├─ Socket events: join_room, make_move, reset_game
   └─ Room store: Map in-memory (không persistence)

Shared domain (game-core)
   ├─ createGame(rows, cols)
   ├─ applyMove(state, edge)
   └─ isEdgeTaken(state, edge)
```

### Frontend
- Stack: Vite + React 18 + TypeScript.
- Render bàn cờ bằng Canvas API trong `packages/frontend/src/App.tsx`.
- State management chính: React state + `useRef` để tối ưu redraw canvas.
- Có `zustand` store và `GameCanvas` component dùng `game-core`, nhưng chưa được gắn vào luồng UI chính.

### Backend
- Stack: Node.js + Express + Socket.IO + TypeScript.
- Entry: `packages/backend/src/index.ts`.
- Room/game state lưu trong memory (`RoomStore`), tự xóa khi phòng không còn người.
- Logic game backend không tự viết lại mà gọi `game-core` qua adapter.

### Blockchain layer
- Không có thư viện web3 (`ethers`, `viem`, `wagmi`, ...).
- Không có ABI, không có địa chỉ contract cấu hình theo env, không có RPC call.
- Các thông tin như `Sepolia`, `Tx hash`, `contract` trong frontend là dữ liệu mô phỏng để trình diễn UI.

### Database
- Chưa có DB server trong code hiện tại.
- Backend dùng Map in-memory.
- Lịch sử ván chơi ở frontend lưu bằng `localStorage` (`dbChainHistory`).

### Realtime / game sync
- Backend đã có channel realtime qua Socket.IO với các event:
  - Client → Server: `join_room`, `make_move`, `reset_game`
  - Server → Client: `room_info`, `game_state`, `player_joined`, `room_full`, `error`
- Frontend hiện tại chưa kết nối Socket.IO client, nên chưa dùng được multiplayer qua backend.

### Auth flow
- Chưa có hệ thống auth.
- “Kết nối ví” ở màn hình home là mock (sinh địa chỉ và số dư ngẫu nhiên trên client).

### Game loop & bot logic
- Vòng lặp game local:
  1. Người chơi click cạnh trên canvas
  2. Cập nhật line đã chọn
  3. Kiểm tra box khép kín, cộng điểm
  4. Nếu không ăn box thì đổi lượt
  5. Đủ số box thì kết thúc ván
- Bot (`vs AI`) dùng heuristic đơn giản:
  - Ưu tiên nước đi ăn box ngay
  - Nếu không có thì chọn nước đi không mở lợi thế rõ ràng cho đối thủ
  - Cuối cùng fallback random

## Cấu trúc repository

```text
SQUAREXO/
├─ package.json
├─ pnpm-workspace.yaml
├─ packages/
│  ├─ game-core/   # luật game thuần + unit test
│  ├─ frontend/    # Vite + React + Canvas UI
│  └─ backend/     # Express + Socket.IO server
└─ docs/
   └─ setup-base-game.md
```

## Monorepo & workspace

- Package manager: `pnpm` workspace.
- Root scripts:
  - `pnpm dev` chạy `dev` song song cho các package có script tương ứng.
  - `pnpm build` build toàn workspace.
  - `pnpm test` chạy test toàn workspace.

## Cài đặt và chạy local

Yêu cầu:
- Node.js 20+
- Corepack (để dùng đúng pnpm)

```bash
corepack enable
corepack prepare pnpm@8.15.0 --activate
pnpm install --no-frozen-lockfile
```

Chạy từng service:

```bash
# Frontend
pnpm --filter frontend dev

# Backend
pnpm --filter backend dev

# Game core tests
pnpm --filter game-core test
```

## Biến môi trường

Backend đang đọc 2 biến môi trường:

- `PORT` (mặc định `3000`)
- `PUBLIC_BASE_URL` (dùng để tạo room URL, mặc định `http://localhost:<PORT>`)

Hiện chưa có file `.env.example` trong repository.

## CI/CD, Docker, deploy

- Chưa có workflow CI trong `.github/workflows`.
- Chưa có `Dockerfile` hoặc `docker-compose`.
- Chưa có cấu hình deploy tự động trong repository.

## Trạng thái build/test hiện tại

Khi chạy trực tiếp trên mã nguồn hiện tại:

- `pnpm --filter game-core test`: pass
- `pnpm build`: fail ở frontend do trùng tên file khác casing:
  - `src/components/GameCanvas.tsx`
  - `src/components/gameCanvas.tsx`
- `pnpm test`: fail do `packages/backend` chưa có test thật (script đang `exit 1`)

README này chỉ mô tả đúng trạng thái triển khai hiện có, không giả định các thành phần chưa được tích hợp.
