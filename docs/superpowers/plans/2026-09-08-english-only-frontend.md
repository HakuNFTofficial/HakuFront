# English-Only Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Chinese runtime messages and comments from the first-party frontend and prevent them from returning.

**Architecture:** Keep the current RPC error-state flow and replace only its display constants. Enforce the language policy with a focused Vitest source scan covering first-party frontend code and operational scripts while excluding generated and third-party content.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Bash

---

### Task 1: Add the English-only regression policy

**Files:**
- Create: `frontend/src/config/englishLanguagePolicy.test.ts`

- [ ] **Step 1: Write the failing policy test**

Create a test that recursively inspects `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`,
`.cjs`, `.css`, `.html`, and `.sh` files below `frontend/`. Exclude
`node_modules`, `dist`, and `coverage`, collect every line matching
`/\p{Script=Han}/u`, and assert that the formatted violation list is empty.

- [ ] **Step 2: Run the test and verify the existing Chinese content fails it**

Run: `npm test -- --run src/config/englishLanguagePolicy.test.ts`

Expected: FAIL listing `rpcDisplay.ts`, `App.tsx`, `vite.config.ts`, `build.sh`,
`deploy.sh`, and `diagnose-nginx.sh`.

- [ ] **Step 3: Commit the policy test with the translations in Task 2**

The test intentionally remains red until the production and operational strings
are translated.

### Task 2: Translate the frontend and verify the release

**Files:**
- Modify: `frontend/src/utils/rpcDisplay.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/build.sh`
- Modify: `frontend/deploy.sh`
- Modify: `frontend/diagnose-nginx.sh`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Test: `frontend/src/config/englishLanguagePolicy.test.ts`

- [ ] **Step 1: Replace the runtime strings**

Set the constants to:

```ts
export const RPC_UNAVAILABLE_MESSAGE = 'On-chain data is temporarily unavailable. Please try again later.'
export const BALANCE_UNAVAILABLE_LABEL = 'Temporarily unavailable'
```

- [ ] **Step 2: Translate comments and operational output**

Translate every remaining Han-character line in the scoped files to concise
English without changing commands, paths, branching, or error handling. Preserve
the scripts' existing behavior and interaction choices.

- [ ] **Step 3: Bump the frontend patch version**

Advance the package version from `1.0.63` to `1.0.64` in both package manifests so
the existing client update mechanism detects the release.

- [ ] **Step 4: Run the policy test and complete frontend verification**

Run:

```bash
npm test -- --run src/config/englishLanguagePolicy.test.ts
npm test
VITE_IPFS_PREVIEW_CID=<existing-production-cid> npm run build
```

Expected: all tests pass, the production build exits zero, and the generated
bundle contains the English RPC messages with no Chinese source text.

- [ ] **Step 5: Commit, synchronize, and release**

Commit the implementation, fetch and merge the latest `origin/main`, rerun the
full verification, push `fix/english-only-frontend`, create a pull request, merge
the pull request, pull the merged `main`, rebuild with the existing production
environment, deploy using an atomic directory swap with a retained backup, and
verify the public site serves frontend version `1.0.64` and the new English text.
