import {
    NFT_PREVIEW_SIZE,
    scaleChipRect,
    type ChipCoordinate,
} from './chipOverlay'

export const STAR_SEQUENCE_MS = 8_000
export const STAR_FLIGHT_MS = 1_500
export const STAR_EDGE_OFFSET = 80

export interface FloatingStarPlan {
    chip: ChipCoordinate
    startX: number
    startY: number
    targetX: number
    targetY: number
    startRotation: number
    hue: number
}

export interface FloatingStarFrame {
    x: number
    y: number
    rotation: number
    scale: number
    alpha: number
    complete: boolean
}

function getStartPosition(
    side: number,
    along: number,
): Pick<FloatingStarPlan, 'startX' | 'startY'> {
    if (side === 0) {
        return { startX: along, startY: -STAR_EDGE_OFFSET }
    }
    if (side === 1) {
        return {
            startX: NFT_PREVIEW_SIZE + STAR_EDGE_OFFSET,
            startY: along,
        }
    }
    if (side === 2) {
        return {
            startX: along,
            startY: NFT_PREVIEW_SIZE + STAR_EDGE_OFFSET,
        }
    }
    return { startX: -STAR_EDGE_OFFSET, startY: along }
}

export function createFloatingStarPlans(
    chips: ChipCoordinate[],
    random: () => number = Math.random,
): FloatingStarPlan[] {
    return chips.map((chip, index) => {
        const rect = scaleChipRect(chip)
        const side = Math.min(3, Math.floor(random() * 4))
        const along = random() * NFT_PREVIEW_SIZE

        return {
            chip,
            ...getStartPosition(side, along),
            targetX: rect.x + rect.width / 2,
            targetY: rect.y + rect.height / 2,
            startRotation: random() * Math.PI * 2,
            hue: (index * 137.508 + random() * 72) % 360,
        }
    })
}

export function getFloatingStarFrame(
    plan: FloatingStarPlan,
    index: number,
    count: number,
    elapsed: number,
): FloatingStarFrame {
    const delay = count > 1
        ? index * (STAR_SEQUENCE_MS - STAR_FLIGHT_MS) / (count - 1)
        : 0
    const progress = Math.max(
        0,
        Math.min(1, (elapsed - delay) / STAR_FLIGHT_MS),
    )
    const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2
    const alpha = progress <= 0.4
        ? progress / 0.4
        : progress <= 0.8
            ? 1
            : 1 - (progress - 0.8) / 0.2

    return {
        x: plan.startX + (plan.targetX - plan.startX) * eased,
        y: plan.startY + (plan.targetY - plan.startY) * eased,
        rotation: plan.startRotation + progress * Math.PI * 6,
        scale: 1.4 - progress * 0.95,
        alpha: elapsed < delay || progress >= 1 ? 0 : Math.max(0, alpha),
        complete: elapsed >= delay + STAR_FLIGHT_MS,
    }
}
