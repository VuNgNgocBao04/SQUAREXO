# Contributing

This document captures the contribution workflow that matches the current workspace structure.

## 1. Environment Requirements

- Node.js 22 (the CI workflow uses Node 22)
- pnpm
- Docker (to run local Postgres)

## 2. Setup

```bash
corepack enable
docker compose up -d postgres
pnpm install --fix-lockfile
```

Create `.env` files from the examples:

- `packages/backend/.env.example`
- `packages/frontend/.env.example`
- `packages/contracts/.env.example`

Initialize the backend database:

```bash
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:push
```

## 3. Branch and Commit Rules

- Create branches from the current working branch using a change prefix such as `feat/*`, `fix/*`, or `docs/*`.
- Keep commits small and scoped clearly.
- Do not mix unrelated changes into the same PR.

## 4. Package Workflow

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

### Game Core

```bash
pnpm --filter game-core test
```

## 5. PR Checklist

Run at least the commands relevant to the area you changed:

```bash
pnpm --filter game-core test
pnpm --filter backend test
pnpm --filter backend build
pnpm --filter frontend build
pnpm --filter contracts test
```

Current repository notes:
- Backend build is failing because of a duplicate export in `socket/handler.ts`.
- Frontend build is failing because `GameCanvas.tsx` and `gameCanvas.tsx` differ only by casing.

If your PR does not address these baseline issues, mention them clearly in the PR description so reviewers can separate them from new regressions.

## 6. When DB/Prisma Changes

- Update `packages/backend/prisma/schema.prisma`
- Run `prisma:generate`
- Run `prisma:push` for local development or `prisma:migrate` when you need a migration script
- Re-test the affected routes or services

## 7. When Contract Changes

- Update the contract and its Hardhat tests
- Recompile and run security tests
- If you deploy a new version, update the contract address in backend/frontend env files
- Do not commit private keys or secrets

## 8. Review Focus

When reviewing a PR, prioritize checking:
- realtime sync state (turns, deduplication, reconnects)
- auth token flow and middleware
- compatibility between `game-core` and the backend adapter
- error handling when blockchain config is missing or txs time out
