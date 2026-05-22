# Local Setup

## 1) Prerequisites

- Node.js 22
- pnpm (through corepack)
- Docker and Docker Compose

## 2) Clone and Install Packages

```bash
git clone https://github.com/VuNgNgocBao04/SQUAREXO.git
cd SQUAREXO
corepack enable
pnpm install --fix-lockfile
```

> Note: the lockfile may not work with `--frozen-lockfile` because of the current repository state.

## 3) Start PostgreSQL

```bash
docker compose up -d postgres
docker compose ps
```

Local Postgres mapping: `localhost:55432 -> container:5432`.

## 4) Configure Env Files

### Backend

```bash
cp packages/backend/.env.example packages/backend/.env
```

Minimum required values:
- `JWT_SECRET` (at least 32 characters)
- `DATABASE_URL` pointing to port `55432`

### Frontend

```bash
cp packages/frontend/.env.example packages/frontend/.env
```

### Contracts

```bash
cp packages/contracts/.env.example packages/contracts/.env
```

## 5) Initialize Prisma

```bash
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:push
```

## 6) Run Development

### Option 1: Run the full workspace

```bash
pnpm dev
```

### Option 2: Split into two terminals

Terminal 1:
```bash
pnpm --filter backend dev
```

Terminal 2:
```bash
pnpm --filter frontend dev
```

## 7) Reference Build/Test Commands

```bash
pnpm --filter game-core test
pnpm --filter backend test
pnpm --filter backend build
pnpm --filter frontend build
pnpm --filter contracts test
```

There are currently some known baseline issues (see README `Known Issues`).

## 8) Optional Testnet Contract Deploy

```bash
pnpm --filter contracts build
pnpm --filter contracts test
pnpm --filter contracts deploy:testnet
```

After deployment, update:
- `packages/backend/.env` -> `CONTRACT_ADDRESS`, `BACKEND_SIGNER_PRIVATE_KEY`
- `packages/frontend/.env` -> `VITE_CONTRACT_ADDRESS`

## 9) Quick Backend Checks

```bash
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```
