# Blockchain Integration Preparation (No Implementation Yet)

## Scope
This document defines pre-integration tasks before coding blockchain logic for SQUAREXO.

## 1) Network & Contract Baseline
- Target chain: Oasis Sapphire Testnet first, then Mainnet.
- Contract modules to define:
  - `MatchRegistry`: create/join/close match metadata.
  - `StakeVault`: lock stake and payout winner.
  - `MatchSettlement`: validate final score and settlement rules.
- Contract versioning policy:
  - Immutable release tags: `v1`, `v2`.
  - ABI changes must be backward-compatible where possible.

## 2) Environment Variables (Preparation)
Backend/Frontend should reserve these env keys:
- `CHAIN_NETWORK`
- `CHAIN_RPC_URL`
- `CHAIN_CHAIN_ID`
- `SQUAREXO_CONTRACT_ADDRESS`
- `SQUAREXO_TREASURY_ADDRESS`
- `BLOCK_CONFIRMATIONS_REQUIRED`
- `TX_TIMEOUT_MS`

## 3) Off-chain / On-chain Responsibility Split
- Off-chain (backend):
  - Matchmaking, realtime socket sync, anti-spam checks, telemetry.
- On-chain:
  - Stake locking, payout rules, verifiable settlement event log.
- Shared integrity:
  - Match ID, player addresses, final score hash, settlement tx hash.

## 4) Security Preparation Checklist
- Verify wallet ownership by signature challenge (`nonce + expiry`).
- Enforce replay protection for signed payloads.
- Maintain server-side nonce store with TTL.
- Add rate limits for wallet auth endpoints.
- Define emergency pause strategy for contract and backend operations.

## 5) Data Model Preparation (DB-facing)
Required persistent entities:
- `users`: identity, wallet bindings, profile metadata.
- `matches`: room/match lifecycle, players, result snapshot.
- `transactions`: tx hash, chain id, status, retry count, timestamps.
- `rankings`: ELO/rank points, season, last update.
- `achievements`: unlocked badges, progress counters.

## 6) Observability Preparation
- Add correlation IDs across socket event -> backend command -> chain tx.
- Track metrics:
  - `match_settlement_latency_ms`
  - `tx_success_rate`
  - `tx_reorg_count`
  - `wallet_auth_failures`

## 7) Rollout Plan
1. Implement wallet signature auth (no stake yet).
2. Introduce testnet contract calls for settlement simulation.
3. Enable real stake locking on testnet.
4. Run security review + load test.
5. Mainnet rollout behind feature flag.

## 8) Explicit Non-Goals In This Phase
- No contract code in this preparation phase.
- No wallet SDK implementation in this preparation phase.
- No on-chain move-by-move verification yet.
