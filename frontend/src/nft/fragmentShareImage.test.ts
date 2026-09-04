import { describe, expect, it, vi } from 'vitest'

import { createFragmentShareImage } from './fragmentShareImage'

function createCanvasHarness(
    blob: Blob | null = new Blob(['png'], { type: 'image/png' }),
    pixelValue: (x: number, y: number) => [number, number, number] = () => (
        [100, 150, 200]
    ),
) {
    const pixels = new Uint8ClampedArray(512 * 512 * 4)
    for (let y = 0; y < 512; y += 1) {
        for (let x = 0; x < 512; x += 1) {
            const index = (y * 512 + x) * 4
            const [red, green, blue] = pixelValue(x, y)
            pixels[index] = red
            pixels[index + 1] = green
            pixels[index + 2] = blue
            pixels[index + 3] = 255
        }
    }
    const context = {
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        getImageData: vi.fn(() => ({ data: pixels, width: 512, height: 512 })),
        putImageData: vi.fn(),
        restore: vi.fn(),
        save: vi.fn(),
        fillStyle: '',
        filter: 'unsupported',
    }
    const canvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => context),
        toBlob: vi.fn((callback: BlobCallback) => callback(blob)),
    }

    return { canvas, context }
}

describe('createFragmentShareImage', () => {
    it('composes a stable 512px PNG from the silhouette and exact owned chips', async () => {
        const image = document.createElement('img')
        const { canvas, context } = createCanvasHarness()

        const blob = await createFragmentShareImage({
            image,
            chips: [{ x: 300, y: 600, w: 30, h: 60 }],
            expectedCount: 1,
            createCanvas: () => canvas as unknown as HTMLCanvasElement,
        })

        expect(canvas.width).toBe(512)
        expect(canvas.height).toBe(512)
        expect(context.fillRect).toHaveBeenCalledWith(0, 0, 512, 512)
        expect(context.drawImage).toHaveBeenNthCalledWith(
            1,
            image,
            -10.24,
            -10.24,
            532.48,
            532.48,
        )
        const chipDraw = context.drawImage.mock.calls[1]
        expect(chipDraw[0]).toBe(image)
        expect(chipDraw[1]).toBeCloseTo(51.2)
        expect(chipDraw[2]).toBeCloseTo(102.4)
        expect(chipDraw[3]).toBeCloseTo(5.12)
        expect(chipDraw[4]).toBeCloseTo(10.24)
        expect(chipDraw.slice(5)).toEqual(chipDraw.slice(1, 5))
        expect(context.filter).toBe('unsupported')
        expect(context.getImageData).toHaveBeenCalledWith(0, 0, 512, 512)
        expect(context.putImageData).toHaveBeenCalledOnce()
        const filtered = context.putImageData.mock.calls[0][0].data
        expect(filtered[0]).toBe(filtered[1])
        expect(filtered[1]).toBe(filtered[2])
        expect(filtered[0]).toBeLessThan(70)
        expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
        expect(blob.type).toBe('image/png')
    })

    it('keeps every validated chip in source order', async () => {
        const image = document.createElement('img')
        const { canvas, context } = createCanvasHarness()

        await createFragmentShareImage({
            image,
            chips: [
                { x: 0, y: 0, w: 30, h: 30 },
                { x: 30, y: 0, w: 30, h: 30 },
            ],
            expectedCount: 2,
            createCanvas: () => canvas as unknown as HTMLCanvasElement,
        })

        expect(context.drawImage).toHaveBeenCalledTimes(3)
    })

    it('blurs hard edges across both axes before darkening the silhouette', async () => {
        const { canvas, context } = createCanvasHarness(undefined, (x, y) => (
            x < 256 && y < 256 ? [255, 255, 255] : [0, 0, 0]
        ))

        await createFragmentShareImage({
            image: document.createElement('img'),
            chips: [],
            expectedCount: 0,
            createCanvas: () => canvas as unknown as HTMLCanvasElement,
        })

        const filtered = context.putImageData.mock.calls[0][0].data
        const valueAt = (x: number, y: number) => filtered[(y * 512 + x) * 4]
        expect(valueAt(260, 250)).toBeGreaterThan(valueAt(400, 400))
        expect(valueAt(250, 260)).toBeGreaterThan(valueAt(400, 400))
    })

    it('fails explicitly when the browser cannot create the PNG blob', async () => {
        const { canvas } = createCanvasHarness(null)

        await expect(createFragmentShareImage({
            image: document.createElement('img'),
            chips: [],
            expectedCount: 0,
            createCanvas: () => canvas as unknown as HTMLCanvasElement,
        })).rejects.toThrow('fragment_share_image_blob_unavailable')
    })

    it('fails closed instead of exporting incomplete chip coordinates', async () => {
        const { canvas } = createCanvasHarness()

        await expect(createFragmentShareImage({
            image: document.createElement('img'),
            chips: [{ x: 0, y: 0, w: 30, h: 30 }],
            expectedCount: 2,
            createCanvas: () => canvas as unknown as HTMLCanvasElement,
        })).rejects.toThrow('fragment_share_image_chip_coordinates_incomplete')
        expect(canvas.toBlob).not.toHaveBeenCalled()
    })

    it('fails closed when an owned coordinate is invalid', async () => {
        const { canvas } = createCanvasHarness()

        await expect(createFragmentShareImage({
            image: document.createElement('img'),
            chips: [{ x: -1, y: 0, w: 30, h: 30 }],
            expectedCount: 1,
            createCanvas: () => canvas as unknown as HTMLCanvasElement,
        })).rejects.toThrow('fragment_share_image_chip_coordinates_incomplete')
        expect(canvas.toBlob).not.toHaveBeenCalled()
    })

    it('fails explicitly when a canvas context is unavailable', async () => {
        const canvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => null),
        }

        await expect(createFragmentShareImage({
            image: document.createElement('img'),
            chips: [],
            expectedCount: 0,
            createCanvas: () => canvas as unknown as HTMLCanvasElement,
        })).rejects.toThrow('fragment_share_image_canvas_context_unavailable')
    })
})
