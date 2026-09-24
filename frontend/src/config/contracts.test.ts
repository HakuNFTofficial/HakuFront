import { describe, expect, test } from 'vitest'

import { CONTRACTS, HUKU_NFT_DEPLOYED } from './contracts'

describe('mainnet NFT contract availability', () => {
    test('enables mint transactions through the verified mainnet NFT proxy', () => {
        expect(CONTRACTS.HUKU_NFT).toBe('0x83a5045AD7e1814046697b1536CC0af1A4d37A32')
        expect(HUKU_NFT_DEPLOYED).toBe(true)
    })
})
