# IPFS Image Gateway Hotfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore production NFT images by replacing the unavailable `ipfs.io` default with the verified Pinata gateway while allowing a build-time gateway override.

**Architecture:** Keep `frontend/src/config/ipfs.ts` as the only browser IPFS URL source. Normalize an optional Vite environment override once at module load, then let all existing components continue using the existing URL helpers.

**Tech Stack:** TypeScript, Vite, Vitest, React frontend

---

### Task 1: Specify gateway URL behavior

**Files:**
- Create: `frontend/src/config/ipfs.test.ts`
- Test: `frontend/src/config/ipfs.test.ts`

- [ ] **Step 1: Write the failing default-gateway test**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('IPFS configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('uses the Pinata gateway for image URLs by default', async () => {
    vi.stubEnv('VITE_IPFS_GATEWAY', '')
    const { getIPFSImageUrl } = await import('./ipfs')

    expect(getIPFSImageUrl('572.png')).toBe(
      'https://gateway.pinata.cloud/ipfs/QmWEBUGXYwUcbcMtJkyixobY8ajoDrGtdqK25eEF3GaUfb/572.png',
    )
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd frontend
npm test -- src/config/ipfs.test.ts
```

Expected: FAIL because the current URL starts with `https://ipfs.io/ipfs/`.

- [ ] **Step 3: Add override and conversion tests while still RED**

Add inside the same `describe` block:

```ts
it('uses the selected gateway when converting an IPFS URI', async () => {
  vi.stubEnv('VITE_IPFS_GATEWAY', '')
  const { convertIPFSToHttp } = await import('./ipfs')

  expect(convertIPFSToHttp('ipfs://bafy-image')).toBe(
    'https://gateway.pinata.cloud/ipfs/bafy-image',
  )
})

it('normalizes a gateway override without a trailing slash', async () => {
  vi.stubEnv('VITE_IPFS_GATEWAY', 'https://images.example/ipfs')
  const { getIPFSImageUrl } = await import('./ipfs')

  expect(getIPFSImageUrl('572.png')).toBe(
    'https://images.example/ipfs/QmWEBUGXYwUcbcMtJkyixobY8ajoDrGtdqK25eEF3GaUfb/572.png',
  )
})
```

- [ ] **Step 4: Run the focused test and confirm failures are gateway-related**

Run:

```bash
cd frontend
npm test -- src/config/ipfs.test.ts
```

Expected: the Pinata assertions fail against `ipfs.io`, and the override assertion fails because the current module ignores `VITE_IPFS_GATEWAY`.

### Task 2: Implement the shared gateway selection

**Files:**
- Modify: `frontend/src/config/ipfs.ts:1-16`
- Test: `frontend/src/config/ipfs.test.ts`

- [ ] **Step 1: Replace the fixed gateway with a normalized default or override**

Replace the current development/production gateway selection with:

```ts
const DEFAULT_IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/'

function normalizeIPFSGateway(gateway: string): string {
  return `${gateway.replace(/\/+$/, '')}/`
}

const IPFS_GATEWAY = normalizeIPFSGateway(
  import.meta.env.VITE_IPFS_GATEWAY || DEFAULT_IPFS_GATEWAY,
)
```

Keep `IMAGE_CID`, `METADATA_CID`, `ROOT_CID`, `getIPFSImageUrl`, `getIPFSMetadataUrl`, and `convertIPFSToHttp` unchanged.

- [ ] **Step 2: Run the focused test and verify GREEN**

Run:

```bash
cd frontend
npm test -- src/config/ipfs.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 3: Run the full frontend suite**

Run:

```bash
cd frontend
npm test
```

Expected: all tests pass with zero failures.

- [ ] **Step 4: Build the production frontend**

Run:

```bash
cd frontend
npm run build
```

Expected: TypeScript and Vite complete successfully, and the generated bundle contains `gateway.pinata.cloud/ipfs/` but not the previous hard-coded `ipfs.io/ipfs/` gateway.

- [ ] **Step 5: Commit the tested implementation**

```bash
git add frontend/src/config/ipfs.ts frontend/src/config/ipfs.test.ts
git commit -m "fix: restore NFT images through Pinata"
```

### Task 3: Verify the release and publish the branch

**Files:**
- Verify: `frontend/dist/index.html`
- Verify: generated `frontend/dist/assets/*.js`

- [ ] **Step 1: Check a representative live image**

Run:

```bash
curl -I -sS --max-time 20 \
  https://gateway.pinata.cloud/ipfs/QmWEBUGXYwUcbcMtJkyixobY8ajoDrGtdqK25eEF3GaUfb/572.png
```

Expected: HTTP 200, `content-type: image/png`, and `access-control-allow-origin: *`.

- [ ] **Step 2: Synchronize with the latest main and reverify**

Run `git fetch origin`, merge `origin/main` into `fix/ipfs-gateway-fallback`, then rerun the focused test, full suite, and production build. Resolve conflicts without discarding unrelated changes.

- [ ] **Step 3: Push and create the pull request**

```bash
git push -u origin fix/ipfs-gateway-fallback
gh pr create --base main --head fix/ipfs-gateway-fallback
```

The PR body must state the observed gateway timeout, the verified Pinata response, tests/build results, deployment requirement, and rollback to the previous static bundle.

- [ ] **Step 4: Inspect the production deployment procedure**

Use only an existing SSH key or an approved deployment mechanism. Do not reuse credentials copied from project notes. Before changing production, identify the active web root, save the currently deployed static bundle path for rollback, and confirm the new `index.html` references the newly built asset hashes.

- [ ] **Step 5: Deploy and verify production when safe credentials are available**

After deploying the new static bundle, verify `https://www.hakupump.club/` returns the new version and that the NFT cards request Pinata URLs with nonzero image dimensions. If safe deployment credentials are unavailable, stop after the PR and report the exact missing access rather than copying exposed secrets.
