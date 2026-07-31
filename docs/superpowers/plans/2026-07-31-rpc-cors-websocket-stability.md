# RPC CORS and WebSocket Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route browser JSON-RPC reads through a restricted same-origin backend gateway, reduce polling pressure, and replace three leaking WebSocket connections with one lifecycle-safe shared connection.

**Architecture:** A small standalone Rust crate in `haku-webmatch` owns JSON-RPC validation, the read-method allowlist, upstream HTTP forwarding, and bounded retry behavior so it can be tested without the database-dependent application crate. HakuFront points Wagmi at `/api/rpc`, centralizes visible-page polling intervals, and uses a pure TypeScript shared WebSocket manager exposed through a React provider. Contract writes and wallet network configuration remain on the injected wallet provider.

**Tech Stack:** Rust 2024, Axum 0.8, Reqwest 0.12, Tokio, React 18, TypeScript 5.6, Wagmi/Viem, TanStack Query, Vitest.

---

## Repository and branch map

- Frontend repository: `/Users/martin/.config/superpowers/worktrees/HakuFront/fix-rpc-cors-ws-lifecycle`
  - Branch: `fix/rpc-cors-ws-lifecycle`
  - Includes production NFT uniqueness commit `f119c0b`.
- Backend repository: `/Users/martin/.config/superpowers/worktrees/haku-webmatch/fix-rpc-proxy-429`
  - Branch: `fix/rpc-proxy-429`.
- Production backup branches:
  - `HakuFront`: `backup/prod-before-rpc-ws-fix-20260731`
  - `haku-webmatch`: `backup/prod-before-rpc-proxy-fix-20260731`

## Baseline constraints

- `frontend/npm run build` passes before changes.
- Root Foundry tests are already blocked by missing submodules and the invalid tracked placeholder `src/PoolConfig.sol`; this task does not modify contracts.
- Root backend `cargo test` requires the production database schema because the existing crate uses online SQLx macros. New RPC behavior must therefore live in a standalone crate whose tests run locally without database credentials. The full backend build is verified later in a temporary server worktree that uses the server-local ignored `.env`; secrets are never copied into Git or browser code.

---

### Task 1: Add a testable restricted JSON-RPC proxy crate

**Repository:** `haku-webmatch`

**Files:**
- Modify: `Cargo.toml`
- Create: `rpc-proxy-core/Cargo.toml`
- Create: `rpc-proxy-core/src/lib.rs`
- Create: `rpc-proxy-core/tests/proxy.rs`

- [ ] **Step 1: Add the crate manifest and failing behavior tests**

Add a workspace member and root path dependency:

```toml
[workspace]
members = [".", "rpc-proxy-core"]
resolver = "2"

[dependencies]
rpc-proxy-core = { path = "rpc-proxy-core" }
```

The child manifest uses `reqwest`, `serde_json`, `thiserror`, and `tokio`; `axum` is a dev dependency for a local upstream test server. Write tests that require these APIs before implementing them:

```rust
use rpc_proxy_core::{validate_payload, ProxyConfig, ProxyError, RpcProxy};

#[test]
fn allows_safe_read_methods_and_rejects_send_raw_transaction() {
    assert!(validate_payload(br#"{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[]}"#).is_ok());
    assert!(matches!(
        validate_payload(br#"{"jsonrpc":"2.0","id":1,"method":"eth_sendRawTransaction","params":[]}"#),
        Err(ProxyError::ForbiddenMethod(method)) if method == "eth_sendRawTransaction"
    ));
}

#[test]
fn rejects_more_than_twenty_batched_calls() {
    let body = serde_json::to_vec(&vec![
        serde_json::json!({"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]});
        21
    ]).unwrap();
    assert!(matches!(validate_payload(&body), Err(ProxyError::BatchTooLarge(21))));
}

#[tokio::test]
async fn retries_429_then_returns_success_body() {
    let (url, attempts) = spawn_upstream([429, 200]).await;
    let proxy = RpcProxy::new(ProxyConfig::for_tests(url));
    let response = proxy.forward(br#"{"jsonrpc":"2.0","id":7,"method":"eth_chainId","params":[]}"#).await.unwrap();
    assert_eq!(response.status, 200);
    assert_eq!(attempts.load(Ordering::SeqCst), 2);
    assert_eq!(serde_json::from_slice::<Value>(&response.body).unwrap()["id"], 7);
}
```

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```bash
cargo test --manifest-path rpc-proxy-core/Cargo.toml
```

