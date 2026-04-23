# SQUAREXO - Kịch Bản Demo Chi Tiết (Từng Lệnh Cụ Thể)

## **PHẦN 0: CHUẨN BỊ TRƯỚC DEMO**

### Yêu cầu môi trường
- **Node.js**: 20+ hoặc 22 LTS (kiểm tra: `node --version`)
- **pnpm**: 10.32.1+ (kiểm tra: `pnpm --version`)
- **Docker Desktop**: đang chạy với Linux containers
- **MetaMask**: extension đã cài trên 2 trình duyệt hoặc 2 profile khác nhau
- **Testnet ROSE tokens**: Faucet từ https://faucet.testnet.oasis.io

### Bước 0.1: Clone repo (nếu chưa có)
```bash
git clone https://github.com/VuNgNgocBao04/SQUAREXO.git
cd SQUAREXO
```

### Bước 0.2: Cài dependencies
Từ thư mục gốc của SQUAREXO:
```bash
pnpm install
```

---

## **PHẦN 1: KHỞI ĐỘNG DATABASE**

### Bước 1.1: Khởi động PostgreSQL container
Từ thư mục gốc:
```bash
docker compose up -d postgres
```

**Kỳ vọng:**
- Container `squarexo-postgres` được khởi động.
- Status là `healthy` sau vài giây.

**Kiểm tra:**
```bash
docker compose ps
```

Bạn sẽ thấy:
```
NAME                      STATUS
squarexo-postgres         healthy
```

### Bước 1.2: Cấu hình Database URL cho Backend
Tại `packages/backend`, tạo file `.env`:
```bash
cd packages/backend
```

Tạo file `.env` với nội dung:
```env
DATABASE_URL=postgresql://squarexo:squarexo@localhost:55432/squarexo?schema=public
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
JWT_SECRET=your-secret-key-must-be-at-least-32-characters-long-12345
JWT_ISSUER=squarexo-backend
JWT_AUDIENCE=squarexo-clients
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# Blockchain (nếu chạy với contract)
OASIS_RPC_URL=https://testnet.sapphire.oasis.io
OASIS_RPC_FALLBACK_URLS=https://sapphire-testnet.gateway.tenderly.co,https://testnet.sapphire.oasis.dev
OASIS_EXPECTED_CHAIN_ID=23295
BLOCKCHAIN_TX_TIMEOUT_MS=45000
CONTRACT_ADDRESS=0x<contract_address_sau_khi_deploy>
BACKEND_SIGNER_PRIVATE_KEY=0x<private_key_sau_khi_deploy>
```

**Lưu ý**: `BACKEND_SIGNER_PRIVATE_KEY` là private key của ví sẽ submit kết quả game lên chain (không phải ví người chơi).

### Bước 1.3: Đồng bộ Prisma schema
Vẫn ở thư mục `packages/backend`:
```bash
pnpm prisma:generate
pnpm prisma:push
```

