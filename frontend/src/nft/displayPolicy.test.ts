import { describe, expect, it } from 'vitest'

import {
    getNftPage,
    NFT_PREVIEW_LIMIT,
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
})
