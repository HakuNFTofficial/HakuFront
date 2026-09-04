import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const componentPaths = [
    '../components/Banner.tsx',
    '../components/KLineChart.tsx',
    '../components/NFTSection.tsx',
    '../components/NFTLifecycleGrid.tsx',
]

const readComponent = (componentPath: string) =>
    readFileSync(new URL(componentPath, import.meta.url), 'utf8')

describe('realtime components', () => {
    it.each(componentPaths)('%s uses the shared WebSocket provider', (componentPath) => {
        const source = readComponent(componentPath)

        expect(source).toContain('useWebSocketEvent')
        expect(source).toContain('useWebSocketReconnect')
        expect(source).not.toContain("from '../hooks/useWebSocket'")
        expect(source).not.toContain('/ws`')
    })

    it('renders coordinates without restoring the legacy per-NFT chip request', () => {
        const source = readComponent('../components/NFTImageReveal.tsx')

        expect(source).not.toContain('/api/nft-user-chips-batch')
        expect(source).not.toContain('new Image()')
        expect(source).toContain('NFTChipOverlay')
    })

    it('requests only one server-paginated incomplete NFT page on Swap', () => {
        const source = readComponent('../components/NFTSection.tsx')

        expect(source).toContain('filter=in_progress')
        expect(source).toContain('page_size=6')
        expect(source).toContain('include_chips=true')
        expect(source).toContain('nfts.map((nft)')
        expect(source).toContain('aria-label="NFT card pagination"')
        expect(source).not.toContain('verify-mint-eligibility')
        expect(source).not.toContain('writeBurnContract')
    })

    it('keeps coordinates and animation on Swap but not Profile', () => {
        const profileSource = readComponent('../components/Profile.tsx')
        const lifecycleSource = readComponent('../components/NFTLifecycleGrid.tsx')
        const homeSource = readComponent('../components/NFTSection.tsx')

        expect(profileSource).toContain('NFTLifecycleGrid')
        expect(profileSource).not.toContain('NFTImageReveal')
        expect(lifecycleSource).toContain('include_chips=false')
        expect(lifecycleSource).toContain('NFTProfileThumbnail')
        expect(lifecycleSource).not.toContain('NFTImageReveal')
        expect(homeSource).toContain('include_chips=true')
        expect(homeSource).not.toContain('include_chips=false')
        expect(homeSource).toContain('NFTImageReveal')
        expect(homeSource).toContain('void fetchNFTSnapshot(false)')
    })

    it('owns mint and burn lifecycle controls only on Profile', () => {
        const lifecycleSource = readComponent('../components/NFTLifecycleGrid.tsx')
        const homeSource = readComponent('../components/NFTSection.tsx')

        expect(lifecycleSource).toContain('verify-mint-eligibility')
        expect(lifecycleSource).toContain("functionName: 'userBurn'")
        expect(lifecycleSource).toContain("filter === 'minting'")
        expect(homeSource).not.toContain('verify-mint-eligibility')
        expect(homeSource).not.toContain("functionName: 'userBurn'")
    })
})
