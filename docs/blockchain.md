# SQUAREXO Blockchain Flow (Oasis Sapphire)

## 1) Muc tieu

Tich hop Oasis Sapphire de xu ly stake va settlement minh bach cho cac tran dau online:

- Nguoi choi ket noi vi (MetaMask/WalletConnect provider EVM).
- Tao phong / vao phong bat buoc lock stake on-chain.
- Backend signer submit ket qua tran dau len contract sau khi game ket thuc.
- Nguoi thang (hoac ca hai ben neu hoa timeout) tu claim reward.

## 2) Kien truc

### On-chain (SquarexoMatch.sol)

Contract o `packages/contracts/contracts/SquarexoMatch.sol` quan ly:

- `createMatch(roomId, betAmount)` + `msg.value == betAmount`
- `joinMatch(roomId)` + `msg.value == betAmount`
- `submitResult(roomId, winner)` (chi `BACKEND_SIGNER_ROLE`)
- `claimReward(roomId)`
- `cancelUnjoinedMatch(roomId)`
- `forceDrawOnTimeout(roomId)`

### Off-chain

- Backend van giu game logic va anti-cheat qua Socket.IO.
- Khi tran ket thuc trong `socket/handler.ts`, backend goi `blockchainService.submitResult(...)`.
- Frontend lang nghe event socket `match_settled` de cap nhat UI tx hash.

## 3) Bien moi truong

### Backend (`packages/backend/.env`)

- `OASIS_RPC_URL`
- `BACKEND_SIGNER_PRIVATE_KEY`
- `CONTRACT_ADDRESS`

### Frontend (`packages/frontend/.env`)

- `VITE_BACKEND_URL`
- `VITE_OASIS_RPC_URL`
- `VITE_CONTRACT_ADDRESS`

### Contracts (`packages/contracts/.env`)

- `DEPLOYER_PRIVATE_KEY`
- `BACKEND_SIGNER_ADDRESS`
- `OASIS_RPC_URL`
- `OASIS_MAINNET_RPC_URL`
- `MATCH_JOIN_TIMEOUT_SECONDS`
- `MATCH_RESULT_TIMEOUT_SECONDS`

## 4) Deploy testnet

1. Cai dependencies:

```bash
pnpm install
```

1. Build contract:

```bash
pnpm --filter contracts build
```

1. Deploy len Sapphire testnet:

```bash
pnpm --filter contracts deploy:testnet
```

1. Lay contract address vua deploy, cap nhat vao:

- `packages/backend/.env`
- `packages/frontend/.env`

## 5) Luong end-to-end

1. User connect wallet tren frontend.
2. Khi tao phong: frontend goi `createMatch(roomId, stake)`.
3. Khi vao phong: frontend goi `joinMatch(roomId)`.
4. Sau khi tran ket thuc: backend submit ket qua qua `submitResult(roomId, winnerWallet)`.
5. Frontend nhan `match_settled` va hien thi tx hash.
6. Winner bam `Claim Reward On-chain`.

## 6) Bao mat

- Khong hard-code private key trong code.
- `BACKEND_SIGNER_PRIVATE_KEY` chi nam trong server env.
- Role `BACKEND_SIGNER_ROLE` duoc cap rieng, co the rotate signer bang admin wallet.
- Neu blockchain tam thoi loi, backend van luu ket qua tran o DB de khong mat du lieu.

## 7) Mainnet rollout checklist

- Test day du edge-cases tren Sapphire testnet.
- Review gas + timeout values.
- Audit role management (`DEFAULT_ADMIN_ROLE`, `BACKEND_SIGNER_ROLE`).
- Deploy mainnet qua `pnpm --filter contracts deploy:mainnet` voi env mainnet.
