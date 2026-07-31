import { afterEach, describe, expect, it, vi } from 'vitest'

import {
    BALANCE_REFETCH_MS,
    POOL_REFETCH_MS,
    STATIC_REFETCH_MS,
    visibleRefetchInterval,
} from './queryPolicy'

describe('queryPolicy', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('uses bounded production polling intervals', () => {
        expect(BALANCE_REFETCH_MS).toBe(15_000)
        expect(POOL_REFETCH_MS).toBe(15_000)
        expect(STATIC_REFETCH_MS).toBe(30_000)
    })

    it('keeps the interval scheduled so React Query can resume after the page is visible', () => {
        vi.stubGlobal('document', { visibilityState: 'hidden' })
        expect(visibleRefetchInterval(15_000)()).toBe(15_000)
    })

    it('returns the configured interval while visible', () => {
        vi.stubGlobal('document', { visibilityState: 'visible' })
        expect(visibleRefetchInterval(15_000)()).toBe(15_000)
    })
})
