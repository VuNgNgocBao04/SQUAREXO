# SQUAREXO - Detailed Demo Script (Exact Commands)

## **PART 0: PRE-DEMO PREPARATION**

### Environment requirements
- **Node.js**: 20+ or 22 LTS (check with `node --version`)
- **pnpm**: 10.32.1+ (check with `pnpm --version`)
- **Docker Desktop**: running with Linux containers
- **MetaMask**: installed in two browsers or two separate profiles
- **Testnet ROSE tokens**: faucet at https://faucet.testnet.oasis.io

### Step 0.1: Clone the repo (if needed)
```bash
git clone https://github.com/VuNgNgocBao04/SQUAREXO.git
cd SQUAREXO
```

### Step 0.2: Install dependencies
From the SQUAREXO repository root:
```bash
pnpm install
```

---

## **PART 1: START THE DATABASE**

### Step 1.1: Start the PostgreSQL container
From the repository root:
```bash
docker compose up -d postgres
```

**Expected:**
- The `squarexo-postgres` container starts.
- Status becomes `healthy` after a few seconds.

**Kiểm tra:**
```bash
docker compose ps
```

You should see:
```
NAME                      STATUS
squarexo-postgres         healthy
```

### Step 1.2: Configure the database URL for the backend
In `packages/backend`, create a `.env` file:
```bash
cd packages/backend
```

Create the `.env` file with the following contents:
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

# Blockchain (if running with the contract)
OASIS_RPC_URL=https://testnet.sapphire.oasis.io
OASIS_RPC_FALLBACK_URLS=https://sapphire-testnet.gateway.tenderly.co,https://testnet.sapphire.oasis.dev
OASIS_EXPECTED_CHAIN_ID=23295
BLOCKCHAIN_TX_TIMEOUT_MS=45000
CONTRACT_ADDRESS=0x<contract_address_sau_khi_deploy>
BACKEND_SIGNER_PRIVATE_KEY=0x<private_key_sau_khi_deploy>
```

**Note**: `BACKEND_SIGNER_PRIVATE_KEY` is the private key for the wallet that submits game results on-chain, not the player's wallet.

### Step 1.3: Sync the Prisma schema
Still in `packages/backend`:
```bash
pnpm prisma:generate
pnpm prisma:push
```

**Expected:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "squarexo"
✓ Database synced with schema
```

---

## **PART 2: DEPLOY THE SMART CONTRACT (OPTIONAL)**

If you only want to test realtime + DB without blockchain, skip this section and go to **PART 3**.

### Step 2.1: Prepare the `.env` file for contracts
Go to `packages/contracts`:
```bash
cd ../contracts
```

Create the `.env` file:
```env
OASIS_RPC_URL=https://testnet.sapphire.oasis.io
OASIS_MAINNET_RPC_URL=https://sapphire.oasis.io
DEPLOYER_PRIVATE_KEY=0x<your_deployer_private_key>
BACKEND_SIGNER_ADDRESS=0x<address_cua_backend_signer>
MATCH_JOIN_TIMEOUT_SECONDS=900
MATCH_RESULT_TIMEOUT_SECONDS=3600
```

**Note**:
- `DEPLOYER_PRIVATE_KEY`: the private key of the wallet used to deploy the contract to testnet (requires ROSE tokens).
- `BACKEND_SIGNER_ADDRESS`: the address, not the private key, of the backend signer wallet.

### Step 2.2: Build the contract
```bash
pnpm build
```

**Expected:**
```
Compiling 7 files with 0.8.24
Solc 0.8.24 finished in 1.23s
```

### Step 2.3: Test the contract
```bash
pnpm test
```

**Expected:** All tests pass.

### Step 2.4: Deploy to Sapphire Testnet
```bash
pnpm deploy:testnet
```

**Expected:**
```
Deployed SquarexoMatch to 0x<contract_address>
```

**Record this contract address**, for example: `0xABC123...`

### Step 2.5: Update the backend with the contract address
Return to `packages/backend/.env` and add:
```env
CONTRACT_ADDRESS=0x<contract_address_vua_deploy>
BACKEND_SIGNER_PRIVATE_KEY=0x<backend_signer_private_key>
```

### Step 2.6: Update the frontend with the contract address
In `packages/frontend`, create a `.env` file:
```bash
cd ../frontend
```

Create a `.env` file:
```env
VITE_BACKEND_URL=http://localhost:3000
VITE_OASIS_NETWORK=testnet
VITE_OASIS_RPC_URL=https://testnet.sapphire.oasis.io
VITE_OASIS_RPC_FALLBACK_URLS=https://sapphire-testnet.gateway.tenderly.co,https://testnet.sapphire.oasis.dev
VITE_CONTRACT_ADDRESS=0x<contract_address_vua_deploy>
```

---

## **PART 3: START THE BACKEND**

From `packages/backend`:
```bash
pnpm dev
```

**Expected:**
```
[INFO] listening on port 3000
```

