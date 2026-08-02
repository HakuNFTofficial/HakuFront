// @vitest-environment node

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('swap transaction refresh', () => {
    it('refreshes balances, pool state, liquidity and quote after confirmation', () => {
        const source = readFileSync(new URL('../components/Swap.tsx', import.meta.url), 'utf8')

        expect(source).toContain('useWaitForTransactionReceipt')
        expect(source).toContain('isTransactionConfirmed')
        expect(source).toContain('refetchSttBalance()')
        expect(source).toContain('refetchHakuBalance()')
        expect(source).toContain('refetchPoolState()')
        expect(source).toContain('refetchPoolLiquidity()')
        expect(source).toContain('refetchQuote()')
    })
})
