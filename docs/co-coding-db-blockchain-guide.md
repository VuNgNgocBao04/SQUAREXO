# SQUAREXO Co-Coding Guide: Database + Blockchain (Oasis Sapphire)

## 1. Mục tiêu guide
- Đồng bộ cách chạy local/staging cho team co-coding.
- Tránh lỗi phổ biến: sai port DB, sai chain, sai private key format, tx pending lâu.
- Đảm bảo quy trình predeploy ổn định trước khi lên Oasis Mainnet.

## 2. Chuẩn bị môi trường
- Node.js: 20+ hoặc 22 LTS.
- pnpm: theo workspace lockfile.
- Docker Desktop: bật Linux containers.
- Ví test: MetaMask.
- Faucet test ROSE: dùng cho Sapphire Testnet.

Cài dependencies từ root:
```bash
pnpm install
```

## 3. Database với Docker (PostgreSQL)

### 3.1 Khởi động DB
Từ root repository:
```bash
docker compose up -d postgres
docker compose ps
```

Kỳ vọng:
- Container `squarexo-postgres` ở trạng thái `healthy`.
- Host port mapping: `55432 -> 5432`.

### 3.2 Biến môi trường backend
Trong `packages/backend/.env`:
```env
DATABASE_URL=postgresql://squarexo:squarexo@localhost:55432/squarexo?schema=public
```

### 3.3 Đồng bộ schema Prisma
```bash
cd packages/backend
pnpm prisma:generate
pnpm prisma:push
```

Nếu dùng migration files (khi team đã tạo thư mục `prisma/migrations`):
```bash
pnpm prisma:migrate:deploy
```

### 3.4 Kiểm tra nhanh DB kết nối
```bash
pnpm build
```
Nếu muốn reset DB local:
```bash
docker compose down -v
docker compose up -d postgres
cd packages/backend && pnpm prisma:push
```

## 4. Oasis Sapphire integration (Backend)

### 4.1 Biến môi trường quan trọng
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

Lưu ý security:
- Không commit private key lên git.
- Key phải dùng secret manager ở CI/CD.
- Nên tách deployer key và backend signer key.

### 4.2 Cơ chế failover + an toàn đã có
- RPC fallback: thử nhiều endpoint.
- Chain guard: reject nếu chainId không đúng.
- Tx timeout guard: fail-fast nếu chờ xác nhận quá lâu.
- Slow tx warning: log cảnh báo nếu tx > 30 giây.

## 5. Frontend + MetaMask (Sapphire Testnet/Mainnet)

### 5.1 Cấu hình env frontend
Trong `packages/frontend/.env`:
```env
VITE_BACKEND_URL=http://localhost:3000
VITE_OASIS_NETWORK=testnet
VITE_OASIS_RPC_URL=https://testnet.sapphire.oasis.io
VITE_OASIS_RPC_FALLBACK_URLS=https://sapphire-testnet.gateway.tenderly.co,https://testnet.sapphire.oasis.dev
VITE_CONTRACT_ADDRESS=0x<deployed_contract_address>
```

### 5.2 Hành vi ví
- App tự `wallet_switchEthereumChain`.
- Nếu chưa có network, app tự `wallet_addEthereumChain`.
- Theo dõi `accountsChanged` và `chainChanged` để refresh state.

## 6. Deploy contract lên Oasis

### 6.1 Chuẩn bị env contracts
Trong `packages/contracts/.env`:
```env
OASIS_RPC_URL=https://testnet.sapphire.oasis.io
OASIS_MAINNET_RPC_URL=https://sapphire.oasis.io
DEPLOYER_PRIVATE_KEY=0x<64_hex_chars>
BACKEND_SIGNER_ADDRESS=0x<40_hex_address>
MATCH_JOIN_TIMEOUT_SECONDS=900
MATCH_RESULT_TIMEOUT_SECONDS=3600
```

### 6.2 Build + test
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

Sau deploy:
- Ghi lại contract address.
- Cập nhật `CONTRACT_ADDRESS` backend + `VITE_CONTRACT_ADDRESS` frontend.
- Kiểm tra submit result end-to-end từ backend.

## 7. Runbook troubleshoot nhanh

### 7.1 Prisma lỗi `P1001 Can't reach database`
Checklist:
1. `docker compose ps` có healthy không.
2. `DATABASE_URL` có đúng `localhost:55432` không.
3. Port 55432 có bị process khác chiếm không.

### 7.2 MetaMask báo sai network
Checklist:
1. `VITE_OASIS_NETWORK` đúng (`testnet` hoặc `mainnet`).
2. RPC URL hợp lệ.
3. ChainId đúng: testnet `0x5aff`, mainnet `0x5afe`.

### 7.3 Tx pending lâu hoặc fail
Checklist:
1. ROSE balance signer đủ không.
2. RPC chính có nghẽn không, fallback có hoạt động không.
3. Kiểm tra log backend với sự kiện `blockchain_submit_result_slow` và `blockchain_submit_result_failed`.

## 8. Checklist predeploy trước mainnet
- Backend build pass.
- Frontend build pass.
- Contract tests pass.
- DB schema push/migrate pass trên staging DB.
- Wallet connect + create/join/submit/claim chạy end-to-end trên Sapphire testnet.
- Secrets nằm ở CI vault, không ở source control.
- Có alert cho tx pending > 30s.

## 9. Quy trình team co-coding đề xuất
1. Pull latest branch làm việc.
2. `pnpm install`.
3. `docker compose up -d postgres`.
4. `cd packages/backend && pnpm prisma:push`.
5. Chạy build/test từng package.
6. Chỉ merge khi pass toàn bộ checks.
