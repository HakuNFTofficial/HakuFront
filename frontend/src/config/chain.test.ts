import { describe, expect, test } from 'vitest'

import { getChainName, REQUIRED_CHAIN_ID } from './chain'

describe('production chain configuration', () => {
    test('requires Arc Mainnet for wallet transactions', () => {
        expect(REQUIRED_CHAIN_ID).toBe(5042)
        expect(getChainName(REQUIRED_CHAIN_ID)).toBe('Arc')
        expect(getChainName(5042002)).not.toBe('Arc')
    })
})
