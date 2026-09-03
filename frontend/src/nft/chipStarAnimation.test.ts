import { describe, expect, it } from 'vitest'

import {
    createFloatingStarPlans,
    getFloatingStarFrame,
    STAR_EDGE_OFFSET,
    STAR_FLIGHT_MS,
    STAR_SEQUENCE_MS,
} from './chipStarAnimation'

import { NFT_PREVIEW_SIZE, type ChipCoordinate } from './chipOverlay'

const chip: ChipCoordinate = { x: 300, y: 600, w: 30, h: 60 }

function randomSequence(values: number[]): () => number {
    let index = 0
    return () => values[index++ % values.length]
}

describe('floating chip stars', () => {
    it('targets the selected real chip center without inventing a position', () => {
        const [plan] = createFloatingStarPlans(
            [chip],
            randomSequence([0, 0.25, 0.5, 0.75]),
        )

        expect(plan.chip).toBe(chip)
        expect(plan.targetX).toBeCloseTo(53.76)
        expect(plan.targetY).toBeCloseTo(107.52)
    })

    it.each([
        [0, { axis: 'startY', value: -STAR_EDGE_OFFSET }],
        [0.25, { axis: 'startX', value: NFT_PREVIEW_SIZE + STAR_EDGE_OFFSET }],
        [0.5, { axis: 'startY', value: NFT_PREVIEW_SIZE + STAR_EDGE_OFFSET }],
        [0.75, { axis: 'startX', value: -STAR_EDGE_OFFSET }],
    ] as const)('starts outside canvas edge selected by random value %s', (side, expected) => {
        const [plan] = createFloatingStarPlans(
            [chip],
            randomSequence([side, 0.5, 0, 0]),
        )

        expect(plan[expected.axis]).toBe(expected.value)
    })

    it('fades in, shrinks, reaches the chip target, and fades out', () => {
        const [plan] = createFloatingStarPlans([chip], () => 0)
        const opening = getFloatingStarFrame(plan, 0, 1, STAR_FLIGHT_MS * 0.2)
        const bright = getFloatingStarFrame(plan, 0, 1, STAR_FLIGHT_MS * 0.6)
        const landing = getFloatingStarFrame(plan, 0, 1, STAR_FLIGHT_MS)

        expect(opening.alpha).toBeCloseTo(0.5)
        expect(bright.alpha).toBe(1)
        expect(opening.scale).toBeGreaterThan(bright.scale)
        expect(bright.scale).toBeGreaterThan(landing.scale)
        expect(landing.x).toBeCloseTo(plan.targetX)
        expect(landing.y).toBeCloseTo(plan.targetY)
        expect(landing.alpha).toBe(0)
        expect(landing.complete).toBe(true)
    })

    it('stays hidden before its stagger and finishes the final flight at eight seconds', () => {
        const plans = createFloatingStarPlans([chip, chip, chip], () => 0)
        const beforeLastStarts = getFloatingStarFrame(
            plans[2],
            2,
            plans.length,
            STAR_SEQUENCE_MS - STAR_FLIGHT_MS - 1,
        )
        const lastLanding = getFloatingStarFrame(
            plans[2],
            2,
            plans.length,
            STAR_SEQUENCE_MS,
        )

        expect(beforeLastStarts.alpha).toBe(0)
        expect(beforeLastStarts.complete).toBe(false)
        expect(lastLanding.alpha).toBe(0)
        expect(lastLanding.complete).toBe(true)
    })
})
