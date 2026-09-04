import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createFragmentShareImage } from '../nft/fragmentShareImage'
import { NFTChipOverlay } from './NFTChipOverlay'

vi.mock('../nft/fragmentShareImage', () => ({
    createFragmentShareImage: vi.fn(),
}))

function context() {
    return {
        beginPath: vi.fn(),
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        fill: vi.fn(),
        fillRect: vi.fn(),
        lineTo: vi.fn(),
        moveTo: vi.fn(),
        restore: vi.fn(),
        rotate: vi.fn(),
        save: vi.fn(),
        stroke: vi.fn(),
        translate: vi.fn(),
        arc: vi.fn(),
        closePath: vi.fn(),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        scale: vi.fn(),
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        shadowBlur: 0,
        shadowColor: '',
    }
}

describe('NFTChipOverlay', () => {
    const colorContext = context()
    const sparkleContext = context()
    const image = document.createElement('img')
    let frameCallbacks: FrameRequestCallback[]

    beforeEach(() => {
        frameCallbacks = []
        vi.mocked(createFragmentShareImage).mockReset().mockResolvedValue(
            new Blob(['png'], { type: 'image/png' }),
        )
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockReturnValueOnce(colorContext as unknown as CanvasRenderingContext2D)
            .mockReturnValueOnce(sparkleContext as unknown as CanvasRenderingContext2D)
        vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
            frameCallbacks.push(callback)
            return frameCallbacks.length
        }))
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
        vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        Object.values(colorContext).forEach((value) => {
            if (typeof value === 'function' && 'mockClear' in value) value.mockClear()
        })
        Object.values(sparkleContext).forEach((value) => {
            if (typeof value === 'function' && 'mockClear' in value) value.mockClear()
        })
    })

    it('copies the exact owned rectangle from the loaded color preview', () => {
        render(
            <NFTChipOverlay
                image={image}
                nftId={3995}
                expectedCount={1}
                chips={[{ x: 300, y: 600, w: 30, h: 60 }]}
            />,
        )

        expect(screen.getByTestId('nft-chip-overlay')).toBeInTheDocument()
        expect(colorContext.drawImage).toHaveBeenCalledOnce()
        const draw = colorContext.drawImage.mock.calls[0]
        expect(draw[0]).toBe(image)
        expect(draw[1]).toBeCloseTo(51.2)
        expect(draw[2]).toBeCloseTo(102.4)
        expect(draw[3]).toBeCloseTo(5.12)
        expect(draw[4]).toBeCloseTo(10.24)
        expect(draw.slice(5)).toEqual(draw.slice(1, 5))
        expect(requestAnimationFrame).toHaveBeenCalledOnce()
    })

    it('draws a moving multicolored starburst before it lands', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0)

        render(
            <NFTChipOverlay
                image={image}
                nftId={3995}
                expectedCount={1}
                chips={[{ x: 300, y: 600, w: 30, h: 60 }]}
            />,
        )

        frameCallbacks[0](0)
        frameCallbacks[1](750)

        expect(sparkleContext.translate).toHaveBeenCalled()
        expect(sparkleContext.rotate).toHaveBeenCalled()
        expect(sparkleContext.scale).toHaveBeenCalledWith(
            expect.any(Number),
            expect.any(Number),
        )
        expect(sparkleContext.createRadialGradient).toHaveBeenCalled()
        expect(sparkleContext.createLinearGradient).toHaveBeenCalled()
        expect(sparkleContext.fill).toHaveBeenCalled()
    })

    it('logs missing required coordinates without inventing replacements', () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        render(
            <NFTChipOverlay
                image={image}
                nftId={3995}
                expectedCount={2}
                chips={[{ x: 0, y: 0, w: 30, h: 30 }]}
            />,
        )

        expect(log).toHaveBeenCalledWith({
            event: 'nft_chip_coordinates_invalid',
            nftId: 3995,
            expectedCount: 2,
            receivedCount: 1,
            validCount: 1,
        })
        expect(colorContext.drawImage).toHaveBeenCalledOnce()
    })

    it('keeps exact-color chips visible without scheduling motion when reduced', () => {
        vi.mocked(matchMedia).mockReturnValue({ matches: true } as MediaQueryList)

        render(
            <NFTChipOverlay
                image={image}
                nftId={3995}
                expectedCount={1}
                chips={[{ x: 0, y: 0, w: 30, h: 30 }]}
            />,
        )

        expect(colorContext.drawImage).toHaveBeenCalledOnce()
        expect(requestAnimationFrame).not.toHaveBeenCalled()
    })

    it('keeps both canvas layers contained inside the square media boundary', () => {
        render(
            <NFTChipOverlay
                image={image}
                nftId={3995}
                expectedCount={1}
                chips={[{ x: 0, y: 0, w: 30, h: 30 }]}
            />,
        )

        const overlay = screen.getByTestId('nft-chip-overlay')
        const canvases = overlay.querySelectorAll('canvas')

        expect(canvases).toHaveLength(2)
        canvases.forEach((canvas) => {
            expect(canvas).toHaveClass('h-full', 'w-full', 'object-contain')
        })
    })

    it('delivers a stable promotional PNG after drawing the exact chips', async () => {
        const onSnapshotReady = vi.fn()
        const onSnapshotPending = vi.fn()

        render(
            <NFTChipOverlay
                image={image}
                nftId={3995}
                expectedCount={1}
                chips={[{ x: 0, y: 0, w: 30, h: 30 }]}
                onSnapshotReady={onSnapshotReady}
                onSnapshotPending={onSnapshotPending}
            />,
        )

        await waitFor(() => expect(onSnapshotReady).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'image/png' }),
        ))
        expect(createFragmentShareImage).toHaveBeenCalledWith({
            image,
            expectedCount: 1,
            chips: [{ x: 0, y: 0, w: 30, h: 30 }],
        })
        expect(onSnapshotPending).toHaveBeenCalledOnce()
    })

    it('logs an actionable error when promotional image export fails', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.mocked(createFragmentShareImage).mockRejectedValueOnce(
            new Error('canvas is tainted'),
        )

        render(
            <NFTChipOverlay
                image={image}
                nftId={3995}
                expectedCount={1}
                chips={[{ x: 0, y: 0, w: 30, h: 30 }]}
                onSnapshotReady={vi.fn()}
            />,
        )

        await waitFor(() => expect(log).toHaveBeenCalledWith({
            event: 'nft_fragment_share_image_failed',
            nftId: 3995,
            expectedCount: 1,
            validCount: 1,
            error: 'canvas is tainted',
        }))
    })

    it('clears the save target and refuses export when coordinates are incomplete', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const onSnapshotReady = vi.fn()
        const onSnapshotPending = vi.fn()

        render(
            <NFTChipOverlay
                image={image}
                nftId={3995}
                expectedCount={2}
                chips={[{ x: 0, y: 0, w: 30, h: 30 }]}
                onSnapshotReady={onSnapshotReady}
                onSnapshotPending={onSnapshotPending}
            />,
        )

        expect(onSnapshotPending).toHaveBeenCalledOnce()
        expect(createFragmentShareImage).not.toHaveBeenCalled()
        expect(onSnapshotReady).not.toHaveBeenCalled()
    })
})