Expected: compilation fails because `validate_payload`, `ProxyConfig`, `ProxyError`, and `RpcProxy` are not implemented.

- [ ] **Step 3: Implement the minimum proxy behavior**

Implement:

```rust
pub const MAX_BODY_BYTES: usize = 256 * 1024;
pub const MAX_BATCH_SIZE: usize = 20;

pub struct ProxyConfig {
    pub upstream_url: String,
    pub max_attempts: usize,
    pub base_delay: Duration,
    pub request_timeout: Duration,
}

pub struct ProxyResponse {
    pub status: u16,
    pub body: Vec<u8>,
}

pub enum ProxyError {
    BodyTooLarge(usize),
    InvalidJson(String),
    InvalidRequest(String),
    EmptyBatch,
    BatchTooLarge(usize),
    ForbiddenMethod(String),
    UpstreamUnavailable,
    UpstreamStatus(u16),
}
```

`validate_payload` must accept a single object or non-empty array, require `jsonrpc == "2.0"`, require a string method, limit batches to 20, and allow only:

```text
eth_chainId, eth_blockNumber, eth_call, eth_getBalance, eth_getCode,
eth_getStorageAt, eth_getBlockByNumber, eth_getBlockByHash,
eth_getTransactionByHash, eth_getTransactionReceipt, eth_getTransactionCount,
eth_getLogs, eth_estimateGas, eth_gasPrice, eth_maxPriorityFeePerGas,
eth_feeHistory, eth_syncing, net_version
```

`RpcProxy::forward` validates before network access, sends `application/json`, uses a bounded Reqwest timeout, and retries only transport errors or HTTP 429/502/503/504. Use exponential delay capped by configuration; test configuration uses millisecond delays.

- [ ] **Step 4: Run the child crate tests and verify GREEN**

Run:

```bash
cargo test --manifest-path rpc-proxy-core/Cargo.toml
```

Expected: all validation and retry tests pass.

- [ ] **Step 5: Commit the standalone proxy core**

```bash
git add Cargo.toml Cargo.lock rpc-proxy-core
git commit -m "feat: add restricted Arc RPC proxy core"
```

---

### Task 2: Expose the restricted proxy from haku-webmatch

**Repository:** `haku-webmatch`

**Files:**
- Modify: `src/routers/router_struct.rs`
- Modify: `src/routers/router.rs`

- [ ] **Step 1: Extend proxy tests for HTTP error mapping**

Add failing tests showing that final 429 becomes `ProxyError::UpstreamUnavailable`, an upstream 400 is not retried, and upstream JSON-RPC error bodies with HTTP 200 are returned unchanged.

- [ ] **Step 2: Run the child crate tests and verify RED**

Run the child crate test command and confirm the new mapping assertion fails for the expected reason.

- [ ] **Step 3: Finish error mapping and add the Axum handler**

Add `rpc_proxy: Arc<RpcProxy>` to `AppStatus`. In `app_map()` create it from existing `RPC_URL`, defaulting to Arc Testnet. Register:

```rust
.route(
    "/api/rpc",
    post(proxy_rpc).layer(DefaultBodyLimit::max(MAX_BODY_BYTES)),
)
```

The handler accepts `Bytes`, calls `state.rpc_proxy.forward(&body)`, returns successful upstream JSON with `Content-Type: application/json` and `Cache-Control: no-store`, and maps:

```text
invalid JSON/request -> 400
forbidden method -> 403
exhausted 429/5xx/transport -> 503
other upstream HTTP failures -> 502
```

Error bodies use JSON-RPC shape with `id: null`; logs contain only method summary/count, status, and elapsed time, never request params.

- [ ] **Step 4: Run local proxy tests**

Run:

```bash
cargo fmt --all -- --check
cargo test --manifest-path rpc-proxy-core/Cargo.toml
```