**The backend is ready**. Open a **new terminal** to continue.

---

## **PART 4: START THE FRONTEND**

Open a **new terminal** and move to `packages/frontend`:
```bash
cd packages/frontend
pnpm dev
```

**Expected:**
```
  VITE v5.4.21  ready in 234 ms

  ➜  Local:   http://localhost:5173/
```

Open the browser at `http://localhost:5173`

---

## **PART 5: LIVE DEMO - STEP BY STEP**

### **STEP 5.1: Log in on Browser 1**

**Actions:**
1. On the "Auth" screen, select the "LOGIN" tab.
2. Enter:
   - Username: `player1`
   - Password: `password123`
3. Click "Log In"

**Expected:**
- The app switches to the HOME screen.
- You see "Hello, player1".

---

### **STEP 5.2: Connect MetaMask Wallet - Browser 1**

**Actions:**
1. In browser 1 (Profile 1), open the MetaMask extension.
2. Select wallet A (with a ROSE balance).
3. Return to the SQUAREXO app.
4. Click the "Connect" button (in the BLOCKCHAIN/WALLET section).

**Expected:**
- MetaMask shows a connection prompt.
- After confirming, the app displays:
  - Address: `0xABC1...XYZ9` (wallet A).
  - Balance: `X.XXXX ROSE`.
  - The button changes to: `✓ Connected`.

---

### **STEP 5.3: Create a Room and Stake - Browser 1**

**Actions:**
1. Choose the mode: **PVP Online**.
2. Enter Stake (ROSE): `0.1` (or a suitable amount).
3. Click "Create Betting Room".

**Expected:**
- MetaMask popup signs the `createMatch` transaction.
- After confirmation:
  - Receive a room code, for example: `ABCD12`.
  - Switch to the "WAITING" screen.
  - Chat shows: "Room ABCD12 has been created. Share the code so the opponent can join."
  - Status: "1/2 players in the room".

---

### **STEP 5.4: Prepare Browser 2 (Second Wallet)**

**Actions:**
1. Open a **new browser** or a **new MetaMask profile** (with a different wallet B).
2. Go to the same URL: `http://localhost:5173`.
3. Sign in with a different username, for example: `player2` (password: `password123`).

**Expected:**
- Sign in succeeds on browser 2.

---

### **STEP 5.5: Connect MetaMask Wallet - Browser 2**

**Actions:**
1. Trên browser 2, mở MetaMask.
2. Select wallet B (a different wallet with ROSE balance).
3. Connect it to the app.

**Expected:**
- Wallet B appears on browser 2.

---

### **STEP 5.6: Join the Room - Browser 2**

**Actions:**
1. Select: **PVP Online > Join Room**.
2. Enter the room code: `ABCD12` (code from step 5.3).
3. Click "Join Room".

**Expected:**
- MetaMask popup requests a `joinMatch` signature.
- After confirmation:
  - Wallet B stake is locked.
  - Switch to the "WAITING" screen.
  - Both browsers show: "2/2 players in the room".
  - **The game starts automatically after 3 seconds** (countdown).
  - Both sides see the 3x3 board and the match begins.

---

### **STEP 5.7: Play the PvP Match**

**Actions:**
1. **Browser 1 (Player X)**: Click a horizontal or vertical line on the board to make a move.
  - You can only click lines that are still free.
  - After a move, the board **syncs automatically** to browser 2 in less than 1 second.

2. **Browser 2 (Player O)**: Wait for X to finish, then make the O move.
  - If you click before your turn, the app shows: "It is not your turn yet".

3. **Repeat** until one player has 5 boxes (on the 3x3 board, size 3x3).

**Expected:**
- Each move must be **received in real time from the server**.
- Chat can be used to test realtime messaging (optional).
- There is no desynchronization between the 2 browsers.

---

### **STEP 5.8: End the Match**

**Actions:**
- Continue playing until someone **captures 5 boxes or there are no moves left**.

**Expected:**
- The game ends automatically.
- The modal popup shows:
  - If Player X wins: "X WINS!"
  - If it is a draw: "DRAW!"
  - Also: "Writing the result to the blockchain..."
  - Shows the TxHash (if blockchain is enabled).
- **At this point, the backend automatically:**
  - Submits the result to the `submitResult()` contract method.
  - Saves the match to the database.
  - Emits the `match_settled` event to both clients.

---

### **STEP 5.9: Claim Reward (If Blockchain Is Enabled)**

**Actions:**
1. Wait for the modal to disappear (after the backend finishes submitting).
2. Click the "Claim Reward" button.

**Expected:**
- MetaMask popup signs `claimReward`.
- After confirmation:
  - Toast: "Claim reward succeeded: 0xABC123..."
  - The winning wallet receives the full pot (both stakes).
  - The losing wallet loses its stake (locked in `createMatch` / `joinMatch`).

---

### **STEP 5.10: Check History**

**Actions:**
1. Switch to the "HISTORY" tab on browser 1 (or browser 2).
2. Connect the wallet if it is not connected yet.