**Kỳ vọng:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "squarexo"
✓ Database synced with schema
```

---

## **PHẦN 2: DEPLOY SMART CONTRACT (TUỲ CHỌN)**

Nếu bạn chỉ muốn test realtime + DB mà không cần blockchain, bỏ qua phần này đến **PHẦN 3**.

### Bước 2.1: Chuẩn bị file `.env` cho contracts
Đi tới `packages/contracts`:
```bash
cd ../contracts
```

Tạo file `.env`:
```env
OASIS_RPC_URL=https://testnet.sapphire.oasis.io
OASIS_MAINNET_RPC_URL=https://sapphire.oasis.io
DEPLOYER_PRIVATE_KEY=0x<your_deployer_private_key>
BACKEND_SIGNER_ADDRESS=0x<address_cua_backend_signer>
MATCH_JOIN_TIMEOUT_SECONDS=900
MATCH_RESULT_TIMEOUT_SECONDS=3600
```

**Lưu ý**: 
- `DEPLOYER_PRIVATE_KEY`: Private key của ví deploy contract lên testnet (cần ROSE tokens).
- `BACKEND_SIGNER_ADDRESS`: Address (không phải private key) của ví backend signer.

### Bước 2.2: Build contract
```bash
pnpm build
```

**Kỳ vọng:**
```
Compiling 7 files with 0.8.24
Solc 0.8.24 finished in 1.23s
```

### Bước 2.3: Test contract
```bash
pnpm test
```

**Kỳ vọng:** Tất cả test pass.

### Bước 2.4: Deploy lên Sapphire Testnet
```bash
pnpm deploy:testnet
```

**Kỳ vọng:**
```
Deployed SquarexoMatch to 0x<contract_address>
```

**Ghi lại contract address này**, ví dụ: `0xABC123...`

### Bước 2.5: Cập nhật Backend với Contract Address
Quay lại `packages/backend/.env`, thêm:
```env
CONTRACT_ADDRESS=0x<contract_address_vua_deploy>
BACKEND_SIGNER_PRIVATE_KEY=0x<backend_signer_private_key>
```

### Bước 2.6: Cập nhật Frontend với Contract Address
Tại `packages/frontend`, tạo file `.env`:
```bash
cd ../frontend
```

Tạo file `.env`:
```env
VITE_BACKEND_URL=http://localhost:3000
VITE_OASIS_NETWORK=testnet
VITE_OASIS_RPC_URL=https://testnet.sapphire.oasis.io
VITE_OASIS_RPC_FALLBACK_URLS=https://sapphire-testnet.gateway.tenderly.co,https://testnet.sapphire.oasis.dev
VITE_CONTRACT_ADDRESS=0x<contract_address_vua_deploy>
```

---

## **PHẦN 3: KHỞI ĐỘNG BACKEND**

Từ thư mục `packages/backend`:
```bash
pnpm dev
```

**Kỳ vọng:**
```
[INFO] listening on port 3000
```

**Backend đã sẵn sàng**. Để chạy tiếp các bước sau, mở **terminal mới**.

---

## **PHẦN 4: KHỞI ĐỘNG FRONTEND**

Mở **terminal mới**, di chuyển tới `packages/frontend`:
```bash
cd packages/frontend
pnpm dev
```

**Kỳ vọng:**
```
  VITE v5.4.21  ready in 234 ms

  ➜  Local:   http://localhost:5173/
```

Mở browser đến `http://localhost:5173`

---

## **PHẦN 5: DEMO THỰC TẾ - BƯỚC CHI TIẾT**

### **BƯỚC 5.1: Đăng nhập trên Browser 1**

**Thao tác:**
1. Tại màn hình "Auth", chọn tab "LOGIN".
2. Nhập:
   - Username: `player1`
   - Password: `password123`
3. Bấm "Đăng Nhập"

**Kỳ vọng:**
- Chuyển sang màn hình HOME.
- Thấy dòng "Xin chào, player1".

---

### **BƯỚC 5.2: Kết nối Ví MetaMask - Browser 1**

**Thao tác:**
1. Trên browser 1 (Profile 1), mở MetaMask extension.
2. Chọn ví A (có ROSE balance).
3. Quay lại app SQUAREXO.
4. Bấm nút "Kết Nối" (trong phần BLOCKCHAIN/WALLET).

**Kỳ vọng:**
- MetaMask popup yêu cầu kết nối.
- Sau khi confirm, app hiển thị:
  - Address: `0xABC1...XYZ9` (ví A).
  - Balance: `X.XXXX ROSE`.
  - Nút đổi thành: `✓ Đã kết nối`.

---

### **BƯỚC 5.3: Tạo Phòng và Stake - Browser 1**

**Thao tác:**
1. Chọn chế độ: **PVP Online**.
2. Nhập Stake (ROSE): `0.1` (hoặc số tiền thích hợp).
3. Bấm "Tạo Phòng Cược".

**Kỳ vọng:**
- MetaMask popup ký giao dịch createMatch.
- Sau khi confirm:
  - Nhân được mã phòng, ví dụ: `ABCD12`.
  - Chuyển sang màn "WAITING".
  - Chat hiển thị: "Phòng ABCD12 đã được tạo. Chia sẻ mã để đối thủ tham gia."
  - Trạng thái: "1/2 người đã vào phòng".

---

### **BƯỚC 5.4: Chuẩn bị Browser 2 (Ví Thứ Hai)**

**Thao tác:**
1. Mở **browser mới** hoặc **profile mới** của MetaMask (với ví B khác).
2. Vào cùng URL: `http://localhost:5173`.
3. Đăng nhập với username khác, ví dụ: `player2` (password: `password123`).

**Kỳ vọng:**
- Đăng nhập thành công trên browser 2.

---

### **BƯỚC 5.5: Kết nối Ví MetaMask - Browser 2**

**Thao tác:**
1. Trên browser 2, mở MetaMask.
2. Chọn ví B (ví khác, cũng có ROSE balance).
3. Kết nối với app.

**Kỳ vọng:**
- Ví B hiển thị trên browser 2.

