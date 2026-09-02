# NFT Silhouette Preview and Original Image Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace pre-mint original-image downloads with 512×512 WebP silhouettes and let Profile users open minted originals in an accessible viewer.

**Architecture:** A pure frontend image policy maps lifecycle status to either a preview filename or the existing original filename. `NFTImageReveal` becomes a lightweight lazy image renderer with no canvas or chip-coordinate request, while Profile supplies the minted-only viewer action. A deterministic Sharp-based CLI generates and validates the separate 10,000-file preview collection before it is pinned and configured by CID.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Vite, Node.js, Sharp, IPFS

---

## File Map

- Create `frontend/src/nft/imagePolicy.ts`: pure lifecycle and filename selection.
- Create `frontend/src/nft/imagePolicy.test.ts`: source-selection and validation coverage.
- Modify `frontend/src/config/ipfs.ts`: preview CID configuration and URL builder.
- Modify `frontend/src/config/ipfs.test.ts`: preview URL and missing-config coverage.
- Replace `frontend/src/components/NFTImageReveal.tsx`: lightweight preview/original renderer.
- Create `frontend/src/components/NFTImageReveal.test.tsx`: rendered URL, failure, and click behavior.
- Modify `frontend/src/nft/displayPolicy.ts` and its tests: remove obsolete chip-coordinate policy.
- Modify `frontend/src/services/webSocketConsumers.test.ts`: remove obsolete canvas request assertions.
- Modify `frontend/src/components/Profile.tsx`: minted-image selection and viewer state.
- Modify `frontend/src/components/NFTImageViewer.tsx`: minted guard and dialog accessibility.
- Create `frontend/src/components/ProfileImageViewer.test.tsx`: Profile-to-viewer integration.
- Create `frontend/src/components/NFTImageViewer.test.tsx`: dialog dismissal coverage.
- Create `scripts/nft-previews/preview-lib.mjs`: deterministic generation and validation.
- Create `scripts/nft-previews/preview-lib.test.mjs`: fixture-based generator coverage.
- Create `scripts/nft-previews/generate.mjs`: generation CLI.
- Create `scripts/nft-previews/validate.mjs`: validation CLI.
- Modify `package.json` and `package-lock.json`: Sharp and preview scripts.
- Modify `frontend/.env.example`: document required preview CID.
- Modify `README.md`: generation, pinning, configuration, and verification runbook.

### Task 1: Centralize NFT image source selection

**Files:**
- Create: `frontend/src/nft/imagePolicy.ts`
- Create: `frontend/src/nft/imagePolicy.test.ts`
- Modify: `frontend/src/config/ipfs.ts`
- Modify: `frontend/src/config/ipfs.test.ts`

- [ ] **Step 1: Write the failing lifecycle-policy tests**

Create `frontend/src/nft/imagePolicy.test.ts` with cases for statuses 0, 1, and 2,
deterministic extension replacement, and missing `file_name`:

```ts
import { describe, expect, it } from 'vitest'
import { resolveNftImageSource } from './imagePolicy'

describe('NFT image policy', () => {
    it.each([0, 1])('uses a WebP silhouette for is_mint=%i', (is_mint) => {
        expect(resolveNftImageSource({ nft_id: 3995, file_name: '3995.png', is_mint }))
            .toEqual({ ok: true, kind: 'preview', fileName: '3995.webp' })
    })

    it('uses the exact original filename only after mint completion', () => {
        expect(resolveNftImageSource({ nft_id: 3995, file_name: '3995.png', is_mint: 2 }))
            .toEqual({ ok: true, kind: 'original', fileName: '3995.png' })
    })

    it('replaces only the final extension in nested canonical filenames', () => {
        expect(resolveNftImageSource({ nft_id: 7, file_name: 'set.v2/7.final.png', is_mint: 0 }))
            .toEqual({ ok: true, kind: 'preview', fileName: 'set.v2/7.final.webp' })
    })

    it('reports required business data instead of guessing a filename', () => {
        expect(resolveNftImageSource({ nft_id: 3995, file_name: null, is_mint: 0 }))
            .toEqual({
                ok: false,
                code: 'NFT_IMAGE_SOURCE_MISSING',
                nftId: 3995,
                status: 0,
                missingFields: ['file_name'],
            })
    })
})
```

- [ ] **Step 2: Run the policy test and verify RED**

Run: `npm test -- src/nft/imagePolicy.test.ts`

