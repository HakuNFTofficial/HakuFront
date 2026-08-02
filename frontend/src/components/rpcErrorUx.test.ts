import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('RPC failure UX', () => {
    it('does not expose raw viem errors or treat unavailable USDC as zero', () => {
        const walletSource = readFileSync(
            new URL('./WalletBalance.tsx', import.meta.url),
            'utf8',
        )
        const swapSource = readFileSync(
            new URL('./Swap.tsx', import.meta.url),
            'utf8',
        )

        expect(walletSource).toContain('error: nativeBalanceError')
        expect(walletSource).toContain('getBalanceDisplayState')
        expect(walletSource).toContain('nativeBalanceDisplay.label')
        expect(swapSource).toContain('error: sttBalanceError')
        expect(swapSource).toContain('sttBalanceDisplay.label')
        expect(swapSource).not.toContain(
            "sttBalance ? parseFloat(formatEther(sttBalance.value)).toFixed(4) : '0.0000'",
        )
        expect(swapSource).toContain('RPC_UNAVAILABLE_MESSAGE')
        expect(swapSource).not.toContain('Error: {poolError.message}')
        expect(swapSource).not.toContain('{quoteError.message}')
        expect(swapSource).toContain('[Swap] Quote RPC read failed')
    })
})
