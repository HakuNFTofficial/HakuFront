# Exact-color NFT Chip Sparkles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore exact-position, artwork-color owned-chip highlights and sparkles without loading full-resolution NFT originals before minting.

**Architecture:** Generate color 512×512 WebP previews and use each preview twice from the browser cache: once as a CSS-darkened background and once as the Canvas source for owned-chip rectangles. Existing batched NFT summary APIs return coordinate-only `owned_chips`; a focused renderer scales the verified 3000×3000 coordinates to the 512×512 preview and animates a capped deterministic subset at real positions.

**Tech Stack:** React 18, TypeScript, Canvas 2D, Vitest/Testing Library, Node test runner, Sharp, Vite.

---

### Task 1: Generate validated color previews

**Files:**
- Modify: `scripts/nft-previews/preview-lib.mjs`
- Modify: `scripts/nft-previews/preview-lib.test.mjs`

- [ ] **Step 1: Write failing color and source-dimension tests**

Extend the success test to assert `manifest.settings.version === 2`, `sourceWidth/sourceHeight === 3000`, and use `sharp(...).stats()` to assert a red fixture's output channels are not equal. Add a fixture with dimensions 2999×3000 and assert generation rejects with `Invalid source dimensions: 3.png (2999x3000), expected 3000x3000`.

- [ ] **Step 2: Run the generator test and verify RED**

Run: `npm run preview:test`

Expected: FAIL because release 1 settings produce grayscale output and do not reject the wrong dimensions.

- [ ] **Step 3: Implement color preview generation**

Set preview settings to:

```js
export const PREVIEW_SETTINGS = Object.freeze({
    version: 2,
    sourceWidth: 3000,
    sourceHeight: 3000,
    width: 512,
    height: 512,
    quality: 50,
})
```

Read source metadata before processing and throw the explicit dimension error on mismatch. Generate with only `resize(...).webp(...)`; remove baked grayscale, blur, and brightness operations so Canvas can copy real artwork colors.

- [ ] **Step 4: Run the generator tests and verify GREEN**

Run: `npm run preview:test`

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit the generator change**

```bash
git add scripts/nft-previews/preview-lib.mjs scripts/nft-previews/preview-lib.test.mjs
git commit -m "feat: generate color NFT previews"
```

### Task 2: Add exact-coordinate Canvas rendering

**Files:**
- Create: `frontend/src/nft/chipOverlay.ts`
- Create: `frontend/src/nft/chipOverlay.test.ts`
- Create: `frontend/src/components/NFTChipOverlay.tsx`
- Create: `frontend/src/components/NFTChipOverlay.test.tsx`

- [ ] **Step 1: Write failing coordinate and selection tests**

Define tests for a chip `{ x: 300, y: 600, w: 30, h: 60 }`. `scaleChipRect(chip)` must return `{ x: 51.2, y: 102.4, width: 5.12, height: 10.24 }`. Test that `selectSparkleChips` returns all 23 real objects for 23 inputs, 30 real objects for 1000 inputs, and 100 real objects for 1001 inputs, deterministically.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/nft/chipOverlay.test.ts`

Expected: FAIL because `chipOverlay.ts` does not exist.

- [ ] **Step 3: Implement pure overlay policy**

Create exports with these contracts:

```ts
export const NFT_SOURCE_SIZE = 3000
export const NFT_PREVIEW_SIZE = 512
export interface ChipCoordinate { x: number; y: number; w: number; h: number }
export interface ScaledChipRect { x: number; y: number; width: number; height: number }
export function scaleChipRect(chip: ChipCoordinate): ScaledChipRect
export function selectSparkleChips(chips: ChipCoordinate[]): ChipCoordinate[]
```

Validate finite positive rectangles inside the 3000×3000 bounds. Return valid inputs only; the caller logs invalid or missing records instead of deriving substitute positions. Select deterministic evenly spaced indices and never synthesize coordinates.

- [ ] **Step 4: Write failing Canvas component tests**

Stub a 2D context and verify `NFTChipOverlay` calls the nine-argument `drawImage` overload using preview-space source and destination rectangles, exposes `data-testid="nft-chip-overlay"`, and schedules sparkle animation only when reduced motion is false.

- [ ] **Step 5: Implement the Canvas component**

`NFTChipOverlay` receives the already-loaded preview `HTMLImageElement`, `nftId`, and `chips`. It creates a 512×512 absolute overlay canvas, draws all valid colored chip rectangles once, and redraws a capped sparkle layer with `requestAnimationFrame`. Sparkle centers come from `selectSparkleChips`; cleanup cancels the frame. On invalid coordinate count it emits:

```ts
console.error({
    event: 'nft_chip_coordinates_invalid',
    nftId,
    expectedCount: chips.length,
    validCount,
})
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npm test -- src/nft/chipOverlay.test.ts src/components/NFTChipOverlay.test.tsx`

Expected: both files pass, 0 failures.

- [ ] **Step 7: Commit the renderer**

```bash
git add frontend/src/nft/chipOverlay.ts frontend/src/nft/chipOverlay.test.ts frontend/src/components/NFTChipOverlay.tsx frontend/src/components/NFTChipOverlay.test.tsx
git commit -m "feat: render exact-color owned NFT chips"
```

### Task 3: Connect coordinate data and dark preview presentation

**Files:**
- Modify: `frontend/src/components/NFTImageReveal.tsx`
- Modify: `frontend/src/components/NFTImageReveal.test.tsx`
- Modify: `frontend/src/components/NFTSection.tsx`
- Modify: `frontend/src/components/Profile.tsx`
- Modify: `frontend/src/services/webSocketConsumers.test.ts`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Write failing component and data-policy tests**

Add `owned_chips` fixtures and assert an incomplete NFT renders a dark preview image plus `nft-chip-overlay`, while the preview URL contains the preview CID and not the original CID. Update source-policy tests to require `include_chips=true` for the initial `query-mint` snapshot and `user-nft-list`, and continue rejecting `/api/nft-user-chips-batch`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/components/NFTImageReveal.test.tsx src/services/webSocketConsumers.test.ts`