Expected: FAIL because `./imagePolicy` does not exist.

- [ ] **Step 3: Implement the pure image policy**

Create `frontend/src/nft/imagePolicy.ts`:

```ts
export interface NFTImageState {
    nft_id: number
    file_name: string | null
    is_mint?: number
}

export type NFTImageSource =
    | { ok: true; kind: 'preview' | 'original'; fileName: string }
    | {
        ok: false
        code: 'NFT_IMAGE_SOURCE_MISSING'
        nftId: number
        status: number
        missingFields: ['file_name']
    }

function previewFileName(fileName: string): string {
    const finalSlash = fileName.lastIndexOf('/')
    const finalDot = fileName.lastIndexOf('.')
    const stem = finalDot > finalSlash ? fileName.slice(0, finalDot) : fileName
    return `${stem}.webp`
}

export function resolveNftImageSource(nft: NFTImageState): NFTImageSource {
    if (!nft.file_name?.trim()) {
        return {
            ok: false,
            code: 'NFT_IMAGE_SOURCE_MISSING',
            nftId: nft.nft_id,
            status: nft.is_mint ?? 0,
            missingFields: ['file_name'],
        }
    }

    return nft.is_mint === 2
        ? { ok: true, kind: 'original', fileName: nft.file_name }
        : { ok: true, kind: 'preview', fileName: previewFileName(nft.file_name) }
}

export function canViewNftOriginal(nft: NFTImageState): boolean {
    return nft.is_mint === 2 && Boolean(nft.file_name?.trim())
}
```

- [ ] **Step 4: Add failing preview-CID tests**

Extend `frontend/src/config/ipfs.test.ts`:

```ts
it('builds preview URLs from the configured immutable preview CID', async () => {
  vi.stubEnv('VITE_IPFS_GATEWAY', 'https://images.example/ipfs')
  vi.stubEnv('VITE_IPFS_PREVIEW_CID', 'bafy-preview')
  const { getIPFSPreviewUrl } = await import('./ipfs')

  expect(getIPFSPreviewUrl('3995.webp')).toBe(
    'https://images.example/ipfs/bafy-preview/3995.webp',
  )
})

it('fails explicitly when the preview CID is missing', async () => {
  vi.stubEnv('VITE_IPFS_PREVIEW_CID', '')
  const { getIPFSPreviewUrl } = await import('./ipfs')

  expect(() => getIPFSPreviewUrl('3995.webp')).toThrowError(
    'Missing required VITE_IPFS_PREVIEW_CID',
  )
})
```

- [ ] **Step 5: Run the preview-CID tests and verify RED**

Run: `npm test -- src/config/ipfs.test.ts`

Expected: FAIL because `getIPFSPreviewUrl` is not exported.

- [ ] **Step 6: Implement preview URL configuration**

In `frontend/src/config/ipfs.ts`, export a strict preview URL builder. Read the preview
CID when the function is called so tests and build environments cannot retain a stale
module-initialization value:

```ts
export const IPFS_CONFIG = {
    GATEWAY: IPFS_GATEWAY,
    IMAGE_CID: 'QmWALFJVacNc1EpMKdxMuCedDVcNwmWoc3L2jqX8erAb6L',
    METADATA_CID: 'Qmeub98s5ZPPANZVksF8Vs6CbPT3Xe5PEmkFEhgMP9ovzK',
    ROOT_CID: 'QmUCmfy48PsvUQBEHxeqPZTzQabFDY8U1CkT4ZFQN1pSQH',
} as const

export function getIPFSPreviewUrl(fileName: string): string {
    const previewCID = import.meta.env.VITE_IPFS_PREVIEW_CID?.trim() || ''
    if (!previewCID) {
        throw new Error('Missing required VITE_IPFS_PREVIEW_CID')
    }
    return `${IPFS_CONFIG.GATEWAY}${previewCID}/${fileName}`
}
```

- [ ] **Step 7: Verify GREEN and commit**

Run: `npm test -- src/nft/imagePolicy.test.ts src/config/ipfs.test.ts`

Expected: both files pass.

Commit:

```bash
git add frontend/src/nft/imagePolicy.ts frontend/src/nft/imagePolicy.test.ts frontend/src/config/ipfs.ts frontend/src/config/ipfs.test.ts
git commit -m "feat: select lightweight NFT preview sources"
```

