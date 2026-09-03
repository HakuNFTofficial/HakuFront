export const NFT_SOURCE_SIZE = 3000
export const NFT_PREVIEW_SIZE = 512

export interface ChipCoordinate {
    x: number
    y: number
    w: number
    h: number
}

export interface ScaledChipRect {
    x: number
    y: number
    width: number
    height: number
}

function isValidChipCoordinate(chip: ChipCoordinate): boolean {
    return Number.isFinite(chip.x)
        && Number.isFinite(chip.y)
        && Number.isFinite(chip.w)
        && Number.isFinite(chip.h)
        && chip.x >= 0
        && chip.y >= 0
        && chip.w > 0
        && chip.h > 0
        && chip.x + chip.w <= NFT_SOURCE_SIZE
        && chip.y + chip.h <= NFT_SOURCE_SIZE
}

export function getValidChipCoordinates(
    chips: ChipCoordinate[],
): ChipCoordinate[] {
    return chips.filter(isValidChipCoordinate)
}

export function scaleChipRect(chip: ChipCoordinate): ScaledChipRect {
    const scale = NFT_PREVIEW_SIZE / NFT_SOURCE_SIZE

    return {
        x: chip.x * scale,
        y: chip.y * scale,
        width: chip.w * scale,
        height: chip.h * scale,
    }
}

export function selectSparkleChips(
    chips: ChipCoordinate[],
): ChipCoordinate[] {
    const validChips = getValidChipCoordinates(chips)
    const limit = validChips.length > 1_000
        ? 100
        : Math.min(validChips.length, 30)

    if (validChips.length <= limit) return validChips

    return Array.from({ length: limit }, (_, index) => (
        validChips[Math.floor(index * validChips.length / limit)]
    ))
}
