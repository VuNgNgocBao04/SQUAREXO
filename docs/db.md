
## Setup Database (PostgreSQL + Prisma)

### 1) Chạy PostgreSQL local bằng Docker

```bash
docker compose up -d
```

Mặc định database local:

- user: `squarexo`
- password: `squarexo`
- db: `squarexo`
- port: `5432`

### 2) Cấu hình biến môi trường backend

Tạo file `packages/backend/.env` từ `packages/backend/.env.example` và đảm bảo có:

```env
DATABASE_URL=postgresql://squarexo:squarexo@localhost:5432/squarexo?schema=public
JWT_SECRET=your-super-secret-key-here-at-least-32-characters-long
JWT_EXPIRES_IN=7d
```

### 3) Generate Prisma client + migrate schema

```bash
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:migrate --name init
```

### 4) Chạy backend

```bash
pnpm --filter backend dev
```

## REST API mới

- `POST /auth/register`
- `POST /auth/login`
- `GET /users/:id`
- `GET /users/:id/matches?page=1&limit=10`
- `GET /matches/:matchId`

Lưu ý:

- Các route `/users/*` và `/matches/*` yêu cầu JWT Bearer token.
- Route auth cũ `/api/auth/*` vẫn hoạt động để tương thích integration test hiện tại.