### Task 2: Replace pre-mint canvas downloads with silhouettes

**Files:**
- Replace: `frontend/src/components/NFTImageReveal.tsx`
- Create: `frontend/src/components/NFTImageReveal.test.tsx`
- Modify: `frontend/src/nft/displayPolicy.ts`
- Modify: `frontend/src/nft/displayPolicy.test.ts`
- Modify: `frontend/src/services/webSocketConsumers.test.ts`

- [ ] **Step 1: Write failing component tests**

Create `frontend/src/components/NFTImageReveal.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NFTImageReveal } from './NFTImageReveal'

const nft = {
    nft_id: 3995,
    file_name: '3995.png',
    all_chips_owned: false,
    owned_chips_count: 23,
    total_chips_count: 10_000,
}

describe('NFTImageReveal', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_IPFS_PREVIEW_CID', 'bafy-preview')
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
    })

    it.each([0, 1])('renders only the silhouette for is_mint=%i', (is_mint) => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
        render(<NFTImageReveal nft={{ ...nft, is_mint }} />)

        expect(screen.getByRole('img', { name: 'NFT #3995 silhouette' }))
            .toHaveAttribute('src', expect.stringContaining('/bafy-preview/3995.webp'))
        expect(screen.getByRole('img')).not.toHaveAttribute(
            'src',
            expect.stringContaining('/QmWALFJVacNc1EpMKdxMuCedDVcNwmWoc3L2jqX8erAb6L/'),
        )
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('renders the original only for is_mint=2 and exposes the viewer action', () => {
        const onViewOriginal = vi.fn()
        render(<NFTImageReveal nft={{ ...nft, is_mint: 2 }} onViewOriginal={onViewOriginal} />)

        expect(screen.getByRole('img', { name: 'NFT #3995' }))
            .toHaveAttribute('src', expect.stringContaining('/3995.png'))
        fireEvent.click(screen.getByRole('button', { name: 'View original NFT #3995' }))
        expect(onViewOriginal).toHaveBeenCalledOnce()
    })

    it('does not fall back to the original when preview configuration is missing', () => {
        vi.stubEnv('VITE_IPFS_PREVIEW_CID', '')
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        render(<NFTImageReveal nft={{ ...nft, is_mint: 0 }} />)

        expect(screen.getByText('Preview unavailable')).toBeInTheDocument()
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
        expect(log).toHaveBeenCalledWith(expect.objectContaining({
            event: 'nft_image_source_error',
            nftId: 3995,
            missingFields: ['VITE_IPFS_PREVIEW_CID'],
        }))
    })
})
```

- [ ] **Step 2: Run the component test and verify RED**

Run: `npm test -- src/components/NFTImageReveal.test.tsx`

Expected: FAIL because the current component loads the PNG and has no viewer action.

- [ ] **Step 3: Replace the canvas component with a lightweight renderer**

Replace `frontend/src/components/NFTImageReveal.tsx` with a focused component that:

