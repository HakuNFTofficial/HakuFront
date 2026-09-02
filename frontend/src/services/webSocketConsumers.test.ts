import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const componentPaths = [
    '../components/Banner.tsx',
    '../components/KLineChart.tsx',
    '../components/NFTSection.tsx',
    '../components/Profile.tsx',
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

    it('re-fetches homepage chip coordinates when the owned chip count changes', () => {
        const source = readComponent('../components/NFTImageReveal.tsx')

        expect(source).toContain(
            'const requestKey = `${nft.nft_id}-${address}-${nft.owned_chips_count}`',
        )
        expect(source).toContain(
            '[nft.nft_id, address, nft.owned_chips_count, nft.total_chips_count, nft.all_chips_owned, nft.is_mint]',
        )
    })

    it('paginates the homepage instead of rendering every owned NFT', () => {
        const source = readComponent('../components/NFTSection.tsx')

        expect(source).toContain('const nftPage = getNftPage(nfts, currentPage)')
        expect(source).toContain('nftPage.items.map((nft)')
        expect(source).toContain('aria-label="NFT card pagination"')
        expect(source).not.toContain('nfts.map((nft)')
    })

    it('does not request chip coordinates for a complete NFT', () => {
        const source = readComponent('../components/NFTImageReveal.tsx')

        expect(source).toContain('if (!needsChipCoordinates(nft))')
        expect(source).toContain(
            '[nft.nft_id, address, nft.owned_chips_count, nft.total_chips_count, nft.all_chips_owned, nft.is_mint]',
        )
    })

    it('loads lightweight summaries for the realtime View All cards', () => {
        const source = readComponent('../components/Profile.tsx')

        expect(source).toContain('include_chips=false')
        expect(source).not.toContain('include_chips=true')
    })
})