Expected: formatting and all proxy tests pass.

- [ ] **Step 5: Commit backend integration**

```bash
git add Cargo.toml Cargo.lock src/routers/router.rs src/routers/router_struct.rs rpc-proxy-core
git commit -m "feat: expose restricted same-origin RPC gateway"
```

---

### Task 3: Add frontend test infrastructure and same-origin RPC transport

**Repository:** `HakuFront`

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/src/wagmi.ts`
- Modify: `frontend/src/main.tsx`
- Create: `frontend/src/config/queryPolicy.ts`
- Create: `frontend/src/config/queryPolicy.test.ts`
- Create: `frontend/src/wagmi.test.ts`

- [ ] **Step 1: Install Vitest and write failing transport/polling tests**

Add `vitest` as a dev dependency and `"test": "vitest run"`. Tests require:

```ts
import { describe, expect, it, vi } from 'vitest'
import { RPC_PROXY_URL } from './wagmi'
import { visibleRefetchInterval } from './config/queryPolicy'

it('uses the same-origin RPC gateway', () => {
  expect(RPC_PROXY_URL).toBe('/api/rpc')
  expect(RPC_PROXY_URL).not.toContain('rpc.testnet.arc.network')
})

it('pauses polling while the document is hidden', () => {
  vi.stubGlobal('document', { visibilityState: 'hidden' })
  expect(visibleRefetchInterval(15_000)()).toBe(false)
})
```

- [ ] **Step 2: Run frontend tests and verify RED**

Run:

```bash
npm test
```

Expected: tests fail because the exported proxy URL and visibility policy do not exist.

- [ ] **Step 3: Implement query policy and transport**

Export stable intervals and the helper:

```ts
export const BALANCE_REFETCH_MS = 15_000
export const POOL_REFETCH_MS = 15_000
export const STATIC_REFETCH_MS = 30_000

export const visibleRefetchInterval = (milliseconds: number) => () =>
  typeof document === 'undefined' || document.visibilityState === 'visible'
    ? milliseconds
    : false
```

Configure Wagmi:

```ts
export const RPC_PROXY_URL = '/api/rpc'

transports: {
  [arcTestnet.id]: http(RPC_PROXY_URL, {
    batch: { batchSize: 20, wait: 50 },
    retryCount: 2,
    retryDelay: 500,
  }),
}
```

Configure the shared QueryClient with a 10-second stale time, `refetchOnWindowFocus: false`, and bounded retries.

- [ ] **Step 4: Run tests and production build**

```bash
npm test
npm run build
```

Expected: tests pass and Vite production build exits 0.

- [ ] **Step 5: Commit transport changes**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/wagmi.ts frontend/src/main.tsx frontend/src/config
git commit -m "fix: route reads through same-origin RPC gateway"
```

---

### Task 4: Build a lifecycle-safe shared WebSocket manager

**Repository:** `HakuFront`

**Files:**
- Create: `frontend/src/services/sharedWebSocket.ts`
- Create: `frontend/src/services/sharedWebSocket.test.ts`
- Create: `frontend/src/providers/WebSocketProvider.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Write failing manager tests with a fake socket**

Test these behaviors before implementation:

```ts
it('start is idempotent and creates only one socket', () => {
  manager.start()
  manager.start()
  expect(createdSockets).toHaveLength(1)
})

it('dispatches messages to matching event subscribers only', () => {
  const latest = vi.fn()
  const kline = vi.fn()
  manager.subscribe('LatestMintedNFTs', latest)
  manager.subscribe('KlineUpdate', kline)
  socket.emitMessage({ type: 'LatestMintedNFTs', data: { total: 1 } })
  expect(latest).toHaveBeenCalledOnce()
  expect(kline).not.toHaveBeenCalled()
})

it('stop cancels retry and stale close cannot reconnect', () => {
  manager.start()
  manager.stop()
  socket.emitClose()
  vi.runAllTimers()
  expect(createdSockets).toHaveLength(1)
})

