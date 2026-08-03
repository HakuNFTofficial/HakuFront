// @vitest-environment node

import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

describe('NFT burn component integration', () => {
    test('confirms before submitting and waits for backend synchronization', () => {
        const source = readFileSync(
            new URL('./NFTSection.tsx', import.meta.url),
            'utf8',
        )

        expect(source).toContain('getBurnConfirmationMessage(nft)')
        expect(source).toContain('window.confirm(')
        expect(source).toContain('waitForBurnSynchronization({')
        expect(source).toContain('BurnSynchronizationTimeoutError')
        expect(source).toContain(
            'burningNftId !== null || isBurnPending || isBurnConfirming',
        )

        const confirmation = source.indexOf('getBurnConfirmationMessage(nft)')
        const submit = source.indexOf('writeBurnContract({', confirmation)
        expect(confirmation).toBeGreaterThan(-1)
        expect(submit).toBeGreaterThan(confirmation)
    })
})
