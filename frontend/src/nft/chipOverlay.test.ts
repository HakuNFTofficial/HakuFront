import { describe, expect, it } from 'vitest'

import {
    getValidChipCoordinates,
    scaleChipRect,
    selectSparkleChips,
    type ChipCoordinate,
} from './chipOverlay'

function chips(count: number): ChipCoordinate[] {
    return Array.from({ length: count }, (_, index) => ({
        x: (index % 100) * 30,
        y: Math.floor(index / 100) * 30,
        w: 30,
        h: 30,
    }))
}

describe('chip overlay policy', () => {
    it('scales exact 3000px chip coordinates into the 512px preview', () => {
        const rect = scaleChipRect({ x: 300, y: 600, w: 30, h: 60 })

        expect(rect.x).toBeCloseTo(51.2)
        expect(rect.y).toBeCloseTo(102.4)
        expect(rect.width).toBeCloseTo(5.12)
        expect(rect.height).toBeCloseTo(10.24)
    })

    it('rejects invalid coordinates instead of inventing positions', () => {
        expect(getValidChipCoordinates([
            { x: 0, y: 0, w: 30, h: 30 },
            { x: -1, y: 0, w: 30, h: 30 },
            { x: 2990, y: 2990, w: 30, h: 30 },
            { x: Number.NaN, y: 0, w: 30, h: 30 },
        ])).toEqual([{ x: 0, y: 0, w: 30, h: 30 }])
    })

    it.each([
        [23, 23],
        [1_000, 30],
        [1_001, 100],
    ])('selects %i real owned chips into %i deterministic sparkle positions', (owned, expected) => {
        const ownedChips = chips(owned)
        const first = selectSparkleChips(ownedChips)
        const second = selectSparkleChips(ownedChips)

        expect(first).toHaveLength(expected)
        expect(second).toEqual(first)
        expect(first.every((chip) => ownedChips.includes(chip))).toBe(true)
    })
})
