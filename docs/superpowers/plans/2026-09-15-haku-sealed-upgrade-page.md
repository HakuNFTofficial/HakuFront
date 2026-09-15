# Haku Sealed Upgrade Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an environment-controlled static Haku Sealed upgrade page that prevents the unavailable dApp UI from mounting.

**Architecture:** Parse the build flag in a focused configuration helper, select the maintenance page at the React root boundary, and keep all presentation inside one component plus one stylesheet. Vite keeps its normal preview-CID validation unless the explicit maintenance flag makes that data irrelevant.

**Tech Stack:** React 18, TypeScript, Tailwind-compatible CSS, Vite, Vitest, Testing Library

---

### Task 1: Define the maintenance-mode contract

**Files:**
- Create: `frontend/src/config/maintenance.ts`
- Create: `frontend/src/config/maintenance.test.ts`
- Modify: `frontend/src/config/productionBuild.test.ts`
- Modify: `frontend/vite.config.ts`

- [x] **Step 1: Write failing tests for strict flag parsing and the maintenance build exception**

```ts
expect(isMaintenanceMode('true')).toBe(true)
expect(isMaintenanceMode(undefined)).toBe(false)
expect(isMaintenanceMode('TRUE')).toBe(false)

vi.stubEnv('VITE_MAINTENANCE_MODE', 'true')
vi.stubEnv('VITE_IPFS_PREVIEW_CID', '')
await expect(build({ configFile, logLevel: 'silent', build: { write: false } })).resolves.toBeDefined()
```

- [x] **Step 2: Run the focused tests and verify they fail because maintenance support does not exist**

Run: `npm test -- src/config/maintenance.test.ts src/config/productionBuild.test.ts`

Expected: the maintenance module is missing and the maintenance build still throws `FRONTEND_BUILD_ENV_MISSING`.

- [x] **Step 3: Implement strict parsing and conditional build validation**

```ts
export function isMaintenanceMode(value: string | undefined): boolean {
    return value === 'true'
}

const maintenanceMode = env.VITE_MAINTENANCE_MODE === 'true'
const requiredFields = maintenanceMode ? [] : ['VITE_IPFS_PREVIEW_CID'] as const
```

- [x] **Step 4: Re-run the focused tests and verify they pass**

Run: `npm test -- src/config/maintenance.test.ts src/config/productionBuild.test.ts`

Expected: both test files pass.

### Task 2: Build the static upgrade surface

**Files:**
- Create: `frontend/src/components/MaintenancePage.tsx`
- Create: `frontend/src/components/MaintenancePage.css`
- Create: `frontend/src/components/MaintenancePage.test.tsx`

- [x] **Step 1: Write a failing render test**

```tsx
render(<MaintenancePage />)
expect(screen.getByRole('heading', { name: 'Sealing the next chapter.' })).toBeInTheDocument()
expect(screen.getByText(/Our dApp will be paused during/)).toBeInTheDocument()
expect(screen.getByRole('link', { name: 'Follow Haku on X' })).toHaveAttribute('href', 'https://x.com/HakuNFTofficial')
expect(screen.getByRole('link', { name: 'Join Haku on Discord' })).toHaveAttribute('href', 'https://discord.com/invite/zURfGaNf6p')
```

- [x] **Step 2: Run the component test and verify it fails because the page is missing**

Run: `npm test -- src/components/MaintenancePage.test.tsx`

Expected: the `MaintenancePage` module cannot be resolved.

- [x] **Step 3: Implement the page and responsive CSS**

Create a semantic `<main>` with a compact brand header, the Haku Sealed label, headline, exact announcement, accessible social links, and text status. Build the selected concentric seal with CSS pseudo-elements and add `@media (prefers-reduced-motion: reduce)` to stop animation.

- [x] **Step 4: Re-run the component test and verify it passes**

Run: `npm test -- src/components/MaintenancePage.test.tsx`

Expected: the page test passes.

### Task 3: Gate the dApp at the root

**Files:**
- Create: `frontend/src/DappRoot.tsx`
- Create: `frontend/src/RootView.tsx`
- Create: `frontend/src/RootView.test.tsx`
- Create: `frontend/src/mainMaintenanceIsolation.test.ts`
- Modify: `frontend/src/main.tsx`

- [x] **Step 1: Write a failing root-selection test**

```tsx
render(<RootView maintenanceMode={true}><div>Live dApp</div></RootView>)
expect(screen.getByRole('heading', { name: 'Sealing the next chapter.' })).toBeInTheDocument()
expect(screen.queryByText('Live dApp')).not.toBeInTheDocument()

expect(mainSource).toContain("import('./DappRoot')")
expect(mainSource).not.toMatch(/from ['"]\.\/wagmi['"]/)
```

- [x] **Step 2: Run the root test and verify it fails because the gate is missing**

Run: `npm test -- src/RootView.test.tsx`

Expected: the `RootView` module cannot be resolved and the entry still statically imports the dApp provider modules.

- [x] **Step 3: Implement and wire the root gate**

```tsx
export function RootView({ maintenanceMode, children }: PropsWithChildren<{ maintenanceMode: boolean }>) {
    return maintenanceMode ? <MaintenancePage /> : <>{children}</>
}

if (maintenanceMode) {
    root.render(<RootView maintenanceMode />)
} else {
    void import('./DappRoot').then(({ DappRoot }) => {
        root.render(<RootView maintenanceMode={false}><DappRoot /></RootView>)
    })
}
```

- [x] **Step 4: Re-run the root and component tests**

Run: `npm test -- src/RootView.test.tsx src/mainMaintenanceIsolation.test.ts src/components/MaintenancePage.test.tsx`

Expected: all three test files pass and the maintenance entry has no static dApp provider imports.

### Task 4: Release verification

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

- [x] **Step 1: Bump the frontend patch version to `1.0.65`**

Run: `npm version 1.0.65 --no-git-tag-version`

Expected: both package files report version `1.0.65`.

- [x] **Step 2: Run the full frontend suite**

Run: `npm test`

Expected: all test files pass with zero failures.

- [x] **Step 3: Build the maintenance release**

Run: `VITE_MAINTENANCE_MODE=true npm run build`

Expected: TypeScript and Vite finish successfully without `VITE_IPFS_PREVIEW_CID`.

- [x] **Step 4: Inspect the production page in a browser at desktop and mobile widths**

Run: `npm run dev -- --host 127.0.0.1`

Expected: the maintenance page fills the viewport, the dApp is absent, links are usable, and the copy remains readable at 390px and 1440px widths.
