
## Database Setup (PostgreSQL + Prisma)

### 1) Run PostgreSQL locally with Docker

```bash
docker compose up -d
```

Default local database settings:

- user: `squarexo`
- password: `squarexo`
- db: `squarexo`
- port: `5432`

### 2) Configure backend environment variables

Tạo file `packages/backend/.env` từ `packages/backend/.env.example` và đảm bảo có:

```env
DATABASE_URL=postgresql://squarexo:squarexo@localhost:5432/squarexo?schema=public
JWT_SECRET=your-super-secret-key-here-at-least-32-characters-long
JWT_EXPIRES_IN=7d
```

### 3) Generate the Prisma client and migrate the schema

```bash
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:migrate --name init
```

### 4) Run the backend

```bash
pnpm --filter backend dev
```

## New REST API

- `POST /auth/register`
- `POST /auth/login`
- `GET /users/:id`
- `GET /users/:id/matches?page=1&limit=10`
- `GET /matches/:matchId`

Notes:

- The `/users/*` and `/matches/*` routes require a JWT bearer token.
- The legacy auth route `/api/auth/*` still works for compatibility with the current integration tests.