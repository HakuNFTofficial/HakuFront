# NFT Burn Reliability Design

## Goal

Make a user-initiated HukuNFT burn safe across the browser, Arc Testnet, and the
`haku-webmatch` database even when either WebSocket connection disconnects or
the indexer processes the burn after the transaction receipt is confirmed.

## Confirmed failure modes

- The chain listener reconnects with a new subscription but does not backfill
  blocks produced during the disconnect.
- broadcast receivers use `while let Ok(...)`; a lag error ends the worker.
- the frontend refreshes the NFT snapshot once immediately after confirmation,
  so a slower indexer can leave the old `Minted / Burn` card visible.
- the destructive button has no application-level confirmation explaining that
  the NFT will be permanently destroyed.

## Backend design

Keep the existing WebSocket listener for low latency and add a burn-only HTTP
reconciler as a durable fallback. The reconciler stores the next block to scan
in PostgreSQL, scans confirmed Arc blocks in bounded ranges, decodes only
`TokenBurned` logs from the configured HukuNFT address, invokes the existing
idempotent burn processor, invalidates the affected user's mint cache, and then
advances the checkpoint. A crash before checkpoint advancement replays an
already processed burn safely because the processor ignores rows that are no
longer `is_mint = 2`.

The checkpoint is initialized to the current confirmed head during deployment,
before the frontend release. This avoids replaying historical transfer traffic
while guaranteeing that future burns survive process and RPC disconnects.

All internal broadcast workers will receive through one helper that logs and
continues after `Lagged`, and exits only after `Closed`.

`app_map` will create exactly one Moka mint cache and pass clones of that same
cache handle to routes and workers. The current code constructs separate cache
instances, so a successful burn worker can invalidate a cache that the API does
not use.

## Frontend design

Before calling `userBurn(tokenId)`, show a native confirmation containing both
the on-chain token ID and database NFT ID, and state that destruction is
permanent while the recorded HAKU refund is returned atomically.

After a successful transaction receipt, poll `/api/query-mint` every two
seconds for up to thirty seconds. Stop only when the target row has
`is_mint = 0` and `token_id = null`, or when the row disappears from the minted
view. WebSocket `NFTUpdate` remains the fast path. On timeout, clear the pending
button state and show a message that the chain burn succeeded but application
sync is delayed; never encourage the user to submit a second burn.

## Error handling and safety

- Failed or rejected wallet requests clear the local pending state.
- Reverted receipts do not start backend polling.
- The backend advances the burn cursor only after every decoded burn in the
  range has been processed successfully.
- Log ranges are capped to avoid RPC response limits.
- The reconciler uses a small confirmation depth to avoid acting on a transient
  head during a reorganization.
- No burn transaction, owner signature, private key, or destructive database
  repair is part of this implementation.

## Testing

- Rust unit tests cover scan-range planning, checkpoint boundaries, and lagged
  broadcast recovery.
- Frontend tests cover cancellation, correct token ID submission, continued
  polling through stale snapshots, successful reset detection, and timeout
  messaging.
- Run the backend unit suite, frontend Vitest suite, frontend production build,
  and a read-only `eth_call` simulation of `userBurn(38)` before deployment.

## Deployment order

1. Apply the checkpoint migration and deploy/restart `haku-webmatch`.
2. Verify the reconciler starts at the current confirmed head and the API is
   healthy.
3. Deploy the frontend.
4. Re-run the read-only chain and API preflight for Token #38 / NFT ID 1551.
