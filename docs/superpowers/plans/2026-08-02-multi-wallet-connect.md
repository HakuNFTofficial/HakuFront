# Multi-Wallet Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace HakuFront’s first-injected-wallet connection with an explicit EIP-6963 wallet picker and an optional WalletConnect QR entry, then deploy the verified feature to the existing Haku server.

**Architecture:** Keep the existing wagmi/viem provider and add a focused normalization utility plus a standalone modal component. Wagmi performs EIP-6963 discovery, the utility removes generic/duplicate representations, and the modal connects only the user-selected connector. WalletConnect is registered only when a build-time Vite environment variable is present.

**Tech Stack:** React 18, TypeScript, wagmi 2, viem 2, WalletConnect connector, Tailwind CSS, Vitest, React Testing Library, jsdom, Vite, Nginx.

---

## File Map

- Create `frontend/src/wallet/walletOptions.ts`: connector normalization and connection-error presentation.
- Create `frontend/src/wallet/walletOptions.test.ts`: normalization and error-mapping unit tests.
- Create `frontend/src/components/WalletConnectModal.tsx`: accessible compact wallet picker.
- Create `frontend/src/components/WalletConnectModal.test.tsx`: modal behavior tests.
- Create `frontend/src/test/setup.ts`: React Testing Library cleanup and jest-dom matchers.
- Create `frontend/src/test/setup.test.tsx`: test-harness smoke test.
- Create `frontend/src/wagmi.test.ts`: configuration-level EIP-6963 and WalletConnect tests.
- Create `frontend/.env.example`: documented WalletConnect variable.
- Modify `frontend/package.json` and `frontend/package-lock.json`: test dependencies, scripts, and WalletConnect logger override.
- Modify `frontend/vite.config.ts`: Vitest jsdom configuration.
- Modify `frontend/tsconfig.json`: test matcher types.
- Modify `frontend/src/vite-env.d.ts`: type `VITE_WALLETCONNECT_PROJECT_ID`.
- Modify `frontend/src/wagmi.ts`: explicit discovery, generic injected fallback, conditional WalletConnect connector.
- Modify `frontend/src/App.tsx`: open the picker and connect through the selected connector.
- Modify `.gitignore`: keep local Vite environment files out of Git.
- Modify `README.md`: local and production WalletConnect configuration.

### Task 1: Establish the frontend test harness

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/tsconfig.json`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/test/setup.test.tsx`

- [ ] **Step 1: Install compatible test dependencies**

Run:

```bash
cd frontend
npm install --save-dev vitest@3.2.4 jsdom@26.1.0 @testing-library/react@16.3.0 @testing-library/jest-dom@6.6.3 @testing-library/user-event@14.6.1
```

Add these scripts to `frontend/package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Add the documented downstream security override:

```json
"overrides": {
  "@walletconnect/logger": {
    "pino": "10.0.0"
  }
}
```

- [ ] **Step 2: Configure Vitest**

Add to the top of `frontend/vite.config.ts`:

```ts
/// <reference types="vitest/config" />
```

Add this property inside `defineConfig`:

```ts
test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
},
```

Add matcher types to `frontend/tsconfig.json`:

```json
"types": ["vitest/globals", "@testing-library/jest-dom"]
```

- [ ] **Step 3: Write the test setup and smoke test**

Create `frontend/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())
```

Create `frontend/src/test/setup.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'

test('renders React components in jsdom', () => {
    render(<button type="button">Connect</button>)
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument()
})
```

- [ ] **Step 4: Run the smoke test**

Run: `npm test -- src/test/setup.test.tsx`

Expected: one passing test with no runtime errors.

- [ ] **Step 5: Commit the test harness**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/tsconfig.json frontend/src/test
git commit -m "test: add frontend component test harness"
```

### Task 2: Normalize wallet options and connection errors with TDD

**Files:**
- Create: `frontend/src/wallet/walletOptions.test.ts`
- Create: `frontend/src/wallet/walletOptions.ts`

