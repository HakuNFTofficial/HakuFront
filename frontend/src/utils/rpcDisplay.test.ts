import { describe, expect, it } from 'vitest'

import {
    BALANCE_UNAVAILABLE_LABEL,
    getBalanceDisplayState,
} from './rpcDisplay'

describe('getBalanceDisplayState', () => {
    it('formats a successful non-zero balance to four decimal places', () => {
        expect(getBalanceDisplayState('700', false, null)).toEqual({
            kind: 'value',
            value: '700.0000',
        })
    })

    it('preserves a confirmed zero balance', () => {
        expect(getBalanceDisplayState('0', false, null)).toEqual({
            kind: 'value',
            value: '0.0000',
        })
    })

    it('marks a failed read as unavailable', () => {
        expect(getBalanceDisplayState('700', false, new Error('404'))).toEqual({
            kind: 'unavailable',
            value: '--',
            label: BALANCE_UNAVAILABLE_LABEL,
        })
    })

    it('marks missing balance data as unavailable', () => {
        expect(getBalanceDisplayState(undefined, false, null)).toEqual({
            kind: 'unavailable',
            value: '--',
            label: BALANCE_UNAVAILABLE_LABEL,
        })
    })

    it('keeps the loading state explicit', () => {
        expect(getBalanceDisplayState(undefined, true, null)).toEqual({
            kind: 'loading',
        })
    })
})
