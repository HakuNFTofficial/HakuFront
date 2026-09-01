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
        expect(source).toContain('[nft.nft_id, address, nft.owned_chips_count]')
    })

    it('loads chip coordinates for the realtime View All cards', () => {
        const source = readComponent('../components/Profile.tsx')

        expect(source).toContain('include_chips=true')
    })
})