Expected: FAIL because coordinates are not requested or rendered.

- [ ] **Step 3: Wire the color preview and overlay**

Add `owned_chips?: ChipCoordinate[]` to both NFT types. In `NFTImageReveal`, keep an image ref and loaded state; preview images receive `nft-preview-shadow`, and loaded pre-mint previews render `NFTChipOverlay` with `nft.owned_chips ?? []`. Minted originals keep the existing zoom button and never render the overlay.

Add CSS:

```css
.nft-preview-shadow {
  filter: grayscale(1) blur(10px) brightness(0.16) contrast(0.72);
  transform: scale(1.04);
}
```

The surrounding container clips the scaled blur. The Canvas remains unfiltered so copied rectangles retain the preview's artwork colors.

- [ ] **Step 4: Request coordinate-bearing summaries**

Use `include_chips=true` on the initial `query-mint` and paginated `user-nft-list` calls. WebSocket update handlers call their existing snapshot refresh callbacks, ensuring coordinate-only event payloads cannot erase exact positions. Mint/burn polling may remain summary-only only when it preserves existing coordinates with unchanged ownership count; otherwise request coordinates.

- [ ] **Step 5: Run focused and complete frontend tests**

Run: `npm test -- src/components/NFTImageReveal.test.tsx src/services/webSocketConsumers.test.ts`

Expected: focused tests pass.

Run: `npm test`

Expected: all frontend tests pass, 0 failures.

- [ ] **Step 6: Commit the integration**

```bash
git add frontend/src/components/NFTImageReveal.tsx frontend/src/components/NFTImageReveal.test.tsx frontend/src/components/NFTSection.tsx frontend/src/components/Profile.tsx frontend/src/services/webSocketConsumers.test.ts frontend/src/index.css
git commit -m "fix: restore owned chip sparkles"
```

### Task 4: Release and deploy version 1.0.57

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

- [ ] **Step 1: Bump the frontend version**

Run: `npm version 1.0.57 --no-git-tag-version`

Expected: both package files contain `1.0.57`.

- [ ] **Step 2: Regenerate and validate 10,000 previews**

Run:

```bash
npm run preview:generate -- \
  --input /Users/martin/Documents/我的文档/NFT/haku-final-10000/build/images \
  --output /private/tmp/haku-nft-color-previews-v2 \
  --expected-count 10000 \
  --concurrency 8
npm run preview:validate -- \
  --input /Users/martin/Documents/我的文档/NFT/haku-final-10000/build/images \
  --output /private/tmp/haku-nft-color-previews-v2 \
  --expected-count 10000
```

Expected: exactly 10,000 color WebPs validate; report total bytes before publishing.

- [ ] **Step 3: Pin previews and build production frontend**

Add the preview directory to the server Kubo node, save the returned immutable CID in the release shell variable `PREVIEW_CID`, and build with `VITE_IPFS_PREVIEW_CID="${PREVIEW_CID}" npm run build`. Run `npm test` and `npm run build` immediately before release.

- [ ] **Step 4: Commit, synchronize, push, and create PR**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: release frontend 1.0.57"
git fetch origin
git merge origin/main
npm run preview:test
(cd frontend && npm test && VITE_IPFS_PREVIEW_CID="${PREVIEW_CID}" npm run build)
git push -u origin fix/restore-chip-sparkles
gh pr create --base main --head fix/restore-chip-sparkles
```

- [ ] **Step 5: Deploy atomically and verify publicly**

Merge the approved PR, build the final merged tree with the new CID, upload to a staging directory, preserve the current `/usr/local/www/dist` as a timestamped backup, and atomically rename staging into place. Verify Nginx, public HTML version 1.0.57, asset hashes, API 200, representative color previews, exact coordinate presence in API responses, and no full-resolution original request for pre-mint cards.

- [ ] **Step 6: Retain rollback artifacts and clean temporary archives**

Keep Git tag `v1.0.56`, the prior server static directory, the new preview source directory until acceptance, and both IPFS recursive pins. Delete only exact upload archives and smoke-test output created by this release.