---

### **BƯỚC 5.6: Join Phòng - Browser 2**

**Thao tác:**
1. Chọn: **PVP Online > Join Phòng**.
2. Nhập mã phòng: `ABCD12` (mã từ bước 5.3).
3. Bấm "Tham Gia Phòng".

**Kỳ vọng:**
- MetaMask popup yêu cầu ký joinMatch.
- Sau khi confirm:
  - Ví B stake được lock.
  - Chuyển sang màn "WAITING".
  - Cả 2 browser đều hiển thị: "2/2 người đã vào phòng".
  - **Game bắt đầu tự động sau 3 giây** (countdown).
  - Cả 2 phía đều thấy board game 3x3 và lượt chơi bắt đầu.

---

### **BƯỚC 5.7: Chơi Ván PvP**

**Thao tác:**
1. **Browser 1 (Player X)**: Bấm vào đường ngang hoặc dọc trên board để đánh.
   - Chỉ có thể đánh đường chưa được chiếm.
   - Sau khi đánh, board sẽ **sync tự động** sang browser 2 trong < 1 giây.

2. **Browser 2 (Player O)**: Đợi nước của X hoàn tất, rồi đánh nước O.
   - Nếu bạn bấm khi chưa đến lượt, app sẽ báo lỗi: "Chưa tới lượt của bạn".

3. **Lặp lại** cho đến khi một người được 5 ô (trên board 3x3, kích thước 3x3).

**Kỳ vọng:**
- Mỗi nước đi phải **nhận realtime từ server**.
- Chat có thể gửi tin nhắn để kiểm tra realtime (tùy chọn).
- Không có bất đồng bộ giữa 2 browser.

---

### **BƯỚC 5.8: Kết Thúc Trận**

**Thao tác:**
- Tiếp tục chơi cho đến khi có người **chiếm 5 ô hoặc hết nước**.

**Kỳ vọng:**
- Game tự kết thúc.
- Popup modal hiển thị:
  - Nếu Player X thắng: "X THẮNG!"
  - Nếu hòa: "HÒA!"
  - Kèm theo: "Kết quả đang được ghi lên blockchain..."
  - Hiển thị TxHash (nếu enable blockchain).
- **Lúc này, backend tự động:**
  - Submit kết quả lên contract `submitResult()`.
  - Lưu match vào database.
  - Phát event `match_settled` về cả 2 client.

---

### **BƯỚC 5.9: Claim Reward (Nếu Enable Blockchain)**

**Thao tác:**
1. Chờ modal biến mất (lúc backend đã submit xong).
2. Bấm nút "Claim Reward".

**Kỳ vọng:**
- MetaMask popup ký claimReward.
- Sau khi confirm:
  - Toast: "Claim reward thành công: 0xABC123..."
  - Ví thắng nhận được toàn bộ pot (stake của cả 2).
  - Ví thua mất stake (đã lock ở createMatch/joinMatch).

---

### **BƯỚC 5.10: Kiểm Tra Lịch Sử**

**Thao tác:**
1. Chuyển sang tab "HISTORY" trên browser 1 (hoặc browser 2).
2. Connect wallet nếu chưa kết nối.

**Kỳ vọng:**
- Trận vừa chơi xuất hiện trong danh sách.
- Hiển thị:
  - Grid size: 3x3
  - Mode: PVP
  - Scores: X vs O
  - Winner: Player X (hoặc Draw)
  - Stake: 0.1 ROSE
  - Tx: 0xABC123...

---

### **BƯỚC 5.11: Refresh Browser để Kiểm Tra Persistence**

**Thao tác:**
1. Bấm `F5` để refresh browser 1.
2. Đăng nhập lại.
3. Kết nối ví lại.
4. Vào tab HISTORY.

**Kỳ vọng:**
- Lịch sử **vẫn còn** (từ database, không phải localStorage lỏng lẻo).
- Chứng minh dữ liệu đã lưu trữ bền vững.

---

## **PHẦN 6: DEMO CHẾ ĐỘ AI (TUỲ CHỌN)**

**Thao tác:**
1. Từ màn HOME, chọn "PvP vs AI".
2. Chọn kích thước board (3x3, 4x4, 5x5).
3. Chọn stake (nếu enable blockchain) hoặc bỏ qua.
4. Bấm "Bắt Đầu Ván Mới".

**Kỳ vọng:**
- Board hiển thị, player X (bạn) đi trước.
- Khi bạn đánh xong, AI tự động đánh (trong < 1 giây).
- Game chạy mượt, logic game-core hoạt động.

