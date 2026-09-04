import { describe, expect, it } from 'vitest'

import {
    reconcileApprovedNftIds,
    requireMintContractParameters,
} from './profileLifecycle'

const CONTRACT = '0x1111111111111111111111111111111111111111' as const

describe('requireMintContractParameters', () => {
    it('returns only authoritative backend parameters', () => {
        expect(requireMintContractParameters({
            contract_address: CONTRACT,
            token_id: '202',
            uint256_param: 27,
        }, CONTRACT)).toEqual({
            contractAddress: CONTRACT,
            remark: '202',
            uint256Param: 27n,
        })
    })

    it.each([
        [{ contract_address: CONTRACT, token_id: '202' }, 'uint256_param'],
        [{ contract_address: CONTRACT, uint256_param: 27 }, 'token_id'],
        [{ token_id: '202', uint256_param: 27 }, 'contract_address'],
    ])('rejects missing required mint data', (response, missingField) => {
        expect(() => requireMintContractParameters(response, CONTRACT)).toThrow(missingField)
    })

    it('rejects a backend contract that differs from the configured contract', () => {
        expect(() => requireMintContractParameters({
            contract_address: '0x2222222222222222222222222222222222222222',
            token_id: '202',
            uint256_param: 27,
        }, CONTRACT)).toThrow('contract_address')
    })
})

describe('reconcileApprovedNftIds', () => {
    it('preserves approvals from other pages and removes visible authoritative transitions', () => {
        const result = reconcileApprovedNftIds(new Set([101, 202]), [
            { nft_id: 202, is_mint: 1 },
            { nft_id: 303, is_mint: 0 },
        ])

        expect([...result]).toEqual([101])
    })
})
