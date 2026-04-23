# SQUAREXO - QUICK START (Chỉ Lệnh, Không Giải Thích)

## **1. CHUẨN BỊ MÔI TRƯỜNG**
```bash
git clone https://github.com/VuNgNgocBao04/SQUAREXO.git
cd SQUAREXO
pnpm install
docker compose up -d postgres
docker compose ps  # Verify postgres is healthy
```

## **2. CẤU HÌNH & SETUP DATABASE**
```bash
cd packages/backend

# Tạo .env với nội dung bên dưới
cat > .env << 'EOF'
DATABASE_URL=postgresql://squarexo:squarexo@localhost:55432/squarexo?schema=public
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
JWT_SECRET=your-secret-key-must-be-at-least-32-characters-long-123456789
JWT_ISSUER=squarexo-backend
JWT_AUDIENCE=squarexo-clients
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d
OASIS_RPC_URL=https://testnet.sapphire.oasis.io
OASIS_RPC_FALLBACK_URLS=https://sapphire-testnet.gateway.tenderly.co,https://testnet.sapphire.oasis.dev
OASIS_EXPECTED_CHAIN_ID=23295
BLOCKCHAIN_TX_TIMEOUT_MS=45000
CONTRACT_ADDRESS=0x  # Thêm sau khi deploy
BACKEND_SIGNER_PRIVATE_KEY=0x  # Thêm sau khi deploy
EOF

pnpm prisma:generate
pnpm prisma:push
```

## **3. DEPLOY CONTRACT (TUỲ CHỌN - NẾU CÓ TESTNET ROSE)**
```bash
cd ../contracts

# Tạo .env
cat > .env << 'EOF'
OASIS_RPC_URL=https://testnet.sapphire.oasis.io
OASIS_MAINNET_RPC_URL=https://sapphire.oasis.io
DEPLOYER_PRIVATE_KEY=0x<your_deployer_key>
BACKEND_SIGNER_ADDRESS=0x<backend_signer_address>
MATCH_JOIN_TIMEOUT_SECONDS=900
MATCH_RESULT_TIMEOUT_SECONDS=3600
EOF

pnpm build
pnpm test
pnpm deploy:testnet

# Ghi lại contract address được output
# Cập nhật lại packages/backend/.env với CONTRACT_ADDRESS và BACKEND_SIGNER_PRIVATE_KEY
```

## **4. CẤU HÌNH FRONTEND**
```bash
cd ../frontend

cat > .env << 'EOF'
VITE_BACKEND_URL=http://localhost:3000
VITE_OASIS_NETWORK=testnet
VITE_OASIS_RPC_URL=https://testnet.sapphire.oasis.io
VITE_OASIS_RPC_FALLBACK_URLS=https://sapphire-testnet.gateway.tenderly.co,https://testnet.sapphire.oasis.dev
VITE_CONTRACT_ADDRESS=0x<contract_address_from_deploy>
EOF
```

## **5. KHỞI ĐỘNG BACKEND (TERMINAL 1)**
```bash
cd packages/backend
pnpm dev

# Output: [INFO] listening on port 3000
```

## **6. KHỞI ĐỘNG FRONTEND (TERMINAL 2 - MỚI)**
```bash
cd packages/frontend
pnpm dev

# Output: Local: http://localhost:5173/
```

## **7. DEMO TRÊN BROWSER**

### 7.1 Mở Browser 1
- URL: `http://localhost:5173`
- Đăng nhập: username=`player1`, password=`password123`
- Kết nối ví A (MetaMask Profile 1)
- Chọn PVP Online → Nhập stake 0.1 ROSE → Bấm "Tạo Phòng Cược"
- Ghi nhớ mã phòng (ví dụ: `ABCD12`)

### 7.2 Mở Browser 2 (Profile/Ví khác)
- URL: `http://localhost:5173`
- Đăng nhập: username=`player2`, password=`password123`
- Kết nối ví B (MetaMask Profile 2)
- Chọn PVP Online → Join Phòng → Nhập mã `ABCD12` → Bấm "Tham Gia Phòng"

### 7.3 Chơi Game
- Browser 1 (Player X): Bấm vào đường trên board
- Browser 2 (Player O): Chờ sync → Bấm vào đường khác
- Lặp lại cho đến khi có người được 5 ô

### 7.4 Kết Thúc & Claim Reward
- Game kết thúc, modal hiển thị kết quả
- Người thắng bấm "Claim Reward" để nhận pot

### 7.5 Kiểm Tra History
- Chuyển sang tab "HISTORY"
- Trận vừa chơi sẽ hiển thị trong danh sách

## **8. DỪNG DEMO**
```bash
# Terminal chạy Frontend: Ctrl+C
# Terminal chạy Backend: Ctrl+C
# (Tuỳ chọn) Dừng Database: docker compose down
```

---

## **KIỂM TRA NHANH**

### Backend sẵn sàng?
```bash
curl http://localhost:3000/health
```

### Database sẵn sàng?
```bash
docker compose ps
```

### Reset Database (nếu cần)
```bash
# Từ thư mục gốc
docker compose down -v
docker compose up -d postgres
cd packages/backend && pnpm prisma:push
```

---

## **NOTES**

- **Mà hình 1**: Không có contract address trong `.env` → blockchain features vô hiệu hóa, nhưng realtime + DB vẫn work
- **Mà hình 2** (Có contract): Demo toàn bộ tính năng kể cả on-chain settlement
- **Auth hiện tại**: Mock localStorage. Backend auth API đã có ở `/api/auth/*`
- **History**: Lưu vào PostgreSQL, persist sau khi reload page
