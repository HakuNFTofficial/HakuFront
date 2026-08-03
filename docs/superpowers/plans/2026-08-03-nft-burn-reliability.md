# NFT Burn Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure a confirmed HukuNFT burn always converges to the correct backend and frontend state despite WebSocket disconnects, delayed indexing, or broadcast lag.

**Architecture:** Preserve the WebSocket event listener as the fast path, add a PostgreSQL-checkpointed HTTP burn-log reconciler as the recovery path, and make all workers resilient to broadcast lag. The frontend requires explicit confirmation and polls the mint snapshot until the burned row is reset.

**Tech Stack:** Rust 2024, Tokio, Alloy 1, SQLx/PostgreSQL, Axum, React 18, TypeScript, wagmi 2, Vitest 4.

---

## File map

- Create `haku-webmatch/migrations/20260803193000_add_chain_event_checkpoints.sql`: durable scanner cursor.
- Create `haku-webmatch/src/services/burn_reconciler.rs`: scan planning, cursor persistence, confirmed-log reconciliation.
- Create `haku-webmatch/src/services/event_receiver.rs`: lag-tolerant broadcast receiving.
- Modify `haku-webmatch/src/services/mod.rs`: export new services.
- Modify `haku-webmatch/src/routers/router.rs`: start reconciler, share one cache, use resilient receivers.
- Create `HakuFront/frontend/src/nft/burnFlow.ts`: confirmation and bounded synchronization helpers.
- Create `HakuFront/frontend/src/nft/burnFlow.test.ts`: helper behavior tests.
- Modify `HakuFront/frontend/src/components/NFTSection.tsx`: integrate confirmation and polling.

### Task 1: Specify backend recovery behavior

**Files:**
- Create: `src/services/burn_reconciler.rs`
- Create: `src/services/event_receiver.rs`
- Modify: `src/services/mod.rs`

- [ ] **Step 1: Write failing scan planner tests**

Add tests for a pure API with these expectations:

```rust
assert_eq!(plan_scan_range(101, 100, 1, 2_000), None);
assert_eq!(plan_scan_range(90, 100, 1, 2_000), Some(90..=99));
assert_eq!(plan_scan_range(1, 10_000, 1, 2_000), Some(1..=2_000));
```

- [ ] **Step 2: Write a failing lag recovery test**

Use a capacity-one `tokio::sync::broadcast` channel, overflow it, and assert
`recv_resilient` skips `Lagged` and returns the newest value instead of ending.

- [ ] **Step 3: Verify RED**

Run: `cargo test plan_scan_range recv_resilient --lib`

Expected: compilation fails because the modules/functions do not exist.

- [ ] **Step 4: Implement the pure helpers**

`plan_scan_range(next_block, latest_block, confirmations, max_blocks)` returns
one bounded inclusive confirmed range. `recv_resilient` loops over `recv`, logs
`Lagged`, and returns `None` only for `Closed`.

- [ ] **Step 5: Verify GREEN**

Run: `cargo test plan_scan_range --lib` and `cargo test recv_resilient --lib`

Expected: all focused tests pass.

### Task 2: Add durable burn reconciliation

**Files:**
- Create: `migrations/20260803193000_add_chain_event_checkpoints.sql`
- Modify: `src/services/burn_reconciler.rs`
- Modify: `src/routers/router.rs`

- [ ] **Step 1: Add the checkpoint migration**

