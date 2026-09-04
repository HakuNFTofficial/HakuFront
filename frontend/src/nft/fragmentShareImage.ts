import {
    getValidChipCoordinates,
    NFT_PREVIEW_SIZE,
    scaleChipRect,
    type ChipCoordinate,
} from './chipOverlay'

const PREVIEW_SCALE = 1.04
const BLUR_RADIUS = 10
const BRIGHTNESS = 0.16
const CONTRAST = 0.72

interface FragmentShareImageOptions {
    image: HTMLImageElement
    chips: ChipCoordinate[]
    expectedCount: number
    createCanvas?: () => HTMLCanvasElement
}

function applySilhouetteFilter(imageData: ImageData): void {
    const { data, width, height } = imageData
    const grayscale = new Float32Array(width * height)
    const horizontalBlur = new Float32Array(width * height)

    for (let pixel = 0; pixel < grayscale.length; pixel += 1) {
        const offset = pixel * 4
        grayscale[pixel] = data[offset] * 0.2126
            + data[offset + 1] * 0.7152
            + data[offset + 2] * 0.0722
    }

    for (let y = 0; y < height; y += 1) {
        const rowOffset = y * width
        let sum = 0
        for (let x = 0; x <= Math.min(BLUR_RADIUS, width - 1); x += 1) {
            sum += grayscale[rowOffset + x]
        }

        for (let x = 0; x < width; x += 1) {
            const left = Math.max(0, x - BLUR_RADIUS)
            const right = Math.min(width - 1, x + BLUR_RADIUS)
            horizontalBlur[rowOffset + x] = sum / (right - left + 1)

            const removeX = x - BLUR_RADIUS
            if (removeX >= 0) sum -= grayscale[rowOffset + removeX]
            const addX = x + BLUR_RADIUS + 1
            if (addX < width) sum += grayscale[rowOffset + addX]
        }
    }

    for (let x = 0; x < width; x += 1) {
        let sum = 0
        for (let y = 0; y <= Math.min(BLUR_RADIUS, height - 1); y += 1) {
            sum += horizontalBlur[y * width + x]
        }

        for (let y = 0; y < height; y += 1) {
            const top = Math.max(0, y - BLUR_RADIUS)
            const bottom = Math.min(height - 1, y + BLUR_RADIUS)
            const blurred = sum / (bottom - top + 1)
            const adjusted = (blurred * BRIGHTNESS - 128) * CONTRAST + 128
            const offset = (y * width + x) * 4
            data[offset] = adjusted
            data[offset + 1] = adjusted
            data[offset + 2] = adjusted

            const removeY = y - BLUR_RADIUS
            if (removeY >= 0) sum -= horizontalBlur[removeY * width + x]
            const addY = y + BLUR_RADIUS + 1
            if (addY < height) sum += horizontalBlur[addY * width + x]
        }
    }
}

export async function createFragmentShareImage({
    image,
    chips,
    expectedCount,
    createCanvas = () => document.createElement('canvas'),
}: FragmentShareImageOptions): Promise<Blob> {
    const validChips = getValidChipCoordinates(chips)
    if (!Number.isInteger(expectedCount)
        || expectedCount < 0
        || chips.length !== expectedCount
        || validChips.length !== expectedCount) {
        throw new Error('fragment_share_image_chip_coordinates_incomplete')
    }

    const canvas = createCanvas()
    canvas.width = NFT_PREVIEW_SIZE
    canvas.height = NFT_PREVIEW_SIZE

    const context = canvas.getContext('2d')
    if (!context) {
        throw new Error('fragment_share_image_canvas_context_unavailable')
    }

    context.fillStyle = '#171922'
    context.fillRect(0, 0, NFT_PREVIEW_SIZE, NFT_PREVIEW_SIZE)

    const previewOffset = -(NFT_PREVIEW_SIZE * 0.02)
    const previewSize = NFT_PREVIEW_SIZE * PREVIEW_SCALE
    context.drawImage(
        image,
        previewOffset,
        previewOffset,
        previewSize,
        previewSize,
    )
    const silhouette = context.getImageData(
        0,
        0,
        NFT_PREVIEW_SIZE,
        NFT_PREVIEW_SIZE,
    )
    applySilhouetteFilter(silhouette)
    context.putImageData(silhouette, 0, 0)

    for (const chip of validChips) {
        const rect = scaleChipRect(chip)
        context.drawImage(
            image,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
        )
    }

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('fragment_share_image_blob_unavailable'))
                return
            }
            resolve(blob)
        }, 'image/png')
    })
}