it('a previous generation close cannot replace the current socket', () => {
  manager.start()
  manager.reconnect()
  firstSocket.emitClose()
  vi.runAllTimers()
  expect(createdSockets).toHaveLength(2)
})
```

- [ ] **Step 2: Run tests and verify RED**

Run `npm test -- sharedWebSocket.test.ts` and confirm failure because the manager does not exist.

- [ ] **Step 3: Implement the manager and provider**

`SharedWebSocketManager` owns one socket, a monotonically increasing generation, one retry timer, status listeners, and event-type subscriber sets. `start()` is idempotent. `stop()` marks the manager stopped, increments generation, clears the timer, removes socket handlers, and closes the socket. Reconnect delay is exponential with bounded jitter and a 30-second cap.

`WebSocketProvider` starts/stops one module-level manager and exposes:

```ts
useWebSocketStatus(): WebSocketStatus
useWebSocketEvent<T>(type: string, handler: (data: T) => void, enabled?: boolean): void
```

Wrap `<App />` once inside this provider in `main.tsx`.

- [ ] **Step 4: Run manager tests and build**

Run `npm test -- sharedWebSocket.test.ts` then `npm run build`. Both must pass.

- [ ] **Step 5: Commit the shared connection infrastructure**

```bash
git add frontend/src/services frontend/src/providers frontend/src/main.tsx
git commit -m "feat: add shared WebSocket connection manager"
```

---

### Task 5: Migrate the three WebSocket consumers and preserve HTTP fallback

**Repository:** `HakuFront`

**Files:**
- Modify: `frontend/src/components/Banner.tsx`
- Modify: `frontend/src/components/KLineChart.tsx`
- Modify: `frontend/src/components/NFTSection.tsx`
- Delete: `frontend/src/hooks/useWebSocket.ts`

- [ ] **Step 1: Add a failing source-level regression test**

Create a Vitest test that reads the three component source files and asserts they import `useWebSocketEvent`, do not import `useWebSocket`, and do not construct `/ws` URLs. It must fail against current components.

- [ ] **Step 2: Run the focused test and verify RED**

Run the new test and confirm all three current imports/URLs are reported.

- [ ] **Step 3: Migrate subscribers**

Replace per-component connections with typed subscriptions:

```ts
useWebSocketEvent<LatestMintedNFTsEvent>('LatestMintedNFTs', handleLatestMintedNFTs)
useWebSocketEvent<KlineUpdateEvent>('KlineUpdate', handleKlineUpdate, !isLoading && !error)
useWebSocketEvent<NFTQueryResponse>('NFTUpdate', handleNftUpdate, Boolean(address))
```

Move handlers behind refs/callbacks so subscriptions remain stable. Banner initial HTTP fetch runs once on mount rather than waiting for WebSocket status. NFT initial HTTP fetch runs on address change rather than waiting for WebSocket status. Kline historical HTTP fetch remains independent. Delete the obsolete Hook after the final consumer is migrated.

- [ ] **Step 4: Run all frontend tests and build**

Run `npm test` and `npm run build`. Expected: no TypeScript errors and all regression tests pass.

- [ ] **Step 5: Commit consumer migration**

```bash
git add frontend/src/components frontend/src/hooks/useWebSocket.ts frontend/src/providers frontend/src/services
git commit -m "fix: share one WebSocket across realtime views"
```

---

### Task 6: Reduce polling and remove production log/animation leaks

**Repository:** `HakuFront`

**Files:**
- Modify: `frontend/src/components/WalletBalance.tsx`
- Modify: `frontend/src/components/Swap.tsx`
- Modify: `frontend/src/components/NFTSection.tsx`
- Modify: `frontend/src/hooks/useWalletChainId.ts`
- Modify: `frontend/src/components/NFTImageReveal.tsx`
- Modify: `frontend/src/utils/version.ts`
- Create: `frontend/src/utils/animationFrameLoop.ts`
- Create: `frontend/src/utils/animationFrameLoop.test.ts`

- [ ] **Step 1: Write failing animation cleanup and polling tests**

Test that `startAnimationFrameLoop` calls the provided cancel function on cleanup and does not schedule another frame when the callback returns `false`. Extend the source regression test to reject 2/3/5/10-second permanent refetch intervals and the strings `Drawing ${starCount} stars`, `Generating start position for star`, and `[Version] Same version`.

- [ ] **Step 2: Run focused tests and verify RED**

Confirm failures identify the existing frame loop/log strings and short intervals.

- [ ] **Step 3: Implement bounded polling and cleanup**

Use the stable visible-page policies:

```ts
refetchInterval: visibleRefetchInterval(BALANCE_REFETCH_MS)
refetchIntervalInBackground: false
```

Apply 15 seconds to balances, allowance, pool state, liquidity, and active quote reads; apply 30 seconds to mint price/static reads. Change wallet fallback polling from 2 seconds to 30 seconds and skip the request while hidden, while retaining `chainChanged` and `accountsChanged` event listeners.

Implement `startAnimationFrameLoop(callback, scheduler)` returning an idempotent cleanup function, use it for both NFT reveal animation paths, and remove every-frame logs. Remove the production same-version log.

- [ ] **Step 4: Run full frontend verification**

```bash
npm test
npm run build
```

Expected: all tests pass; production build exits 0; source regression test finds no prohibited short interval or high-frequency log.

- [ ] **Step 5: Commit polling and cleanup changes**

```bash
git add frontend/src
git commit -m "fix: bound polling and animation lifecycles"
```

---

### Task 7: Synchronize branches, open PRs, and verify server-side compilation

**Repositories:** both

- [ ] **Step 1: Fetch and merge the latest origin/main in each feature branch**

Run `git fetch origin` followed by `git merge origin/main` in both worktrees. Resolve conflicts without discarding production NFT changes.

- [ ] **Step 2: Re-run local verification**

Backend:

```bash
cargo fmt --all -- --check
cargo test --manifest-path rpc-proxy-core/Cargo.toml
```

Frontend:

```bash
npm test
npm run build
```

- [ ] **Step 3: Push both feature branches and create PRs**

Push `fix/rpc-proxy-429` and `fix/rpc-cors-ws-lifecycle`, then create one PR per repository. Cross-link the PRs and state the required deployment order: backend first, frontend second.

- [ ] **Step 4: Verify the complete backend branch on the server without exporting secrets**

Fetch the pushed backend branch into a temporary server worktree, link only the server-local ignored `/home/web-match/.env`, and run:

```bash
cargo test --manifest-path rpc-proxy-core/Cargo.toml
cargo build --release
```

Do not print `.env` or copy it off-server. Remove only the temporary link/worktree after verification, preserving the production directory.

---

### Task 8: Back up, deploy, and perform production smoke tests

- [ ] **Step 1: Create timestamped deployment backups**

Back up the current backend binary, frontend `dist`, Nginx site configuration, systemd unit/drop-ins, and record both production commits. Existing remote backup branches remain unchanged.

- [ ] **Step 2: Deploy backend first**

Build and install the verified backend binary, restart `web-match.service`, and verify `/api/rpc` with:

- allowed `eth_chainId` returns HTTP 200 and chain `0x4cef52` (5042002),
- forbidden `eth_sendRawTransaction` returns HTTP 403 without reaching upstream,
- malformed JSON returns HTTP 400,
- service logs contain no secrets.

- [ ] **Step 3: Deploy frontend**

Deploy the verified `dist` atomically, reload Nginx only if configuration changed, and confirm static assets return 200.

- [ ] **Step 4: Browser smoke test**

Using the production page and connected test wallet, verify for at least two minutes:

- browser RPC requests go only to `/api/rpc`,
- no Arc CORS errors or repeated 429 errors,
- exactly one `/ws` connection per tab,
- no repeated Connected/Same version/frame logs,
- balances, quote, NFT list and images load.

- [ ] **Step 5: Transaction regression**

Run an authorized low-value test flow: read balance/quote, mint an eligible test NFT if test assets are available, transfer it, then burn it. Verify transaction receipts and standard ERC-721 Transfer events. If assets are unavailable, do not manufacture database state; report that transaction regression remains pending and keep read-only checks complete.

- [ ] **Step 6: Roll back on any failed acceptance criterion**

Restore backend binary/service first and frontend `dist` second from the timestamped backups. Do not roll back contracts or modify database rows.

