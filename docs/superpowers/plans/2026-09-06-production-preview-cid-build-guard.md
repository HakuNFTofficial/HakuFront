# Production Preview CID Build Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent production frontend releases from silently omitting the immutable NFT preview CID and restore Profile preview images.

**Architecture:** Validate release-only configuration while Vite loads its production build config. Keep the preview CID external to source, fail with a structured actionable error when absent, and explicitly inject the verified CID during the server build.

**Tech Stack:** TypeScript, Vite 6, Vitest, React 18, Nginx static deployment

---

### Task 1: Lock the Missing-CID Failure With an Integration Test

**Files:**
- Create: `frontend/src/config/productionBuild.test.ts`

- [ ] **Step 1: Write the failing test**

Create a Vitest test that removes `VITE_IPFS_PREVIEW_CID`, invokes Vite's real
production `build()` with `write: false`, and expects a rejection containing
`FRONTEND_BUILD_ENV_MISSING` and `VITE_IPFS_PREVIEW_CID`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- src/config/productionBuild.test.ts`

Expected: FAIL because the current production Vite build succeeds without the
required CID.

### Task 2: Add the Production Build Guard

**Files:**
- Modify: `frontend/vite.config.ts`
- Test: `frontend/src/config/productionBuild.test.ts`

- [ ] **Step 1: Load and validate the build environment**

Change the Vite config to the command-aware callback form, call `loadEnv`, and
for `command === 'build' && mode === 'production'` collect blank required fields.
Throw `new Error(JSON.stringify({ code: 'FRONTEND_BUILD_ENV_MISSING', missingFields,
command, mode }))` when any field is missing.

- [ ] **Step 2: Run the focused test to verify it passes**

Run: `cd frontend && npm test -- src/config/productionBuild.test.ts`

Expected: PASS.

- [ ] **Step 3: Run all frontend tests**

Run: `cd frontend && npm test`

Expected: all tests PASS.

- [ ] **Step 4: Verify both build paths**

Run the production build once without the CID and expect the structured failure.
Run it again with the verified CID and expect a successful build whose bundle
contains that CID.

### Task 3: Integrate and Deploy

**Files:**
- Modify: no additional source files

- [ ] **Step 1: Commit and push the fix branch**

Commit the spec, plan, integration test, and Vite guard; fetch and merge the
latest `origin/main`; rerun tests and the configured production build; then push
`fix/require-preview-cid-build`.

- [ ] **Step 2: Create and merge the pull request**

Create a PR describing the root cause, structured build failure, and verification.
After checks pass, merge the PR into `main`.

- [ ] **Step 3: Build from production main**

On the server, pull the merged `main`, verify representative preview objects,
build with the explicit immutable CID, confirm the bundle contains it, back up
the currently served directory, and atomically replace the static assets.

- [ ] **Step 4: Verify production**

Confirm the site returns HTTP 200, the new version metadata is served, Profile
preview images load with non-zero natural dimensions, and no `Preview unavailable`
placeholder remains for NFTs whose preview objects return 200.
