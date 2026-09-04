# Fragment Card Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make native right-click image saving on Swap export a 512×512 fragment PNG and compact Profile NFT cards to 200 pixels.

**Architecture:** Add a pure canvas composition helper, let the existing overlay request one stable PNG snapshot, and expose it through a save-only image layer without changing visible animation. Limit Profile sizing to its grid classes.

**Tech Stack:** React, TypeScript, Canvas 2D, Vitest, Testing Library, Tailwind CSS, Vite.

---

### Task 1: Compose a promotional fragment PNG

**Files:**
- Create: `frontend/src/nft/fragmentShareImage.ts`
- Create: `frontend/src/nft/fragmentShareImage.test.ts`

- [ ] Write failing tests that require a 512×512 canvas, dark preview draw before exact color chip draws, PNG blob output, and explicit failure when export returns no blob.
- [ ] Run `npm test -- --run src/nft/fragmentShareImage.test.ts` and confirm the missing implementation fails.
- [ ] Implement the minimal composition helper using validated coordinates and `scaleChipRect`.
- [ ] Rerun the focused test and confirm it passes.

### Task 2: Make the native context menu target the PNG

**Files:**
- Modify: `frontend/src/components/NFTChipOverlay.tsx`
- Modify: `frontend/src/components/NFTImageReveal.tsx`
- Modify: `frontend/src/components/NFTChipOverlay.test.tsx`
- Modify: `frontend/src/components/NFTImageReveal.test.tsx`

- [ ] Write failing component tests for snapshot delivery, the invisible PNG image target, anonymous CORS, and blob URL cleanup.
- [ ] Run the two component test files and confirm the new assertions fail.
- [ ] Generate a stable snapshot after exact chips draw, surface structured errors, and manage the blob URL lifecycle in `NFTImageReveal`.
- [ ] Rerun the component tests and confirm they pass.

### Task 3: Compact Profile cards

**Files:**
- Modify: `frontend/src/components/NFTLifecycleGrid.tsx`
- Modify: `frontend/src/components/ProfileImageViewer.test.tsx`

- [ ] Add a failing assertion for an auto-fill grid with fixed 200-pixel columns.
- [ ] Run the Profile test and confirm it fails.
- [ ] Apply the 200-pixel grid/card sizing while retaining square media and all actions.
- [ ] Rerun the Profile test and confirm it passes.

### Task 4: Release and deploy

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

- [ ] Bump the frontend version from `1.0.60` to `1.0.61`.
- [ ] Run `npm test -- --run` and require all tests to pass.
- [ ] Run the configured production build and verify the generated assets.
- [ ] Fetch and merge the latest `origin/main`, rerun verification, push the branch, create and merge a PR.
- [ ] Deploy through a staged atomic directory swap, retain the prior dist backup, and verify the new public asset and version.
