# SQUAREXO - QUICK START (Commands Only, No Explanations)

## **1. PREPARE THE ENVIRONMENT**
```bash
git clone https://github.com/VuNgNgocBao04/SQUAREXO.git
cd SQUAREXO
pnpm install
docker compose up -d postgres
docker compose ps  # Verify postgres is healthy
```

## **2. CONFIGURE AND SET UP THE DATABASE**
```bash
cd packages/backend

# Create `.env` with the contents below
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
CONTRACT_ADDRESS=0x  # Add after deployment
BACKEND_SIGNER_PRIVATE_KEY=0x  # Add after deployment
EOF

pnpm prisma:generate
pnpm prisma:push
```

## **3. DEPLOY THE CONTRACT (OPTIONAL - IF YOU HAVE TESTNET ROSE)**
```bash
cd ../contracts

# Create `.env`
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

# Record the contract address that is output
# Update `packages/backend/.env` with `CONTRACT_ADDRESS` and `BACKEND_SIGNER_PRIVATE_KEY`
```

## **4. CONFIGURE THE FRONTEND**
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

## **5. START THE BACKEND (TERMINAL 1)**
```bash
cd packages/backend
pnpm dev

# Output: [INFO] listening on port 3000
```

## **6. START THE FRONTEND (TERMINAL 2 - NEW)**
```bash
cd packages/frontend
pnpm dev

# Output: Local: http://localhost:5173/
```

## **7. DEMO IN THE BROWSER**

### 7.1 Open Browser 1
- URL: `http://localhost:5173`
- Log in with username=`player1`, password=`password123`
- Connect wallet A (MetaMask Profile 1)
- Choose PVP Online -> enter a 0.1 ROSE stake -> click "Create Bet Room"
- Note the room code (for example: `ABCD12`)

### 7.2 Open Browser 2 (different profile/wallet)
- URL: `http://localhost:5173`
- Log in with username=`player2`, password=`password123`
- Connect wallet B (MetaMask Profile 2)
- Choose PVP Online -> Join Room -> enter `ABCD12` -> click "Join Room"

### 7.3 Play the Game
- Browser 1 (Player X): click a line on the board
- Browser 2 (Player O): wait for sync -> click another line
- Repeat until one player gets 5 boxes

### 7.4 Finish and Claim Reward
- The game ends and a modal shows the result
- The winner clicks "Claim Reward" to receive the pot

### 7.5 Check History
- Switch to the "HISTORY" tab
- The match you just played will appear in the list

## **8. STOP THE DEMO**
```bash
# Terminal chạy Frontend: Ctrl+C
# Terminal chạy Backend: Ctrl+C
# (Optional) Stop the database: docker compose down
```

---

## **QUICK CHECKS**

### Is the backend ready?
```bash
curl http://localhost:3000/health
```

### Is the database ready?
```bash
docker compose ps
```

### Reset the database (if needed)
```bash
# From the repository root
docker compose down -v
docker compose up -d postgres
cd packages/backend && pnpm prisma:push
```

---

## **NOTES**

- **Scenario 1**: No contract address in `.env` -> blockchain features are disabled, but realtime and DB still work
- **Scenario 2** (contract configured): Demo all features, including on-chain settlement
- **Current auth**: Mocked with localStorage. Backend auth API is available at `/api/auth/*`
- **History**: Stored in PostgreSQL and persists after page reloads