- [ ] **Step 1: Write failing normalization tests**

Create `frontend/src/wallet/walletOptions.test.ts` with structural connector fixtures and these assertions:

```ts
import type { Connector } from 'wagmi'
import { describe, expect, test } from 'vitest'
import { getWalletConnectionErrorMessage, normalizeWalletOptions } from './walletOptions'

function connector(values: Partial<Connector> & Pick<Connector, 'id' | 'name' | 'type'>): Connector {
    return {
        uid: values.uid ?? `${values.id}-uid`,
        icon: values.icon,
        ...values,
    } as Connector
}

describe('normalizeWalletOptions', () => {
    test('prefers named EIP-6963 wallets over the generic injected fallback', () => {
        const options = normalizeWalletOptions([
            connector({ id: 'injected', name: 'Injected', type: 'injected' }),
            connector({ id: 'io.metamask', name: 'MetaMask', type: 'injected' }),
            connector({ id: 'io.rabby', name: 'Rabby Wallet', type: 'injected' }),
        ])
        expect(options.map((option) => option.connector.id)).toEqual(['io.metamask', 'io.rabby'])
    })

    test('keeps Browser Wallet when no named injected provider is discovered', () => {
        const options = normalizeWalletOptions([
            connector({ id: 'injected', name: 'Injected', type: 'injected' }),
        ])
        expect(options.map((option) => option.label)).toEqual(['Browser Wallet'])
    })

    test('deduplicates providers and places WalletConnect last', () => {
        const options = normalizeWalletOptions([
            connector({ id: 'walletConnect', name: 'WalletConnect', type: 'walletConnect' }),
            connector({ id: 'io.metamask', name: 'MetaMask', type: 'injected', uid: 'first' }),
            connector({ id: 'io.metamask', name: 'MetaMask', type: 'injected', uid: 'second' }),
        ])
        expect(options.map((option) => option.connector.uid)).toEqual(['first', 'walletConnect-uid'])
    })
})

describe('getWalletConnectionErrorMessage', () => {
    test('recognizes user rejection', () => {
        expect(getWalletConnectionErrorMessage({ name: 'UserRejectedRequestError' }))
            .toBe('Connection request was cancelled.')
    })

    test('recognizes a missing provider', () => {
        expect(getWalletConnectionErrorMessage({ name: 'ProviderNotFoundError' }))
            .toBe('This wallet is not available. Check the extension and try again.')
    })

    test('uses a recoverable fallback message', () => {
        expect(getWalletConnectionErrorMessage(new Error('relay failed')))
            .toBe('Could not connect to this wallet. Please try again.')
    })
})
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/wallet/walletOptions.test.ts`

Expected: FAIL because `./walletOptions` does not exist.

- [ ] **Step 3: Implement the normalization utility**

Create `frontend/src/wallet/walletOptions.ts`:

