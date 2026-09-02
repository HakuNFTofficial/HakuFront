import { describe, expect, it } from 'vitest'

import {
    getNftPage,
    NFT_PREVIEW_LIMIT,
    needsChipCoordinates,
} from './displayPolicy'

describe('NFT display policy', () => {
    it('keeps the homepage preview small', () => {
        expect(NFT_PREVIEW_LIMIT).toBe(6)
    })

    it('paginates the homepage NFT cards without hiding later NFTs', () => {
        const nfts = Array.from({ length: 14 }, (_, index) => ({ id: index + 1 }))

        expect(getNftPage(nfts, 1)).toMatchObject({
            items: nfts.slice(0, 6),
            currentPage: 1,
            totalPages: 3,
        })
        expect(getNftPage(nfts, 3)).toMatchObject({
            items: nfts.slice(12, 14),
            currentPage: 3,
            totalPages: 3,
        })
        expect(getNftPage(nfts, 99).currentPage).toBe(3)
    })

    it('skips redundant coordinates for a complete NFT', () => {
        expect(
            needsChipCoordinates({
                all_chips_owned: true,
                owned_chips_count: 10_000,
                total_chips_count: 10_000,
                is_mint: 0,
            }),
        ).toBe(false)
    })

    it('loads coordinates only for a partially revealed NFT', () => {
        expect(
            needsChipCoordinates({
                all_chips_owned: false,
                owned_chips_count: 3_000,
                total_chips_count: 10_000,
                is_mint: 0,
            }),
        ).toBe(true)
    })

    it('skips coordinates when the wallet owns no chips or the NFT is minted', () => {
        expect(
            needsChipCoordinates({
                all_chips_owned: false,
                owned_chips_count: 0,
                total_chips_count: 10_000,
                is_mint: 0,
            }),
        ).toBe(false)
        expect(
            needsChipCoordinates({
                all_chips_owned: false,
                owned_chips_count: 3_000,
                total_chips_count: 10_000,
                is_mint: 2,
            }),
        ).toBe(false)
    })
})
