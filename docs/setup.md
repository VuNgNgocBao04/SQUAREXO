# Setup local

## 1) Prerequisites

- Node.js 22
- pnpm (thông qua corepack)
- Docker + Docker Compose

## 2) Clone và cài package

```bash
git clone https://github.com/VuNgNgocBao04/SQUAREXO.git
cd SQUAREXO
corepack enable
pnpm install --fix-lockfile
```

> Ghi chú: lockfile hiện có thể không chạy được với `--frozen-lockfile` do trạng thái file trong repo.

## 3) Khởi động PostgreSQL

```bash
docker compose up -d postgres
docker compose ps
```

Postgres local map: `localhost:55432 -> container:5432`.

## 4) Cấu hình env

### Backend

```bash
cp packages/backend/.env.example packages/backend/.env
```

Bắt buộc tối thiểu:
- `JWT_SECRET` (>= 32 ký tự)
- `DATABASE_URL` đúng port `55432`

### Frontend

```bash
cp packages/frontend/.env.example packages/frontend/.env
```

### Contracts

```bash
cp packages/contracts/.env.example packages/contracts/.env
```

## 5) Init Prisma

```bash
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:push
```

## 6) Chạy dev

### Cách 1: chạy toàn workspace

```bash
pnpm dev
```

### Cách 2: tách terminal

Terminal 1:
```bash
pnpm --filter backend dev
```

Terminal 2:
```bash
pnpm --filter frontend dev
```

## 7) Build/Test tham khảo

```bash
pnpm --filter game-core test
pnpm --filter backend test
pnpm --filter backend build
pnpm --filter frontend build
pnpm --filter contracts test
```

Hiện tại có một số lỗi nền đã biết (chi tiết ở README `Known Issues`).

## 8) Deploy contract testnet (tuỳ chọn)

```bash
pnpm --filter contracts build
pnpm --filter contracts test
pnpm --filter contracts deploy:testnet
```

Sau deploy, cập nhật:
- `packages/backend/.env` -> `CONTRACT_ADDRESS`, `BACKEND_SIGNER_PRIVATE_KEY`
- `packages/frontend/.env` -> `VITE_CONTRACT_ADDRESS`

## 9) Kiểm tra nhanh backend

```bash
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```