**Expected:**
- The match you just played appears in the list.
- Shows:
  - Grid size: 3x3
  - Mode: PVP
  - Scores: X vs O
  - Winner: Player X (or Draw)
  - Stake: 0.1 ROSE
  - Tx: 0xABC123...

---

### **STEP 5.11: Refresh the Browser to Check Persistence**

**Actions:**
1. Press `F5` to refresh browser 1.
2. Sign in again.
3. Reconnect the wallet.
4. Open the HISTORY tab.

**Expected:**
- The history is still there (from the database, not fragile localStorage).
- This proves the data was stored persistently.

---

## **SECTION 6: AI MODE DEMO (OPTIONAL)**

**Actions:**
1. From the HOME screen, choose "PvP vs AI".
2. Select a board size (3x3, 4x4, 5x5).
3. Select a stake (if blockchain is enabled) or skip it.
4. Click "Start New Match".

**Expected:**
- The board appears, and player X (you) goes first.
- After your move, the AI automatically responds (in less than 1 second).
- The game runs smoothly and the `game-core` logic works.

---

## **SECTION 7: CHECK BACKEND LOGS**

In the terminal running the backend (`pnpm dev`), you should see logs like:

```
[INFO] socket_connected { socketId: 'abc123' }
[INFO] join_room { roomId: 'ABCD12', playerId: 'player1', assignedPlayer: 'X' }
[INFO] make_move { roomId: 'ABCD12', edge: {...} }
[INFO] save_match_result { roomId: 'ABCD12', winner: 'X', txHash: '0x...' }
[INFO] blockchain_submit_result_success { roomId: 'ABCD12', txHash: '0x...' }
```

---

## **SECTION 8: CHECK THE DATABASE DIRECTLY (OPTIONAL)**

If you want to inspect the data in PostgreSQL:

### Connect to PostgreSQL from the terminal
```bash
psql -U squarexo -h localhost -p 55432 -d squarexo
```

### View the match list
```sql
SELECT id, "roomId", "playerXId", "playerOId", winner, "scoreX", "scoreO", "txHash" FROM "Match" ORDER BY "createdAt" DESC LIMIT 10;
```

### View the user list
```sql
SELECT id, username, email, "walletAddress", elo FROM "User" LIMIT 10;
```

### Exit
```sql
\q
```

---

## **SECTION 9: QUICK TROUBLESHOOTING**

### Backend error `P1001 Can't reach database`
```bash
# Check containers
docker compose ps

# If it is not running yet
docker compose up -d postgres

# If port 55432 is already in use
netstat -an | grep 55432  # Windows: netstat -ano | findstr :55432
```

### Frontend cannot connect to the backend
```bash
# Check that the backend is running
curl http://localhost:3000/health

# If you get 503, the backend is not ready or `DATABASE_URL` is wrong
```

### MetaMask does not switch chains
1. Check that `VITE_OASIS_NETWORK` = `testnet` (not `mainnet`).
2. Check the chain ID: testnet = `0x5aff`, mainnet = `0x5afe`.
3. Check that the RPC URL is valid.

### Transaction pending for too long
1. Check whether the signer/deployer has enough ROSE balance.
2. Check whether the primary RPC is congested and the fallback is working.
3. Check backend logs for `blockchain_submit_result_slow` or `blockchain_submit_result_failed`.

---

## **SECTION 10: END THE DEMO**

When you are done:

1. **Stop the Frontend**:
   ```bash
  # In the frontend terminal, press Ctrl+C
   ```

2. **Stop the Backend**:
   ```bash
  # In the backend terminal, press Ctrl+C
   ```

3. **Stop the Database** (optional):
   ```bash
  # From the repository root
   docker compose down

  # If you want to delete the volume (database data):
   docker compose down -v
   ```

---

## **SUCCESS CHECKLIST**

✅ PostgreSQL database starts and the schema is in sync
✅ Backend chạy trên http://localhost:3000
✅ Frontend chạy trên http://localhost:5173
✅ Two MetaMask wallets connect successfully
✅ Browser 1: room creation and staking succeed
✅ Browser 2: room join and staking succeed
✅ Both browsers sync the same board in real time
✅ At the end of the match, the backend submits the result on-chain
✅ The winner can claim the reward
✅ Match history displays correctly
✅ Refreshing the page still keeps the history data (persistent)

If everything is ✅, **DEMO PASS!**

---

## **ADDITIONAL NOTES**

- **Auth is currently mock-only**: Frontend auth still uses localStorage. If you want to test real auth, update the frontend to call the backend auth API.
- **Blockchain is optional**: If you do not deploy the contract, skip Section 2 and blockchain will not work, but realtime and the database will still work.
- **Realtime chat**: You can test it by sending messages between the 2 browsers in the waiting room or during a match.
- **History sync**: When you connect the wallet for the first time, the app syncs pending history from localStorage and pulls history from the server.