```tsx
import { useEffect, useState } from 'react'
import { getIPFSImageUrl, getIPFSPreviewUrl } from '../config/ipfs'
import { canViewNftOriginal, resolveNftImageSource, type NFTImageState } from '../nft/imagePolicy'

interface NFTImageRevealProps {
    nft: NFTImageState & {
        all_chips_owned: boolean
        owned_chips_count: number
        total_chips_count: number
    }
    onViewOriginal?: () => void
}

export function NFTImageReveal({ nft, onViewOriginal }: NFTImageRevealProps) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null)
    const source = resolveNftImageSource(nft)
    let imageUrl: string | null = null
    let missingFields: string[] = []

    if (!source.ok) {
        missingFields = source.missingFields
    } else {
        try {
            imageUrl = source.kind === 'preview'
                ? getIPFSPreviewUrl(source.fileName)
                : getIPFSImageUrl(source.fileName)
        } catch {
            missingFields = ['VITE_IPFS_PREVIEW_CID']
        }
    }

    useEffect(() => {
        if (missingFields.length === 0) return
        console.error({
            event: 'nft_image_source_error',
            nftId: nft.nft_id,
            status: nft.is_mint ?? 0,
            missingFields,
        })
    }, [missingFields.join(','), nft.is_mint, nft.nft_id])

    useEffect(() => setFailedUrl(null), [imageUrl])

    if (!source.ok || !imageUrl || failedUrl === imageUrl) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-gray-800 text-sm text-gray-400">
                {source.ok && failedUrl === imageUrl ? 'Image unavailable' : 'Preview unavailable'}
            </div>
        )
    }

    const image = (
        <img
            src={imageUrl}
            alt={source.kind === 'preview' ? `NFT #${nft.nft_id} silhouette` : `NFT #${nft.nft_id}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
            onError={() => setFailedUrl(imageUrl)}
        />
    )

    return source.kind === 'original' && onViewOriginal && canViewNftOriginal(nft) ? (
        <button
            type="button"
            aria-label={`View original NFT #${nft.nft_id}`}
            className="block h-full w-full cursor-zoom-in"
            onClick={onViewOriginal}
        >
            {image}
        </button>
    ) : (
        <div className="h-full w-full">{image}</div>
    )
}
```

Do not retain `new Image()`, canvas elements, animation frames, `useAccount`, or the
`/api/nft-user-chips-batch` request.

- [ ] **Step 4: Remove obsolete chip-coordinate policy and assertions**

Delete `needsChipCoordinates` and `NFTDisplayState` from
`frontend/src/nft/displayPolicy.ts`. Remove their tests from
`frontend/src/nft/displayPolicy.test.ts`. Replace the two coordinate-specific tests in
`frontend/src/services/webSocketConsumers.test.ts` with:

```ts
it('does not fetch chip coordinates to render NFT silhouettes', () => {
    const source = readComponent('../components/NFTImageReveal.tsx')
    expect(source).not.toContain('/api/nft-user-chips-batch')
    expect(source).not.toContain('new Image()')
    expect(source).not.toContain('<canvas')
})
```

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
npm test -- src/components/NFTImageReveal.test.tsx src/nft/displayPolicy.test.ts src/services/webSocketConsumers.test.ts src/services/runtimePolicy.test.ts
```

Expected: all selected tests pass.

Commit:

```bash
git add frontend/src/components/NFTImageReveal.tsx frontend/src/components/NFTImageReveal.test.tsx frontend/src/nft/displayPolicy.ts frontend/src/nft/displayPolicy.test.ts frontend/src/services/webSocketConsumers.test.ts
git commit -m "perf: load silhouettes before NFT minting"
```

### Task 3: Open minted originals from Profile

**Files:**
- Modify: `frontend/src/components/Profile.tsx`
- Modify: `frontend/src/components/NFTImageViewer.tsx`
- Create: `frontend/src/components/ProfileImageViewer.test.tsx`
- Create: `frontend/src/components/NFTImageViewer.test.tsx`

- [ ] **Step 1: Write the failing Profile interaction test**

Create `frontend/src/components/ProfileImageViewer.test.tsx`. Mock only the wallet and
WebSocket boundary, then render the real Profile, card image, and viewer components:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, it, expect, vi } from 'vitest'
import { Profile } from './Profile'

vi.mock('wagmi', () => ({ useAccount: () => ({ address: '0x1234' }) }))
vi.mock('../providers/WebSocketProvider', () => ({
    useWebSocketEvent: () => undefined,
    useWebSocketReconnect: () => undefined,
}))

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

