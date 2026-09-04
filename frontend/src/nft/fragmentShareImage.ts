import {
    getValidChipCoordinates,
    NFT_PREVIEW_SIZE,
    scaleChipRect,
    type ChipCoordinate,
} from './chipOverlay'

const PREVIEW_SCALE = 1.04
const PREVIEW_FILTER = 'grayscale(1) blur(10px) brightness(0.16) contrast(0.72)'

interface FragmentShareImageOptions {
    image: HTMLImageElement
    chips: ChipCoordinate[]
    expectedCount: number
    createCanvas?: () => HTMLCanvasElement
}

export async function createFragmentShareImage({
    image,
    chips,
    expectedCount,
    createCanvas = () => document.createElement('canvas'),
}: FragmentShareImageOptions): Promise<Blob> {
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
    context.save()
    context.filter = PREVIEW_FILTER
    context.drawImage(
        image,
        previewOffset,
        previewOffset,
        previewSize,
        previewSize,
    )
    context.restore()

    const renderedChips = getValidChipCoordinates(chips).slice(0, expectedCount)
    for (const chip of renderedChips) {
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
