import { useEffect, useMemo, useRef } from 'react'

import {
    getValidChipCoordinates,
    NFT_PREVIEW_SIZE,
    scaleChipRect,
    selectSparkleChips,
    type ChipCoordinate,
} from '../nft/chipOverlay'
import { startAnimationFrameLoop } from '../services/animationFrameLoop'

interface NFTChipOverlayProps {
    image: HTMLImageElement
    nftId: number
    expectedCount: number
    chips: ChipCoordinate[]
}

const SPARKLE_DURATION_MS = 8_000

function drawSparkle(
    context: CanvasRenderingContext2D,
    chip: ChipCoordinate,
    index: number,
    elapsed: number,
) {
    const rect = scaleChipRect(chip)
    const centerX = rect.x + rect.width / 2
    const centerY = rect.y + rect.height / 2
    const phase = elapsed / 420 + index * 1.7
    const pulse = (Math.sin(phase) + 1) / 2
    const radius = Math.max(2.5, Math.min(6, Math.max(rect.width, rect.height)))
    const alpha = 0.3 + pulse * 0.7

    context.save()
    context.globalCompositeOperation = 'lighter'
    context.globalAlpha = alpha
    context.strokeStyle = '#ffffff'
    context.fillStyle = '#ffffff'
    context.lineWidth = 0.8 + pulse * 0.8
    context.shadowColor = 'rgba(255,255,255,0.95)'
    context.shadowBlur = radius * (1.2 + pulse)
    context.beginPath()
    context.moveTo(centerX - radius, centerY)
    context.lineTo(centerX + radius, centerY)
    context.moveTo(centerX, centerY - radius)
    context.lineTo(centerX, centerY + radius)
    context.stroke()
    context.fillRect(centerX - 1, centerY - 1, 2, 2)
    context.restore()
}

export function NFTChipOverlay({
    image,
    nftId,
    expectedCount,
    chips,
}: NFTChipOverlayProps) {
    const colorCanvasRef = useRef<HTMLCanvasElement>(null)
    const sparkleCanvasRef = useRef<HTMLCanvasElement>(null)
    const validChips = useMemo(() => getValidChipCoordinates(chips), [chips])
    const renderedChips = useMemo(
        () => validChips.slice(0, expectedCount),
        [expectedCount, validChips],
    )

    useEffect(() => {
        if (validChips.length === expectedCount) return

        console.error({
            event: 'nft_chip_coordinates_invalid',
            nftId,
            expectedCount,
            validCount: validChips.length,
        })
    }, [expectedCount, nftId, validChips.length])

    useEffect(() => {
        const canvas = colorCanvasRef.current
        const context = canvas?.getContext('2d')
        if (!canvas || !context) return

        context.clearRect(0, 0, NFT_PREVIEW_SIZE, NFT_PREVIEW_SIZE)
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
    }, [image, renderedChips])

    useEffect(() => {
        const canvas = sparkleCanvasRef.current
        const context = canvas?.getContext('2d')
        if (!canvas || !context || renderedChips.length === 0) return

        const reduceMotion = typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduceMotion) return

        const sparkleChips = selectSparkleChips(renderedChips)
        let startedAt: number | null = null

        return startAnimationFrameLoop((timestamp) => {
            if (startedAt === null) startedAt = timestamp
            const elapsed = timestamp - startedAt
            context.clearRect(0, 0, NFT_PREVIEW_SIZE, NFT_PREVIEW_SIZE)
            sparkleChips.forEach((chip, index) => {
                drawSparkle(context, chip, index, elapsed)
            })
            return elapsed < SPARKLE_DURATION_MS
        })
    }, [renderedChips])

    return (
        <div
            data-testid="nft-chip-overlay"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
        >
            <canvas
                ref={colorCanvasRef}
                width={NFT_PREVIEW_SIZE}
                height={NFT_PREVIEW_SIZE}
                className="absolute inset-0 h-full w-full"
            />
            <canvas
                ref={sparkleCanvasRef}
                width={NFT_PREVIEW_SIZE}
                height={NFT_PREVIEW_SIZE}
                className="absolute inset-0 h-full w-full"
            />
        </div>
    )
}
