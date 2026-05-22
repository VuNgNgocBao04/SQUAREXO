# SQUAREXO Co-Coding Guide: Database + Blockchain (Oasis Sapphire)

## 1. Guide Goals
- Keep local and staging workflows consistent for the co-coding team.
- Avoid common mistakes such as the wrong DB port, wrong chain, invalid private key format, or long-pending transactions.
- Keep the pre-deploy process stable before moving to Oasis Mainnet.

## 2. Environment Setup
- Node.js: 20+ or 22 LTS.
- pnpm: use the workspace lockfile.
- Docker Desktop: enable Linux containers.
- Test wallet: MetaMask.
- Test ROSE faucet: for Sapphire Testnet.

Install dependencies from the repository root:
```bash
pnpm install
```

## 3. Database with Docker (PostgreSQL)

### 3.1 Start the DB
From the repository root:
```bash
docker compose up -d postgres
docker compose ps
```

Expected:
- Container `squarexo-postgres` ở trạng thái `healthy`.
- Host port mapping: `55432 -> 5432`.

### 3.2 Backend environment variables
Trong `packages/backend/.env`:
```env
DATABASE_URL=postgresql://squarexo:squarexo@localhost:55432/squarexo?schema=public
```

### 3.3 Sync the Prisma schema
```bash
cd packages/backend
pnpm prisma:generate
pnpm prisma:push
```

If you use migration files (when the team has created the `prisma/migrations` directory):
```bash
pnpm prisma:migrate:deploy
```

### 3.4 Quick DB connectivity check
```bash
pnpm build
```
If you want to reset the local DB:
```bash
docker compose down -v
docker compose up -d postgres
cd packages/backend && pnpm prisma:push
```

## 4. Oasis Sapphire Integration (Backend)

### 4.1 Important environment variables
Trong `packages/backend/.env`:
```env
OASIS_RPC_URL=https://testnet.sapphire.oasis.io
OASIS_RPC_FALLBACK_URLS=https://sapphire-testnet.gateway.tenderly.co,https://testnet.sapphire.oasis.dev
OASIS_EXPECTED_CHAIN_ID=23295
BACKEND_SIGNER_PRIVATE_KEY=0x<64_hex_chars>
CONTRACT_ADDRESS=0x<40_hex_address>
BLOCKCHAIN_TX_TIMEOUT_MS=45000
HISTORY_SYNC_API_KEY=<min_24_chars_optional>
```

Security notes:
- Do not commit private keys to git.
- Store keys in a CI/CD secret manager.
- Keep the deployer key and backend signer key separate.

### 4.2 Existing failover and safety mechanisms
- RPC fallback: thử nhiều endpoint.
- Chain guard: reject nếu chainId không đúng.
- Tx timeout guard: fail-fast nếu chờ xác nhận quá lâu.
- Slow tx warning: log cảnh báo nếu tx > 30 giây.

## 5. Frontend + MetaMask (Sapphire Testnet/Mainnet)

### 5.1 Frontend env configuration
Trong `packages/frontend/.env`:
```env
VITE_BACKEND_URL=http://localhost:3000
VITE_OASIS_NETWORK=testnet
VITE_OASIS_RPC_URL=https://testnet.sapphire.oasis.io
VITE_OASIS_RPC_FALLBACK_URLS=https://sapphire-testnet.gateway.tenderly.co,https://testnet.sapphire.oasis.dev
VITE_CONTRACT_ADDRESS=0x<deployed_contract_address>
```

### 5.2 Wallet behavior
- App tự `wallet_switchEthereumChain`.
- Nếu chưa có network, app tự `wallet_addEthereumChain`.
- Theo dõi `accountsChanged` và `chainChanged` để refresh state.

## 6. Deploy the contract to Oasis

### 6.1 Prepare the contracts env file
Trong `packages/contracts/.env`:
```env
OASIS_RPC_URL=https://testnet.sapphire.oasis.io
OASIS_MAINNET_RPC_URL=https://sapphire.oasis.io
DEPLOYER_PRIVATE_KEY=0x<64_hex_chars>
BACKEND_SIGNER_ADDRESS=0x<40_hex_address>
MATCH_JOIN_TIMEOUT_SECONDS=900
MATCH_RESULT_TIMEOUT_SECONDS=3600
```

### 6.2 Build and test
```bash
cd packages/contracts
pnpm build
pnpm test
```

### 6.3 Deploy
Testnet:
```bash
pnpm deploy:testnet
```
Mainnet:
```bash
pnpm deploy:mainnet
```

After deployment:
- Record the contract address.
- Update `CONTRACT_ADDRESS` in the backend and `VITE_CONTRACT_ADDRESS` in the frontend.
- Verify end-to-end result submission from the backend.

## 7. Quick troubleshooting runbook

### 7.1 Prisma error `P1001 Can't reach database`
Checklist:
1. `docker compose ps` có healthy không.
2. `DATABASE_URL` có đúng `localhost:55432` không.
3. Port 55432 có bị process khác chiếm không.

### 7.2 MetaMask reports the wrong network
Checklist:
1. `VITE_OASIS_NETWORK` đúng (`testnet` hoặc `mainnet`).
2. RPC URL hợp lệ.
3. ChainId đúng: testnet `0x5aff`, mainnet `0x5afe`.

### 7.3 Transactions pending too long or failing
Checklist:
1. ROSE balance signer đủ không.
2. RPC chính có nghẽn không, fallback có hoạt động không.
3. Kiểm tra log backend với sự kiện `blockchain_submit_result_slow` và `blockchain_submit_result_failed`.

## 8. Pre-deploy checklist before mainnet
- Backend build pass.
- Frontend build pass.
- Contract tests pass.
- DB schema push/migrate pass trên staging DB.
- Wallet connect + create/join/submit/claim chạy end-to-end trên Sapphire testnet.
- Secrets nằm ở CI vault, không ở source control.
- Có alert cho tx pending > 30s.

## 9. Suggested team co-coding process
1. Pull the latest working branch.
2. `pnpm install`.
3. `docker compose up -d postgres`.
4. `cd packages/backend && pnpm prisma:push`.
5. Run build and test commands for each package.
6. Merge only after all checks pass.
