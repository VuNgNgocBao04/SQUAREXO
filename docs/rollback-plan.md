# Rollback Plan

## When To Roll Back

- Persistent matchmaking or realtime failures > 10 minutes.
- Repeated blockchain settlement failures with no successful retries.
- Authentication failures affecting majority of active users.

## Preconditions

- Keep latest known-good backend image and contracts metadata available.
- Keep DB migration compatibility notes for backward reads/writes.
- Ensure feature flags or env-based behavior toggles are documented.

## Execution Steps

1. Freeze deployments and announce incident channel.
2. Redirect traffic to previous stable backend release.
3. Restore previous environment variable profile.
4. Validate health endpoints and smoke test:
   - auth login/register
   - join room
   - make move
   - match settle path
5. Confirm no data loss in DB and no orphan room state.

## Blockchain-Specific Rollback Notes

- Do not replay `submitResult` blindly after rollback.
- Check chain status first for each affected room.
- Reconcile DB `txHash` by room if transaction was confirmed during unstable window.

## Exit Criteria

- Error rate back to baseline for >= 30 minutes.
- No growing backlog of unsettled matches.
- On-call + release owner sign off.
