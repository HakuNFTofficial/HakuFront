import { describe, expect, it, vi } from 'vitest'

import { createFragmentShareImage } from './fragmentShareImage'

function createCanvasHarness(blob: Blob | null = new Blob(['png'], { type: 'image/png' })) {
    const context = {
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        restore: vi.fn(),
        save: vi.fn(),
        fillStyle: '',
        filter: 'none',
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
        expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
        expect(blob.type).toBe('image/png')
    })

    it('exports only valid coordinates up to the owned count', async () => {
        const image = document.createElement('img')
        const { canvas, context } = createCanvasHarness()

        await createFragmentShareImage({
            image,
            chips: [
                { x: -1, y: 0, w: 30, h: 30 },
                { x: 0, y: 0, w: 30, h: 30 },
                { x: 30, y: 0, w: 30, h: 30 },
            ],
            expectedCount: 1,
            createCanvas: () => canvas as unknown as HTMLCanvasElement,
        })

        expect(context.drawImage).toHaveBeenCalledTimes(2)
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
