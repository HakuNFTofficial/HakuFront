import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('runtime request policy', () => {
    it('leaves RPC retries to the bounded backend gateway', () => {
        const source = readSource('../main.tsx')

        expect(source).toContain('retry: false')
        expect(source).not.toMatch(/retry:\s*2/)
    })

    it.each([
        '../components/WalletBalance.tsx',
        '../components/Swap.tsx',
        '../components/NFTSection.tsx',
    ])('%s pauses contract polling while the page is hidden', (path) => {
        const source = readSource(path)

        expect(source).toContain('visibleRefetchInterval')
        expect(source).toContain('refetchIntervalInBackground: false')
        expect(source).not.toMatch(/refetchInterval:\s*(3000|5000|10000)/)
    })

    it('uses wallet events with a low-frequency visible-page fallback poll', () => {
        const source = readSource('../hooks/useWalletChainId.ts')

        expect(source).toContain('WALLET_CHAIN_POLL_MS')
        expect(source).toContain("document.visibilityState !== 'visible'")
        expect(source).not.toContain('setInterval(pollChainId, 2000)')
    })

    it('does not emit repeated same-version or animation-frame logs', () => {
        expect(readSource('../utils/version.ts')).not.toContain('[Version] Same version')
        expect(readSource('../components/NFTImageReveal.tsx')).not.toContain('Drawing ${starCount} stars')
        expect(readSource('../components/NFTImageReveal.tsx')).not.toContain('Generating start position for star')
    })
})