```ts
import type { Connector } from 'wagmi'

export interface WalletOption {
    connector: Connector
    label: string
    description: string
    isDetected: boolean
}

function isGenericInjected(connector: Connector) {
    return connector.type === 'injected' && connector.id === 'injected'
}

export function normalizeWalletOptions(connectors: readonly Connector[]): WalletOption[] {
    const unique = new Map<string, Connector>()
    for (const connector of connectors) {
        const key = `${connector.type}:${connector.id}`.toLowerCase()
        if (!unique.has(key)) unique.set(key, connector)
    }

    const values = [...unique.values()]
    const hasNamedInjected = values.some(
        (connector) => connector.type === 'injected' && !isGenericInjected(connector),
    )

    return values
        .filter((connector) => !(hasNamedInjected && isGenericInjected(connector)))
        .sort((left, right) => Number(left.type === 'walletConnect') - Number(right.type === 'walletConnect'))
        .map((connector) => ({
            connector,
            label: isGenericInjected(connector) ? 'Browser Wallet' : connector.name,
            description: connector.type === 'walletConnect'
                ? 'Scan with a mobile wallet'
                : isGenericInjected(connector)
                    ? 'Connect an installed browser wallet'
                    : 'Browser extension',
            isDetected: connector.type === 'injected' && !isGenericInjected(connector),
        }))
}

export function getWalletConnectionErrorMessage(error: unknown) {
    const value = error as { code?: number; message?: string; name?: string }
    const message = value?.message ?? ''
    if (
        value?.name === 'UserRejectedRequestError' ||
        value?.code === 4001 ||
        value?.code === 5000 ||
        /user rejected|request rejected|connection request reset/i.test(message)
    ) return 'Connection request was cancelled.'

    if (value?.name === 'ProviderNotFoundError') {
        return 'This wallet is not available. Check the extension and try again.'
    }

    if (value?.name === 'ResourceUnavailableRpcError' || /already pending|request already/i.test(message)) {
        return 'A wallet request is already open. Complete or close it, then try again.'
    }

    return 'Could not connect to this wallet. Please try again.'
}
```

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/wallet/walletOptions.test.ts`

Expected: all normalization and error tests pass.

- [ ] **Step 5: Commit the utility**

```bash
git add frontend/src/wallet
git commit -m "feat: normalize discovered wallet options"
```

### Task 3: Build the compact wallet picker with TDD

**Files:**
- Create: `frontend/src/components/WalletConnectModal.test.tsx`
- Create: `frontend/src/components/WalletConnectModal.tsx`

- [ ] **Step 1: Write failing component tests**

Create fixtures for a generic injected connector, MetaMask, Rabby, and WalletConnect. Test the public component API:

```tsx
<WalletConnectModal
    isOpen
    connectors={connectors}
    onClose={onClose}
    onConnect={onConnect}
/>
```

The test file must assert:

```ts
expect(screen.getByRole('dialog', { name: 'Connect Wallet' })).toBeInTheDocument()
expect(screen.queryByRole('button', { name: /Browser Wallet/i })).not.toBeInTheDocument()
expect(screen.getByRole('button', { name: /MetaMask/i })).toBeInTheDocument()
expect(screen.getByRole('button', { name: /Rabby Wallet/i })).toBeInTheDocument()
expect(screen.getByRole('button', { name: /WalletConnect/i })).toBeInTheDocument()
```

Use `userEvent` to verify that clicking Rabby passes the Rabby connector to `onConnect`, that a pending promise disables every wallet row, that a rejected promise shows the mapped inline error, and that close button, backdrop, and Escape call `onClose`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/components/WalletConnectModal.test.tsx`

Expected: FAIL because `WalletConnectModal` does not exist.

- [ ] **Step 3: Implement the modal**

Implement `WalletConnectModal` with this public interface:

```ts
interface WalletConnectModalProps {
    isOpen: boolean
    connectors: readonly Connector[]
    onClose: () => void
    onConnect: (connector: Connector) => Promise<unknown>
}
```

The component will use `normalizeWalletOptions(connectors)`, keep `pendingConnectorUid` and `errorMessage` state, and use this connection flow:

```ts
async function handleConnect(connector: Connector) {
    setPendingConnectorUid(connector.uid)
    setErrorMessage(null)
    try {
        await onConnect(connector)
        onClose()
    } catch (error) {
        if (import.meta.env.DEV) console.error('[WalletConnectModal] Connection failed:', error)
        setErrorMessage(getWalletConnectionErrorMessage(error))
    } finally {
        setPendingConnectorUid(null)
    }
}
```

