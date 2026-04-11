# Production Runbook (Backend + Blockchain)

## Alerts To Configure

- `blockchainSubmitFailureCount` increased by >= 3 in 5 minutes.
- `blockchainSubmitRetryCount` increased by >= 10 in 10 minutes.
- `errorCount` spike >= 2x baseline for 10 minutes.
- Socket auth rejection (`socket_auth_rejected`) rate > baseline in production.

## Triage Steps (Tx Pending/Fail)

1. Verify Oasis RPC connectivity and latency.
2. Check backend logs for `submit_result_attempt_failed`:
   - confirm retryable vs non-retryable pattern
   - inspect attempt number and roomId
3. Check whether match already resolved on-chain:
   - query contract status for `roomId`
4. Confirm database write status for match result (`txHash` present or missing).
5. If retries exhausted but chain eventually confirms, reconcile DB manually and tag incident.

## Triage Steps (Socket Auth Errors)

1. Confirm deployment env:
   - `NODE_ENV=production`
   - `REQUIRE_SOCKET_JWT=true`
2. Verify frontend sends `auth.token` in socket handshake.
3. Check token issuer/audience/expiry against backend JWT settings.
4. Validate that 401/`MISSING_TOKEN` is not being swallowed by client reconnect loop.

## Immediate Mitigation Options

- Temporarily scale out backend instances if RPC delays are causing queue pressure.
- Increase `BLOCKCHAIN_SUBMIT_TIMEOUT_MS` and retry budget temporarily.
- Route traffic to healthy RPC endpoint if provider degradation is confirmed.

## Post-Incident Checklist

- Add timeline with first alert, mitigation, and recovery timestamps.
- Record root cause and affected roomIds/tx hashes.
- Add one regression test and one monitoring rule refinement before closing.
