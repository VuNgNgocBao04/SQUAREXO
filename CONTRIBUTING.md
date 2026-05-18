# Contributing

Tài liệu này ghi lại workflow đóng góp đang phù hợp với cấu trúc workspace hiện tại.

## 1. Yêu cầu môi trường

- Node.js 22 (workflow CI đang dùng Node 22)
- pnpm
- Docker (để chạy Postgres local)

## 2. Cài đặt

```bash
corepack enable
docker compose up -d postgres
pnpm install --fix-lockfile
```

Tạo `.env` từ các file mẫu:

- `packages/backend/.env.example`
- `packages/frontend/.env.example`
- `packages/contracts/.env.example`

Backend DB init:

```bash
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:push
```

## 3. Quy tắc branch / commit

- Tạo branch từ nhánh làm việc hiện tại theo nhóm thay đổi (`feat/*`, `fix/*`, `docs/*`...)
- Commit nhỏ, mô tả rõ phạm vi.
- Không gộp sửa unrelated vào cùng PR.

## 4. Luồng phát triển theo package

### Frontend

```bash
pnpm --filter frontend dev
```

### Backend

```bash
pnpm --filter backend dev
```

### Contracts

```bash
pnpm --filter contracts build
pnpm --filter contracts test
```

### Game-core

```bash
pnpm --filter game-core test
```

## 5. Checklist trước khi mở PR

Chạy tối thiểu các lệnh liên quan đến vùng bạn sửa:

```bash
pnpm --filter game-core test
pnpm --filter backend test
pnpm --filter backend build
pnpm --filter frontend build
pnpm --filter contracts test
```

Lưu ý hiện trạng repository:
- backend build đang lỗi do duplicate export trong `socket/handler.ts`
- frontend build đang lỗi do trùng file khác casing `GameCanvas.tsx` / `gameCanvas.tsx`

Nếu PR của bạn không xử lý các lỗi nền này, ghi rõ trong PR description để reviewer phân biệt với regression mới.

## 6. Khi có thay đổi DB/Prisma

- Sửa `packages/backend/prisma/schema.prisma`
- Chạy `prisma:generate`
- Chạy `prisma:push` (dev local) hoặc `prisma:migrate` khi cần migration script
- Test lại route/service liên quan

## 7. Khi có thay đổi contract

- Cập nhật contract + test Hardhat
- Re-compile và chạy test security
- Nếu deploy mới, cập nhật địa chỉ contract trong env backend/frontend
- Không commit private key hoặc secrets

## 8. Review focus

Khi review PR, ưu tiên kiểm tra:
- trạng thái sync realtime (turn, dedupe, reconnect)
- auth token flow và middleware
- compatibility giữa game-core và backend adapter
- error handling khi blockchain không cấu hình hoặc tx timeout
