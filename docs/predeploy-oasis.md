# SQUAREXO Predeploy Guide (Oasis Sapphire)

## 1) Smart Contract Security & Oasis-Specific Rules

### Security risks for GameFi/NFT-like game contracts
- Reentrancy: keep `nonReentrant` for payout/refund paths.
- Access control: separate `DEFAULT_ADMIN_ROLE` and backend signer role.
- Input validation: enforce room id bounds and strict bet constraints.
- Result finalization: enforce timeout windows to prevent stale settlement.
- Pull over push payouts: only winner/eligible users claim funds.

### Sapphire randomness note
- Prefer Sapphire native randomness APIs (off-chain backend can use Sapphire precompile-backed flow) over `block.timestamp`/`blockhash` logic.
- For SQUAREXO settlement, deterministic score-based winner is safer than pseudo-random winner choice.
- If randomness is introduced later (loot/NFT mint), define commit-reveal or Sapphire-native randomness flow, not Chainlink VRF assumptions.

### Sapphire precompile & private data design
- Keep secrets off public events.
- For encrypted data, use Sapphire confidential contract patterns and only expose encrypted payloads/events.
- Decryption should happen client-side with user consent, never by shipping private keys to backend.

### Upgradability policy
- Current escrow contract can stay non-upgradeable for reduced complexity and storage-risk.
- If upgradeability is required, use UUPS with:
  - strict storage layout management,
  - explicit migration tests,
  - role separation (upgrade admin != backend signer),
  - freeze/rollback runbook.

## 2) Frontend & Wallet UX (MetaMask first)

### Supported wallet posture
- Primary: MetaMask.
- Secondary compatibility target: Bitget Wallet, OKX Wallet (EVM mode).

### Network switch/add behavior
- App supports environment-driven network selection:
  - `VITE_OASIS_NETWORK=testnet` (Sapphire testnet, `0x5aff`)
  - `VITE_OASIS_NETWORK=mainnet` (Sapphire mainnet, `0x5afe`)
- On connect, app attempts `wallet_switchEthereumChain`, then `wallet_addEthereumChain` when needed.
- RPC fallback URLs can be supplied via `VITE_OASIS_RPC_FALLBACK_URLS`.

### Gas UX on Sapphire
- Always estimate in-wallet with clear ROSE balance display.
- Add user copy that TEE/privacy operations can increase gas and confirmation delay.
- Track pending tx > 30s and surface warning telemetry.

## 3) Backend & Indexing

### Backend safety controls
- Oasis env is validated (RPC URL, chain id, signer key format, contract address format).
- RPC failover supported via `OASIS_RPC_FALLBACK_URLS`.
- Chain-id guard rejects mismatched endpoint/network.
- Tx confirmation timeout is configurable (`BLOCKCHAIN_TX_TIMEOUT_MS`).

### Match history index strategy
- Fast path: backend DB history API (`/api/history`, `/api/history/sync`).
- Optional production hardening: require `HISTORY_SYNC_API_KEY` for sync endpoint.
- For analytics-grade indexing, add Subgraph/Oasis Scan integration as read model, not settlement source-of-truth.

### RPC fallback recommendation
- Keep at least 2 RPC URLs (primary + fallback).
- Use health checks and automatic failover at backend/provider level.

## 4) CI/CD & Staging Flow (Testnet -> Mainnet)

### Promotion flow
1. Deploy and verify on Sapphire testnet (`oasis-sapphire-testnet`).
2. Run full integration + contract security tests.
3. Soak test backend tx submission and timeout handling.
4. Deploy mainnet with production secrets from CI vault.

### Minimum automated checks
- `packages/contracts`: compile + security tests.
- `packages/backend`: build + tests.
- `packages/frontend`: build.
- Optional: dependency audit gate for high/critical CVEs.

### Key management
- Never store deployer/signer private keys in repository.
- Use CI secret manager + environment isolation.
- Rotate deployer/backend signer keys by runbook, with role re-grant scripts.

## 5) Auditor Submission Checklist
- Contract source + pinned compiler + optimization settings.
- Deployment params per environment (timeouts, signer roles, admin roles).
- Threat model: payout abuse, stale result, role compromise, RPC outage.
- Test evidence: timeout, unauthorized submit, payout one-time claim, pause behavior.
- Incident runbook: key compromise, RPC degradation, tx backlog > 30s.
