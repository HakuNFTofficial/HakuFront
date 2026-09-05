import { describe, expect, it } from 'vitest'

import {
    KLINE_PRICE_MIN_MOVE,
    KLINE_PRICE_PRECISION,
    formatKlinePrice,
    getInitialVisibleLogicalRange,
} from './klinePresentation'

describe('K-line presentation', () => {
    it('keeps enough precision for sub-cent token prices', () => {
        expect(KLINE_PRICE_PRECISION).toBe(7)
        expect(KLINE_PRICE_MIN_MOVE).toBe(0.0000001)
        expect(formatKlinePrice('0.000522466267303946')).toBe('0.0005225')
    })

    it('shows the latest forty candles by default without deleting history', () => {
        expect(getInitialVisibleLogicalRange(100)).toEqual({ from: 60, to: 99 })
        expect(getInitialVisibleLogicalRange(12)).toEqual({ from: 0, to: 11 })
        expect(getInitialVisibleLogicalRange(0)).toBeNull()
    })
})