Render a fixed full-screen backdrop and a `role="dialog"`, `aria-modal="true"`, `aria-labelledby="wallet-connect-title"` panel. Render one full-width button per normalized option, the wallet icon or a first-letter fallback, the approved label/description, a Detected badge for discovered injected providers, and a CSS spinner for the selected row. Cap the list height with scrolling. Close on Escape, backdrop click, and close button; restore focus to the previously active element when the modal closes.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/components/WalletConnectModal.test.tsx`

Expected: all modal behavior tests pass without console warnings.

- [ ] **Step 5: Commit the modal**

```bash
git add frontend/src/components/WalletConnectModal.tsx frontend/src/components/WalletConnectModal.test.tsx
git commit -m "feat: add multi-wallet selection modal"
```

### Task 4: Configure EIP-6963 and WalletConnect, then wire the picker

**Files:**
- Create: `frontend/src/wagmi.test.ts`
- Create: `frontend/.env.example`
- Modify: `frontend/src/wagmi.ts`
- Modify: `frontend/src/vite-env.d.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `.gitignore`
- Modify: `README.md`

- [ ] **Step 1: Write failing wagmi configuration tests**

Mock `createConfig`, `http`, `injected`, `walletConnect`, and `defineChain`; reset modules between cases and use `vi.stubEnv`. Assert that importing `./wagmi`:

```ts
expect(createConfig).toHaveBeenCalledWith(expect.objectContaining({
    multiInjectedProviderDiscovery: true,
    connectors: ['injected-connector', 'wallet-connect-connector'],
}))
expect(walletConnect).toHaveBeenCalledWith(expect.objectContaining({
    projectId: 'test-project-id',
    showQrModal: true,
}))
```

Add a second case with an empty environment value and assert connectors equals `['injected-connector']` and `walletConnect` was not called.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/wagmi.test.ts`

Expected: FAIL because the existing configuration has two injected connectors, does not explicitly enable discovery, and never calls `walletConnect`.

- [ ] **Step 3: Implement the wagmi configuration**

Change `frontend/src/wagmi.ts` to build connectors as follows:

```ts
import { http, createConfig } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim()
const appOrigin = typeof window === 'undefined'
    ? 'https://www.hakupump.club'
    : window.location.origin

const connectors = [
    injected({ shimDisconnect: true }),
    ...(walletConnectProjectId
        ? [walletConnect({
            projectId: walletConnectProjectId,
            showQrModal: true,
            metadata: {
                name: 'Haku',
                description: 'Haku decentralized exchange and NFT platform',
                url: appOrigin,
                icons: [`${appOrigin}/favicon.svg`],
            },
        })]
        : []),
]

export const config = createConfig({
    chains: [arcTestnet],
    connectors,
    multiInjectedProviderDiscovery: true,
    transports: {
        [arcTestnet.id]: http('https://rpc.testnet.arc.network'),
    },
})
```

Emit a development-only warning when `walletConnectProjectId` is absent.

- [ ] **Step 4: Wire the modal into App**

Import `WalletConnectModal`, replace `connect` with `connectAsync` from `useConnect`, add `isWalletConnectModalOpen` state, and replace the disconnected button handler with:

```tsx
onClick={() => setIsWalletConnectModalOpen(true)}
```

Render once near the existing `NetworkMismatchModal`:

```tsx
<WalletConnectModal
    isOpen={isWalletConnectModalOpen}
    connectors={connectors}
    onClose={() => setIsWalletConnectModalOpen(false)}
    onConnect={(selectedConnector) => connectAsync({ connector: selectedConnector })}
/>
```

Remove all references to `connectors[0]` and the old `isConnecting` button text.

- [ ] **Step 5: Add environment and operator documentation**

Create `frontend/.env.example`:

```dotenv
# Reown/WalletConnect project identifier used by the browser build.
VITE_WALLETCONNECT_PROJECT_ID=replace_with_reown_project_id
```

Add `frontend/.env`, `frontend/.env.local`, and `frontend/.env.*.local` to `.gitignore`. Extend `ImportMetaEnv` with:

```ts
readonly VITE_WALLETCONNECT_PROJECT_ID?: string
```

Document local `.env.local`, production build-time configuration, `https://www.hakupump.club`, and Reown Allowed Domains in `README.md` without recording the real Project ID.

- [ ] **Step 6: Verify configuration and integration**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and Vite produces a successful production bundle.