it('opens the original viewer only from a minted Profile image', async () => {
    const user = userEvent.setup()
    vi.stubEnv('VITE_IPFS_PREVIEW_CID', 'bafy-preview')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
        total: 2,
        page: 1,
        page_size: 20,
        total_pages: 1,
        nfts: [
            { nft_id: 3995, file_name: '3995.png', all_chips_owned: false, owned_chips_count: 23, total_chips_count: 10_000, is_mint: 0 },
            { nft_id: 7081, file_name: '7081.png', all_chips_owned: true, owned_chips_count: 10_000, total_chips_count: 10_000, is_mint: 2, token_id: '40' },
        ],
    }), { status: 200 }))

    render(<Profile />)

    expect(await screen.findByRole('img', { name: 'NFT #3995 silhouette' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View original NFT #3995' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'View original NFT #7081' }))
    expect(screen.getByRole('dialog', { name: 'NFT #7081' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the Profile test and verify RED**

Run: `npm test -- src/components/ProfileImageViewer.test.tsx`

Expected: FAIL because Profile does not pass a viewer callback or render the viewer.

- [ ] **Step 3: Wire Profile selection state**

In `frontend/src/components/Profile.tsx`:

```tsx
import { NFTImageViewer } from './NFTImageViewer'

const [selectedNft, setSelectedNft] = useState<NFT | null>(null)

<NFTImageReveal
    nft={nft}
    onViewOriginal={nft.is_mint === 2 ? () => setSelectedNft(nft) : undefined}
/>

{selectedNft && (
    <NFTImageViewer
        nft={selectedNft}
        isOpen
        onClose={() => setSelectedNft(null)}
    />
)}
```

Place the viewer once after the grid rather than once per card.

- [ ] **Step 4: Write failing viewer accessibility and dismissal tests**

Create `frontend/src/components/NFTImageViewer.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NFTImageViewer } from './NFTImageViewer'

const minted = { nft_id: 7081, file_name: '7081.png', is_mint: 2 }

describe('NFTImageViewer', () => {
    it('exposes accessible dialog and close controls', () => {
        render(<NFTImageViewer nft={minted} isOpen onClose={vi.fn()} />)
        expect(screen.getByRole('dialog', { name: 'NFT #7081' }))
            .toHaveAttribute('aria-modal', 'true')
        expect(screen.getByRole('button', { name: 'Close original NFT #7081' }))
            .toBeInTheDocument()
    })

    it('closes on Escape', () => {
        const onClose = vi.fn()
        render(<NFTImageViewer nft={minted} isOpen onClose={onClose} />)
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('closes on a backdrop click', () => {
        const onClose = vi.fn()
        render(<NFTImageViewer nft={minted} isOpen onClose={onClose} />)
        fireEvent.click(screen.getByTestId('nft-image-viewer-backdrop'))
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('does not render for a pre-mint NFT', () => {
        render(<NFTImageViewer nft={{ ...minted, is_mint: 1 }} isOpen onClose={vi.fn()} />)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})
```

- [ ] **Step 5: Run the viewer test and verify RED**

Run: `npm test -- src/components/NFTImageViewer.test.tsx`

Expected: FAIL because the current backdrop has no dialog attributes/test ID and the
close button has no accessible name.

- [ ] **Step 6: Add the minted guard and dialog semantics**

Update `NFTImageViewer` so its image-loading effect starts with:

```ts
if (!isOpen || nft.is_mint !== 2 || !nft.file_name) return
```

Render nothing for a non-minted NFT. Add these attributes to the backdrop:

```tsx
role="dialog"
aria-modal="true"
aria-labelledby={`nft-image-viewer-title-${nft.nft_id}`}
data-testid="nft-image-viewer-backdrop"
```

Give the title `id={`nft-image-viewer-title-${nft.nft_id}`}` and the close button
`aria-label={`Close original NFT #${nft.nft_id}`}`.

- [ ] **Step 7: Verify GREEN and commit**

Run:

```bash
npm test -- src/components/ProfileImageViewer.test.tsx src/components/NFTImageViewer.test.tsx
```

Expected: both files pass.

Commit:

```bash
git add frontend/src/components/Profile.tsx frontend/src/components/NFTImageViewer.tsx frontend/src/components/ProfileImageViewer.test.tsx frontend/src/components/NFTImageViewer.test.tsx
git commit -m "feat: open minted NFT originals from Profile"
```

### Task 4: Build the deterministic silhouette generator

**Files:**
- Create: `scripts/nft-previews/preview-lib.mjs`
- Create: `scripts/nft-previews/preview-lib.test.mjs`
- Create: `scripts/nft-previews/generate.mjs`
- Create: `scripts/nft-previews/validate.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install the image-processing development dependency**

Run: `npm install --save-dev sharp`

Expected: `sharp` appears in root `devDependencies` and the root lockfile is updated.

- [ ] **Step 2: Write failing fixture-based generator tests**

Create `scripts/nft-previews/preview-lib.test.mjs`:

```js
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import { generatePreviewCollection, validatePreviewCollection } from './preview-lib.mjs'

let taskDir
let inputDir
let outputDir

before(async () => {
    taskDir = await mkdtemp(join(tmpdir(), 'haku-preview-test-'))
    inputDir = join(taskDir, 'input')
    outputDir = join(taskDir, 'output')
    await mkdir(inputDir)
    for (const [name, colour] of [['1.png', '#ff0088'], ['2.png', '#0088ff']]) {
        await sharp({
            create: { width: 3000, height: 3000, channels: 3, background: colour },
        }).png().toFile(join(inputDir, name))
    }
})

after(async () => {
    await rm(taskDir, { recursive: true, force: true })
})

test('generates deterministic 512px WebP previews and a manifest', async () => {
    const result = await generatePreviewCollection({
        inputDir,
        outputDir,
        expectedCount: 2,
        concurrency: 2,
    })
    assert.equal(result.sourceCount, 2)
    assert.equal(result.outputCount, 2)

    const metadata = await sharp(join(outputDir, '1.webp')).metadata()
    assert.equal(metadata.format, 'webp')
    assert.equal(metadata.width, 512)
    assert.equal(metadata.height, 512)

    const manifest = JSON.parse(await readFile(join(outputDir, 'manifest.json'), 'utf8'))
    assert.equal(manifest.settings.width, 512)
    assert.equal(manifest.settings.height, 512)
    assert.equal(manifest.settings.quality, 50)
    assert.equal(manifest.sourceCount, 2)
    assert.equal(manifest.outputCount, 2)
})

test('rejects the wrong required source count before writing', async () => {
    await assert.rejects(
        generatePreviewCollection({
            inputDir,
            outputDir: join(taskDir, 'wrong-count'),
            expectedCount: 3,
        }),
        /Expected 3 PNG originals, found 2/,
    )
})

test('reports the exact missing preview during validation', async () => {
    await rm(join(outputDir, '2.webp'))
    await assert.rejects(
        validatePreviewCollection({ inputDir, outputDir, expectedCount: 2 }),
        /Missing preview files: 2\.webp/,
    )
})
```

- [ ] **Step 3: Run the generator test and verify RED**

Run: `node --test scripts/nft-previews/preview-lib.test.mjs`

Expected: FAIL because `preview-lib.mjs` does not exist.

- [ ] **Step 4: Implement generation and validation**

Create `scripts/nft-previews/preview-lib.mjs`:

```js
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { extname, join, parse } from 'node:path'
import sharp from 'sharp'

export const PREVIEW_SETTINGS = Object.freeze({
    version: 1,
    width: 512,
    height: 512,
    blurSigma: 12,
    brightness: 0.35,
    quality: 50,
})

function requireDirectory(value, field) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Missing required ${field}`)
    }
    return value
}

function requirePositiveInteger(value, field) {
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`${field} must be a positive integer, received ${value}`)
    }
    return parsed
}

async function listFilesWithExtension(directory, extension) {
    return (await readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === extension)
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
}

function outputName(sourceName) {
    return `${parse(sourceName).name}.webp`
}

function requireExactCount(files, expectedCount, label) {
    if (files.length !== expectedCount) {
        throw new Error(`Expected ${expectedCount} ${label}, found ${files.length}`)
    }
}

async function runBounded(items, concurrency, operation) {
    let nextIndex = 0
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (nextIndex < items.length) {
            const index = nextIndex++
            await operation(items[index], index)
        }
    })
    await Promise.all(workers)
}

export async function generatePreviewCollection({
    inputDir,
    outputDir,
    expectedCount,
    concurrency = 4,
}) {
    const sourceDirectory = requireDirectory(inputDir, 'inputDir')
    const previewDirectory = requireDirectory(outputDir, 'outputDir')
    const requiredCount = requirePositiveInteger(expectedCount, 'expectedCount')
    const workerCount = requirePositiveInteger(concurrency, 'concurrency')
    const sources = await listFilesWithExtension(sourceDirectory, '.png')
    requireExactCount(sources, requiredCount, 'PNG originals')

    await mkdir(previewDirectory, { recursive: true })
    const existing = await readdir(previewDirectory)
    if (existing.length > 0) {
        throw new Error(`Output directory must be empty: ${previewDirectory}`)
    }

    const files = new Array(sources.length)
    await runBounded(sources, workerCount, async (sourceName, index) => {
        const previewName = outputName(sourceName)
        const sourcePath = join(sourceDirectory, sourceName)
        const previewPath = join(previewDirectory, previewName)
        await sharp(sourcePath)
            .resize(PREVIEW_SETTINGS.width, PREVIEW_SETTINGS.height, { fit: 'fill' })
            .grayscale()
            .blur(PREVIEW_SETTINGS.blurSigma)
            .modulate({ brightness: PREVIEW_SETTINGS.brightness })
            .webp({ quality: PREVIEW_SETTINGS.quality })
            .toFile(previewPath)
        const [sourceInfo, previewInfo] = await Promise.all([stat(sourcePath), stat(previewPath)])
        files[index] = {
            source: sourceName,
            preview: previewName,
            sourceBytes: sourceInfo.size,
            previewBytes: previewInfo.size,
        }
    })

    const manifest = {
        settings: PREVIEW_SETTINGS,
        sourceCount: sources.length,
        outputCount: files.length,
        totalOutputBytes: files.reduce((sum, file) => sum + file.previewBytes, 0),
        files,
    }
    await writeFile(join(previewDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    return validatePreviewCollection({
        inputDir: sourceDirectory,
        outputDir: previewDirectory,
        expectedCount: requiredCount,
        concurrency: workerCount,
    })
}

export async function validatePreviewCollection({
    inputDir,
    outputDir,
    expectedCount,
    concurrency = 4,
}) {
    const sourceDirectory = requireDirectory(inputDir, 'inputDir')
    const previewDirectory = requireDirectory(outputDir, 'outputDir')
    const requiredCount = requirePositiveInteger(expectedCount, 'expectedCount')
    const workerCount = requirePositiveInteger(concurrency, 'concurrency')
    const [sources, previews] = await Promise.all([
        listFilesWithExtension(sourceDirectory, '.png'),
        listFilesWithExtension(previewDirectory, '.webp'),
    ])
    requireExactCount(sources, requiredCount, 'PNG originals')

    const requiredPreviews = sources.map(outputName)
    const previewSet = new Set(previews)
    const missing = requiredPreviews.filter((name) => !previewSet.has(name))
    const requiredSet = new Set(requiredPreviews)
    const extras = previews.filter((name) => !requiredSet.has(name))
    if (missing.length > 0) throw new Error(`Missing preview files: ${missing.join(', ')}`)
    if (extras.length > 0) throw new Error(`Unexpected preview files: ${extras.join(', ')}`)
    requireExactCount(previews, requiredCount, 'WebP previews')

    const manifestPath = join(previewDirectory, 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    if (manifest.sourceCount !== requiredCount || manifest.outputCount !== requiredCount) {
        throw new Error(`Manifest count mismatch in ${manifestPath}`)
    }
    const manifestFiles = new Map(manifest.files.map((file) => [file.preview, file]))
    let totalOutputBytes = 0
    await runBounded(previews, workerCount, async (previewName) => {
        const previewPath = join(previewDirectory, previewName)
        const [metadata, previewInfo] = await Promise.all([
            sharp(previewPath).metadata(),
            stat(previewPath),
        ])
        if (metadata.format !== 'webp' || metadata.width !== 512 || metadata.height !== 512) {
            throw new Error(`Invalid preview format or dimensions: ${previewName}`)
        }
        const entry = manifestFiles.get(previewName)
        if (!entry || entry.previewBytes !== previewInfo.size) {
            throw new Error(`Manifest entry mismatch: ${previewName}`)
        }
        totalOutputBytes += previewInfo.size
    })

    if (manifestFiles.size !== previews.length) {
        throw new Error(`Manifest file set mismatch in ${manifestPath}`)
    }
    return { sourceCount: sources.length, outputCount: previews.length, totalOutputBytes }
}

export function parsePreviewCliArgs(argv, { allowConcurrency }) {
    const allowed = new Set(['--input', '--output', '--expected-count'])
    if (allowConcurrency) allowed.add('--concurrency')
    const values = {}
    for (let index = 0; index < argv.length; index += 2) {
        const flag = argv[index]
        const value = argv[index + 1]
        if (!allowed.has(flag) || value === undefined) {
            throw new Error(`Invalid preview CLI argument: ${flag ?? '(missing)'}`)
        }
        values[flag] = value
    }
    return {
        inputDir: requireDirectory(values['--input'], '--input'),
        outputDir: requireDirectory(values['--output'], '--output'),
        expectedCount: requirePositiveInteger(values['--expected-count'], '--expected-count'),
        ...(allowConcurrency
            ? { concurrency: values['--concurrency'] === undefined
                ? 4
                : requirePositiveInteger(values['--concurrency'], '--concurrency') }
            : {}),
    }
}
```

Create `scripts/nft-previews/generate.mjs`:

```js
import { generatePreviewCollection, parsePreviewCliArgs } from './preview-lib.mjs'

try {
    const options = parsePreviewCliArgs(process.argv.slice(2), { allowConcurrency: true })
    console.log(JSON.stringify(await generatePreviewCollection(options), null, 2))
} catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
}
```

Create `scripts/nft-previews/validate.mjs`:

```js
import { parsePreviewCliArgs, validatePreviewCollection } from './preview-lib.mjs'

try {
    const options = parsePreviewCliArgs(process.argv.slice(2), { allowConcurrency: false })
    console.log(JSON.stringify(await validatePreviewCollection(options), null, 2))
} catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
}
```

- [ ] **Step 5: Add root scripts and verify GREEN**

Add to root `package.json`:

```json
"preview:test": "node --test scripts/nft-previews/preview-lib.test.mjs",
"preview:generate": "node scripts/nft-previews/generate.mjs",
"preview:validate": "node scripts/nft-previews/validate.mjs"
```

Run: `npm run preview:test`

Expected: all generator tests pass.

- [ ] **Step 6: Commit the generator**

```bash
git add package.json package-lock.json scripts/nft-previews
git commit -m "feat: generate validated NFT silhouettes"
```

### Task 5: Document and exercise the release pipeline

**Files:**
- Modify: `frontend/.env.example`
- Modify: `README.md`
- Generated outside Git: `/private/tmp/haku-nft-silhouettes`

- [ ] **Step 1: Document required configuration**

Add an empty required key to `frontend/.env.example`:

```dotenv
VITE_IPFS_PREVIEW_CID=
```

Document in `README.md` that deployment must not proceed while it is empty. Include the
exact generation and validation commands:

```bash
npm run preview:generate -- --input "/Users/martin/Documents/我的文档/NFT/haku-final-10000/build/images" --output /private/tmp/haku-nft-silhouettes --expected-count 10000 --concurrency 4
npm run preview:validate -- --input "/Users/martin/Documents/我的文档/NFT/haku-final-10000/build/images" --output /private/tmp/haku-nft-silhouettes --expected-count 10000
```

State that the validated output directory must be pinned as a separate IPFS directory,
the returned root CID must be assigned to `VITE_IPFS_PREVIEW_CID`, and representative
`1.webp`, `3995.webp`, and `10000.webp` URLs must return `200 image/webp` before frontend
deployment.

- [ ] **Step 2: Generate and validate all production silhouettes**

Run both documented commands. Expected: generation and validation report exactly 10,000
sources and 10,000 previews. Record total output bytes in the delivery notes; do not add
the generated directory to Git.

- [ ] **Step 3: Run frontend verification with a nonempty test CID**

Run:

```bash
VITE_IPFS_PREVIEW_CID=bafy-test-preview npm test
VITE_IPFS_PREVIEW_CID=bafy-test-preview npm run build
```

Expected: all tests pass and the production build exits 0.

- [ ] **Step 4: Commit release documentation**

```bash
git add frontend/.env.example README.md
git commit -m "docs: add NFT silhouette release runbook"
```

### Task 6: Integrate latest main and deliver the branch

**Files:**
- Verify all changed files from Tasks 1–5.

- [ ] **Step 1: Review the complete diff against the design**

Run:

```bash
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
```

Expected: no whitespace errors; the diff contains policy, component, viewer, generator,
tests, configuration example, and runbook changes only.

- [ ] **Step 2: Run fresh pre-integration verification**

Run:

```bash
npm run preview:test
cd frontend
VITE_IPFS_PREVIEW_CID=bafy-test-preview npm test
VITE_IPFS_PREVIEW_CID=bafy-test-preview npm run build
```

Expected: all three commands exit 0 with no test failures or build errors.

- [ ] **Step 3: Synchronize with main**

Run:

```bash
git fetch origin
git merge origin/main
```

Resolve conflicts without discarding unrelated upstream work.

- [ ] **Step 4: Repeat fresh post-merge verification**

Repeat the three commands from Step 2 and require all to exit 0.

- [ ] **Step 5: Push and create the pull request**

Run:

```bash
git push -u origin feature/nft-preview-silhouettes
gh pr create --base main --head feature/nft-preview-silhouettes --title "Reduce pre-mint NFT image traffic" --body-file /private/tmp/nft-preview-pr-body.md
```

The PR body must summarize the lifecycle image policy, minted-only viewer, deterministic
preview generator, full 10,000-file validation result, frontend test count, production
build result, and the operational requirement to pin the generated directory and set the
real preview CID before deployment.
