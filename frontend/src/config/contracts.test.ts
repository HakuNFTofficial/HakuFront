import { describe, expect, test } from 'vitest'

import { CONTRACTS, HUKU_NFT_DEPLOYED } from './contracts'

describe('mainnet NFT contract availability', () => {
    test('does not enable mint transactions before the NFT contract is deployed', () => {
        expect(CONTRACTS.HUKU_NFT).toBe('0x0000000000000000000000000000000000000000')
        expect(HUKU_NFT_DEPLOYED).toBe(false)
    })
})