- [ ] **Step 7: Commit the integration**

```bash
git add .gitignore README.md frontend/.env.example frontend/src/vite-env.d.ts frontend/src/wagmi.ts frontend/src/wagmi.test.ts frontend/src/App.tsx
git commit -m "feat: connect selected browser and mobile wallets"
```

### Task 5: Review and verify the complete feature

**Files:**
- Review all files changed from `origin/main`.

- [ ] **Step 1: Run focused and complete checks**

```bash
cd frontend
npm test
npm run build
git diff --check origin/main...
```

Expected: zero failing tests, successful TypeScript/Vite build, and no whitespace errors.

- [ ] **Step 2: Inspect configuration and security invariants**

Verify that the real Project ID and server password are absent from `git diff`, `git grep`, staged content, and commit history. Verify `connectors[0]` no longer exists, `multiInjectedProviderDiscovery` is explicitly true, and WalletConnect is conditional.

- [ ] **Step 3: Perform code review**

Use `superpowers:requesting-code-review`, address any high-confidence findings with new RED/GREEN tests, and rerun the complete checks.

### Task 6: Synchronize main and publish the pull request

**Files:**
- Potential conflict resolutions only.

- [ ] **Step 1: Synchronize immediately before delivery**

```bash
git fetch origin main
git merge --no-edit origin/main
```

If the merge changes the tree, rerun `npm test` and `npm run build` from `frontend`.

- [ ] **Step 2: Push the feature branch**

```bash
git push -u origin feat/multi-wallet-connect
```

- [ ] **Step 3: Open a pull request**

Create a PR titled `Add EIP-6963 and WalletConnect wallet picker` with the design, test results, build result, configuration note, and deployment plan.

### Task 7: Build with the real Project ID and deploy the verified commit

**Files:**
- Build output: `frontend/dist/`
- Remote active document root: `/usr/local/www/dist`
- Remote staging root: `/usr/local/www/dist.next-walletconnect-20260802`
- Remote recoverable backup: `/usr/local/www/dist.previous-walletconnect-20260802`

- [ ] **Step 1: Build the exact pushed commit with production configuration**

Start an interactive local shell, export the provided Project ID without printing it, run `npm run build`, and verify the generated JavaScript contains the configured identifier using a quiet match. Record the exact commit with `git rev-parse HEAD`.

- [ ] **Step 2: Package and upload the static bundle**

Create `/private/tmp/hakufront-walletconnect-20260802.tar.gz` from `frontend/dist`. Upload it interactively to `/tmp/hakufront-walletconnect-20260802.tar.gz` on `119.8.235.187`; do not place credentials in command lines or files.

- [ ] **Step 3: Stage and validate on the server**

Over interactive SSH, first assert that `/usr/local/www/dist.next-walletconnect-20260802` and `/usr/local/www/dist.previous-walletconnect-20260802` do not exist, then create the staging directory, extract the archive, assert `index.html` and hashed JS/CSS assets exist, and run `nginx -t`. Do not modify `/usr/local/www/dist` until every staging check succeeds.

- [ ] **Step 4: Activate with a recoverable directory swap**

Move the current `/usr/local/www/dist` to `/usr/local/www/dist.previous-walletconnect-20260802`, then move `/usr/local/www/dist.next-walletconnect-20260802` to `/usr/local/www/dist`. Nginx serves the new static files immediately; no service restart is required.

- [ ] **Step 5: Smoke test and rollback on failure**

Run HTTPS checks for `/`, the new hashed JS asset, `/api`, and the redirect from the bare domain. Confirm the served HTML references the new asset hash and that the bundle includes the WalletConnect UI/configuration. If any frontend check fails, move the failed directory aside and restore the recorded previous directory.

- [ ] **Step 6: Report delivery**

Report branch, verified commit, test counts, build result, PR URL, deployed asset hash, production HTTP results, and the recoverable backup directory. Recommend rotating the root password because it was pasted into the conversation.