---

## **PHẦN 7: KIỂM TRA BACKEND LOGS**

Trong terminal chạy backend (`pnpm dev`), bạn sẽ thấy logs:

```
[INFO] socket_connected { socketId: 'abc123' }
[INFO] join_room { roomId: 'ABCD12', playerId: 'player1', assignedPlayer: 'X' }
[INFO] make_move { roomId: 'ABCD12', edge: {...} }
[INFO] save_match_result { roomId: 'ABCD12', winner: 'X', txHash: '0x...' }
[INFO] blockchain_submit_result_success { roomId: 'ABCD12', txHash: '0x...' }
```

---

## **PHẦN 8: KIỂM TRA DATABASE TRỰC TIẾP (TUỲ CHỌN)**

Nếu muốn xem dữ liệu trong PostgreSQL:

### Kết nối PostgreSQL từ terminal
```bash
psql -U squarexo -h localhost -p 55432 -d squarexo
```

### Xem danh sách match
```sql
SELECT id, "roomId", "playerXId", "playerOId", winner, "scoreX", "scoreO", "txHash" FROM "Match" ORDER BY "createdAt" DESC LIMIT 10;
```

### Xem danh sách user
```sql
SELECT id, username, email, "walletAddress", elo FROM "User" LIMIT 10;
```

### Thoát
```sql
\q
```

---

## **PHẦN 9: TROUBLESHOOT NHANH**

### Backend lỗi `P1001 Can't reach database`
```bash
# Kiểm tra container
docker compose ps

# Nếu chưa chạy
docker compose up -d postgres

# Nếu port 55432 bị chiếm
netstat -an | grep 55432  # Windows: netstat -ano | findstr :55432
```

### Frontend không kết nối backend
```bash
# Kiểm tra backend running
curl http://localhost:3000/health

# Nếu 503, backend chưa sẵn sàng hoặc DATABASE_URL sai
```

### MetaMask không switch chain
1. Kiểm tra `VITE_OASIS_NETWORK` = `testnet` (không phải `mainnet`).
2. Kiểm tra chain ID: testnet = `0x5aff`, mainnet = `0x5afe`.
3. Kiểm tra RPC URL có hợp lệ.

### Transaction pending lâu
1. Kiểm tra ROSE balance signer/deployer đủ không.
2. Kiểm tra RPC chính có bị nghẽn, fallback có hoạt động.
3. Xem backend logs để tìm `blockchain_submit_result_slow` hoặc `blockchain_submit_result_failed`.

---

## **PHẦN 10: KẾT THÚC DEMO**

Khi hoàn tất:

1. **Dừng Frontend**:
   ```bash
   # Ở terminal chạy frontend, bấm Ctrl+C
   ```

2. **Dừng Backend**:
   ```bash
   # Ở terminal chạy backend, bấm Ctrl+C
   ```

3. **Dừng Database** (tuỳ chọn):
   ```bash
   # Từ thư mục gốc
   docker compose down

   # Nếu muốn xóa volume (DB data):
   docker compose down -v
   ```

---

## **CHECKLIST DEMO THÀNH CÔNG**

✅ Database PostgreSQL khởi động, schema đồng bộ
✅ Backend chạy trên http://localhost:3000
✅ Frontend chạy trên http://localhost:5173
✅ 2 ví MetaMask kết nối thành công
✅ Browser 1: Tạo phòng, stake thành công
✅ Browser 2: Join phòng, stake thành công
✅ 2 browser sync realtime cùng board game
✅ Kết thúc trận, backend submit kết quả lên chain
✅ Người thắng claim reward được
✅ Lịch sử trận hiển thị chính xác
✅ Refresh page vẫn có dữ liệu lịch sử (persistent)

Nếu tất cả ✅, **DEMO PASS!**

---

## **NOTES THÊM**

- **Auth hiện chỉ là mock**: Frontend auth vẫn dùng localStorage. Nếu muốn test auth thực, cần cập nhật frontend để gọi backend API auth.
- **Blockchain tuỳ chọn**: Nếu không deploy contract, bỏ qua PHẦN 2 và blockchain sẽ không hoạt động, nhưng realtime + database vẫn work.
- **Chat realtime**: Bạn có thể test bằng cách gửi tin nhắn giữa 2 browser trong phòng chờ hoặc trong ván đấu.
- **History sync**: Khi connect wallet lần đầu, app sẽ đồng bộ lịch sử pending từ localStorage và pull history từ server về.
