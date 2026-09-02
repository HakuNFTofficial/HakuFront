# NFT Image Resolution Hotfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore minted NFT images by canonicalizing IPFS gateways in both application layers and safely switching the HukuNFT metadata CID.

**Architecture:** The frontend owns browser-facing URL canonicalization, while the backend prevents a known legacy gateway from entering API responses. The contract remains on its current implementation and changes only `baseCID` after read-only validation proves the new immutable metadata directory covers every live token.

**Tech Stack:** React, TypeScript, Vitest, Rust, Axum, Cargo tests, Solidity/Foundry read calls, IPFS gateways

---

### Task 1: Canonicalize frontend IPFS gateway URLs

**Files:**
- Modify: `frontend/src/config/ipfs.test.ts`
- Modify: `frontend/src/config/ipfs.ts`
- Modify: `frontend/src/components/Banner.tsx`

- [ ] **Step 1: Write the failing tests**

Add cases asserting that `convertIPFSToHttp` rewrites
`https://nftstorage.link/ipfs/QmImage/2828.png` to
`https://gateway.pinata.cloud/ipfs/QmImage/2828.png`, keeps an existing query string, and
preserves `https://cdn.example.com/2828.png`.

- [ ] **Step 2: Run the tests to verify RED**

Run: `npm test -- --run src/config/ipfs.test.ts`

Expected: the legacy gateway assertion fails because the current helper returns HTTP URLs unchanged.

- [ ] **Step 3: Implement the minimal canonicalizer**

Parse HTTP URLs with `new URL`, locate the `/ipfs/` path boundary, and rebuild that path
against `IPFS_CONFIG.GATEWAY`. On parse failure or non-IPFS HTTP URLs, return the original
value. Update `Banner.processImageUrl` to call `convertIPFSToHttp` before accepting an HTTP
URL.

- [ ] **Step 4: Run targeted and frontend tests**

Run: `npm test -- --run src/config/ipfs.test.ts`

Run: `npm test -- --run`

Expected: all tests pass.

### Task 2: Prevent backend legacy gateway responses

**Files:**
- Modify: `../haku-webmatch-source/src/routers/router.rs`
- Modify: `../haku-webmatch-source/.env.example`

- [ ] **Step 1: Write the failing Rust tests**

Add pure helper tests asserting `effective_ipfs_gateway(None)` and the exact
`https://nftstorage.link/ipfs/` input return Pinata, while
`https://custom.example/ipfs` remains normalized and unchanged.

- [ ] **Step 2: Run the tests to verify RED**

Run: `cargo test effective_ipfs_gateway --lib`

Expected: compilation fails because the helper does not exist.

- [ ] **Step 3: Implement the minimal gateway policy**

Add `DEFAULT_IPFS_GATEWAY`, `LEGACY_IPFS_GATEWAYS`, and pure
`effective_ipfs_gateway(Option<&str>)`. Use the helper in `fetch_nft_image_url`, emit a
warning when an explicitly configured legacy value is replaced, and update `.env.example`
to Pinata.

- [ ] **Step 4: Run targeted and backend tests**

Run: `cargo test effective_ipfs_gateway --lib`

Run: `cargo test --lib`

Expected: all tests pass.

### Task 3: Integrate and publish main

**Files:**
- Modify only the files listed in Tasks 1 and 2.

- [ ] **Step 1: Run formatting and builds**

Run in `HakuFront-source/frontend`: `npm run build`

Run in `haku-webmatch-source`: `cargo fmt -- --check`

Run in `haku-webmatch-source`: `cargo check`

Expected: all commands exit 0.

- [ ] **Step 2: Commit each repository on main**

Commit frontend/docs as `fix: canonicalize minted NFT image gateways` and backend as
`fix: replace legacy NFT IPFS gateway`.

- [ ] **Step 3: Synchronize main and push**

Run `git pull --rebase origin main`, rerun targeted tests if new commits arrive, then push
`main` for both repositories.

### Task 4: Apply production and chain configuration

**Files:**
- No repository files.

- [ ] **Step 1: Validate live token coverage**

Read `nextTokenId`, call `ownerOf` for IDs below it, extract the numeric token URL from every
successful `tokenURI`, and require both the new-CID JSON and its declared image to return
HTTP 200. Abort on any missing or malformed response.

- [ ] **Step 2: Update production backend gateway**

Set `IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs` in the actual service environment,
restart the service, and require `/api/query-minted-nfts-for-limit` to return a Pinata image
URL whose content returns HTTP 200.

- [ ] **Step 3: Switch HukuNFT baseCID**

From the owner wallet, call `setBaseCID` on
`0x703CEB677e9fbB1f4c6E917195c3b63B7EFA4Fe8` with
`Qmeub98s5ZPPANZVksF8Vs6CbPT3Xe5PEmkFEhgMP9ovzK`. Require a successful receipt, then verify
`baseCID()` and `tokenURI(40)`.

- [ ] **Step 4: Verify the user-visible result**

Require metadata and image HTTP 200 after the chain change, refresh wallet metadata, and
confirm the site banner renders NFT #40 without its SVG placeholder.
