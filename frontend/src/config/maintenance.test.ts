import { describe, expect, it } from 'vitest'

import { isMaintenanceMode } from './maintenance'

describe('maintenance mode', () => {
    it('enables the static page only for the exact true value', () => {
        expect(isMaintenanceMode('true')).toBe(true)
        expect(isMaintenanceMode(undefined)).toBe(false)
        expect(isMaintenanceMode('false')).toBe(false)
        expect(isMaintenanceMode('TRUE')).toBe(false)
    })
})