```sql
CREATE TABLE IF NOT EXISTS chain_event_checkpoints (
    consumer text PRIMARY KEY,
    next_block bigint NOT NULL CHECK (next_block >= 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Implement cursor persistence**

Use runtime-checked `sqlx::query`/`query_scalar` calls. On the first start insert
`confirmed_head + 1`; on subsequent starts load the stored cursor. Advance with
an update only after the whole range succeeds.

- [ ] **Step 3: Implement one reconciliation pass**

Build an Alloy HTTP provider from `RPC_URL`, filter the configured HukuNFT
address and `TokenBurned(uint256,address,address,uint256)` signature, decode
each log, call `process_token_burned_event`, invalidate the owner's three mint
cache keys, then advance the cursor.

- [ ] **Step 4: Start the reconciler**

Spawn a loop from `app_map` with a three-second interval, one-block confirmation
depth, and 2,000-block maximum range. Log errors and retry without moving the
cursor.

- [ ] **Step 5: Share one cache handle**

Create `let app_cache = get_app_cache()` once and pass `app_cache.clone()` to
every worker and `AppStatus` instead of calling `get_app_cache()` repeatedly.

- [ ] **Step 6: Make workers lag-tolerant**

Replace each `while let Ok(msg) = rx.recv().await` with
`while let Some(msg) = recv_resilient(&mut rx).await`.

- [ ] **Step 7: Verify backend**

Run: `cargo fmt --check`, `cargo test --workspace`, and `cargo build --release`.

Expected: formatting clean, all tests pass, and release build succeeds.

### Task 3: Specify the frontend burn flow

**Files:**
- Create: `frontend/src/nft/burnFlow.test.ts`
- Create: `frontend/src/nft/burnFlow.ts`

- [ ] **Step 1: Write failing confirmation tests**

Assert the confirmation text contains on-chain Token `#38`, database ID `1551`,
the word `permanent`, and the atomic recorded HAKU refund behavior.

- [ ] **Step 2: Write failing synchronization tests**

Use a fake snapshot fetcher returning two stale minted snapshots followed by a
reset snapshot. Assert three calls are made and the reset snapshot is returned.
Add timeout and disappearing-row cases.

- [ ] **Step 3: Verify RED**

Run: `npm test -- src/nft/burnFlow.test.ts`

Expected: failure because `burnFlow.ts` does not exist.

- [ ] **Step 4: Implement helpers**

Export `getBurnConfirmationMessage`, `isBurnSynchronized`, and
`waitForBurnSynchronization`. Inject `fetchSnapshot` and `delay` so tests use no
real timers. Default to 15 attempts with a two-second interval.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- src/nft/burnFlow.test.ts`

Expected: all focused tests pass.

### Task 4: Integrate the safe frontend behavior

**Files:**
- Modify: `frontend/src/components/NFTSection.tsx`
- Test: `frontend/src/nft/burnFlow.test.ts`

- [ ] **Step 1: Require confirmation before writing**

Call `window.confirm(getBurnConfirmationMessage(nft))` before setting
`burningNftId`; return without calling wagmi if cancelled.

- [ ] **Step 2: Replace the one-shot receipt refresh**

On `isBurnConfirmed`, call `waitForBurnSynchronization` with the existing
`/api/query-mint` request. Update the snapshot and clear `burningNftId` only
after synchronization succeeds.

- [ ] **Step 3: Handle timeout safely**

Keep the affected Burn button disabled for the session and show: the chain burn
succeeded, application synchronization is delayed, and the user must not submit
another burn.

- [ ] **Step 4: Verify frontend**

Run: `npm test` and `npm run build`.

Expected: all tests pass and Vite production build succeeds.

### Task 5: Integrate, push main, and deploy

**Files:**
- Modify only the files listed above.

- [ ] **Step 1: Fetch both remotes again**

Run `git fetch origin main` in both repositories and fast-forward/merge only if
needed. Re-run verification after any integration.

- [ ] **Step 2: Commit and push backend main**

Commit the backend recovery changes tersely and push `main` directly.

- [ ] **Step 3: Commit and push frontend main**

Commit the helper/integration changes and plan, then push `main` directly.

- [ ] **Step 4: Deploy backend first**

Back up the production binary/configuration, apply the checkpoint migration,
build/install the verified backend, restart it, and verify the API and reconciler
logs. Do not echo secrets.

- [ ] **Step 5: Deploy frontend**

Build with the existing production environment, preserve the previous dist,
install the new dist, and verify `https://www.hakupump.club/`.

- [ ] **Step 6: Re-run Burn preflight**

Confirm Token #38 still belongs to the expected owner, refund is 10,000 HAKU,
contract balance covers it, `eth_call userBurn(38)` succeeds, and the production
API still maps ID 1551 to Token #38.

