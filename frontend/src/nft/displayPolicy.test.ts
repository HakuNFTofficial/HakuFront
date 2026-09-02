import { describe, expect, it } from 'vitest'

import {
    NFT_PREVIEW_LIMIT,
    needsChipCoordinates,
} from './displayPolicy'

describe('NFT display policy', () => {
    it('keeps the homepage preview small', () => {
        expect(NFT_PREVIEW_LIMIT).toBe(6)
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
