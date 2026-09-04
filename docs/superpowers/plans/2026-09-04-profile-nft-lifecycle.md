# Profile NFT Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server-partition incomplete and complete NFTs so Swap only animates incomplete fragments and Profile statically manages the complete NFT mint/burn lifecycle.

**Architecture:** Extend the existing paginated backend query with validated lifecycle filters and global status counts. Keep the current lifecycle controller as one page-level React component on Profile, add a lightweight server-paginated Swap list, and introduce a static preview-only Profile thumbnail whose viewer loads originals on demand.

**Tech Stack:** Rust, Axum, SQLx, PostgreSQL, React 18, TypeScript, wagmi, Vitest, Testing Library, Vite.

---

### Task 1: Backend lifecycle filters and counts

**Files:**
- Modify: `../haku-webmatch-source/src/routers/router.rs`
- Modify: `../haku-webmatch-source/src/routers/router_struct.rs`

- [ ] Add failing unit tests for accepted filters (`in_progress`, `profile`, `mintable`, `minting`, `burnable`) and rejection of an unknown filter.
- [ ] Extend the database fixture test with incomplete, complete, minting, and burnable NFTs; assert every filter returns only its exact state and reports global counts.
- [ ] Run `DATABASE_URL=postgresql:///haku cargo test --lib routers::router::tests -- --nocapture` and confirm the new assertions fail.
- [ ] Add a typed filter parser, SQL predicates applied before `LIMIT/OFFSET`, status-count fields, and a structured HTTP 400 response for invalid filters.
- [ ] Request coordinates only for the already-filtered page rows when `include_chips=true`.
- [ ] Rerun the focused backend tests and commit the backend change.

### Task 2: Static Profile media policy

**Files:**
- Modify: `frontend/src/nft/imagePolicy.ts`
- Modify: `frontend/src/nft/imagePolicy.test.ts`
- Create: `frontend/src/components/NFTProfileThumbnail.tsx`
- Create: `frontend/src/components/NFTProfileThumbnail.test.tsx`
- Modify: `frontend/src/components/NFTImageViewer.tsx`
- Modify: `frontend/src/components/NFTImageViewer.test.tsx`

- [ ] Add failing tests proving every Profile state uses the color WebP preview without `nft-preview-shadow` or `NFTChipOverlay`.
- [ ] Add failing viewer tests proving complete and minting NFTs open the original only after the thumbnail click, while missing `file_name` emits a structured error instead of inventing a path.
- [ ] Run `npm test -- src/nft/imagePolicy.test.ts src/components/NFTProfileThumbnail.test.tsx src/components/NFTImageViewer.test.tsx` and confirm RED.
- [ ] Implement an explicit preview-source policy, the static thumbnail, and viewer support for all Profile lifecycle states.
- [ ] Rerun the focused tests and commit the media change.

### Task 3: Move lifecycle ownership to Profile

**Files:**
- Modify: `frontend/src/components/NFTSection.tsx`
- Modify: `frontend/src/components/Profile.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/services/webSocketConsumers.test.ts`
- Modify: `frontend/src/components/nftBurnFlowContract.test.ts`

- [ ] Add failing source-contract assertions that Profile requests `filter=profile&include_chips=false`, renders the lifecycle controls, and does not render the animated image component.
- [ ] Add failing assertions that Swap requests `filter=in_progress&page_size=6&include_chips=true`, contains no mint/burn contract controls, and labels its navigation link `Profile`.
- [ ] Run the focused Vitest files and confirm RED.
- [ ] Retain the existing page-level wagmi lifecycle controller for Profile, use backend pagination/counts, and refresh it on NFT WebSocket/reconnect events.
- [ ] Add a lightweight Swap list that renders only `NFTImageReveal`, compares summary-only realtime state for exact completion notices, and refreshes its server page.
- [ ] Keep rare mint/burn synchronization on summary-only requests and refresh the Profile snapshot after the authoritative state transition.
- [ ] Rerun the focused tests and commit the lifecycle move.

### Task 4: Full verification and delivery

**Files:**
- Modify only files required by failing verification.

- [ ] Run `npm test`, `npm run build`, and `git diff --check` in `HakuFront-source/frontend`.
- [ ] Run `cargo fmt --check`, `DATABASE_URL=postgresql:///haku cargo test --lib`, `DATABASE_URL=postgresql:///haku cargo build --release`, and `git diff --check` in `haku-webmatch-source`.
- [ ] Fetch `origin/main`, merge it into each feature branch, and rerun the complete verification.
- [ ] Push both `feature/profile-nft-lifecycle` branches and create pull requests with test results.

### Task 5: Production deployment

**Files on production:**
- Backend repository: `/home/web-match`
- Backend binary: `/home/web-match/target/release/web-match`
- Frontend document root: `/usr/local/www/dist`

- [ ] Merge the backend PR, make a timestamped binary backup, fast-forward `/home/web-match`, build release, restart `web-match`, and rollback automatically if the service or local API health check fails.
- [ ] Verify lifecycle filters and empty coordinate arrays through the public API with a known connected wallet address without logging private data.
- [ ] Merge the frontend PR, build from the merged commit with the server's existing environment, archive `frontend/dist`, and extract it into a new staging directory.
- [ ] Verify staged assets and `nginx -t`, atomically rename the active document root to a timestamped backup, and activate staging.
- [ ] Verify the public version, API health, Swap/Profile filtered requests, static Profile thumbnails, and click-to-load originals; restore the exact backup if smoke verification fails.
