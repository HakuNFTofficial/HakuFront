import { describe, expect, test, vi } from 'vitest'

import {
    BurnSynchronizationTimeoutError,
    getBurnConfirmationMessage,
    waitForBurnSynchronization,
} from './burnFlow'

const minted = {
    nft_id: 1551,
    token_id: '38',
    is_mint: 2,
}

describe('getBurnConfirmationMessage', () => {
    test('identifies both IDs and explains the irreversible refund flow', () => {
        const message = getBurnConfirmationMessage(minted)

        expect(message).toContain('Token #38')
        expect(message).toContain('ID 1551')
        expect(message).toMatch(/permanent/i)
        expect(message).toMatch(/recorded HAKU refund/i)
    })
})

describe('waitForBurnSynchronization', () => {
    test('keeps polling stale snapshots until the NFT is reset', async () => {
        const fetchSnapshot = vi
            .fn()
            .mockResolvedValueOnce({ nfts: [minted] })
            .mockResolvedValueOnce({ nfts: [minted] })
            .mockResolvedValueOnce({
                nfts: [{ ...minted, token_id: null, is_mint: 0 }],
            })
        const delay = vi.fn().mockResolvedValue(undefined)

        const snapshot = await waitForBurnSynchronization({
            nftId: 1551,
            fetchSnapshot,
            delay,
            maxAttempts: 3,
            pollIntervalMs: 1,
        })

        expect(snapshot.nfts[0]).toEqual(
            expect.objectContaining({ nft_id: 1551, token_id: null, is_mint: 0 }),
        )
        expect(fetchSnapshot).toHaveBeenCalledTimes(3)
        expect(delay).toHaveBeenCalledTimes(2)
    })

    test('treats a missing row as synchronized', async () => {
        const fetchSnapshot = vi.fn().mockResolvedValue({ nfts: [] })

        await expect(
            waitForBurnSynchronization({
                nftId: 1551,
                fetchSnapshot,
                delay: vi.fn(),
            }),
        ).resolves.toEqual({ nfts: [] })
        expect(fetchSnapshot).toHaveBeenCalledTimes(1)
    })

    test('retries a transient API failure before accepting synchronized state', async () => {
        const fetchSnapshot = vi
            .fn()
            .mockRejectedValueOnce(new Error('temporary gateway error'))
            .mockResolvedValueOnce({
                nfts: [{ ...minted, token_id: null, is_mint: 0 }],
            })
        const delay = vi.fn().mockResolvedValue(undefined)

        await expect(
            waitForBurnSynchronization({
                nftId: 1551,
                fetchSnapshot,
                delay,
                maxAttempts: 2,
                pollIntervalMs: 1,
            }),
        ).resolves.toEqual({
            nfts: [{ ...minted, token_id: null, is_mint: 0 }],
        })
        expect(delay).toHaveBeenCalledTimes(1)
    })

    test('reports a timeout without suggesting another burn', async () => {
        const fetchSnapshot = vi.fn().mockResolvedValue({ nfts: [minted] })

        await expect(
            waitForBurnSynchronization({
                nftId: 1551,
                fetchSnapshot,
                delay: vi.fn().mockResolvedValue(undefined),
                maxAttempts: 2,
                pollIntervalMs: 1,
            }),
        ).rejects.toBeInstanceOf(BurnSynchronizationTimeoutError)
        expect(fetchSnapshot).toHaveBeenCalledTimes(2)
    })
})
