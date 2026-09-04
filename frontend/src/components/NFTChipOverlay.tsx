import { useEffect, useMemo, useRef } from 'react'

import {
    getValidChipCoordinates,
    NFT_PREVIEW_SIZE,
    scaleChipRect,
    selectSparkleChips,
    type ChipCoordinate,
} from '../nft/chipOverlay'
import {
    createFloatingStarPlans,
    getFloatingStarFrame,
    STAR_SEQUENCE_MS,
    type FloatingStarFrame,
    type FloatingStarPlan,
} from '../nft/chipStarAnimation'
import { createFragmentShareImage } from '../nft/fragmentShareImage'
import { startAnimationFrameLoop } from '../services/animationFrameLoop'

interface NFTChipOverlayProps {
    image: HTMLImageElement
    nftId: number
    expectedCount: number
    chips: ChipCoordinate[]
    onSnapshotReady?: (blob: Blob) => void
    onSnapshotPending?: () => void
}

function drawFloatingStar(
    context: CanvasRenderingContext2D,
    plan: FloatingStarPlan,
    frame: FloatingStarFrame,
    elapsed: number,
    index: number,
) {
    const starSize = NFT_PREVIEW_SIZE * 0.025
    const beamLength = starSize * 5
    const { hue } = plan

    context.save()
    context.globalCompositeOperation = 'lighter'

    const halo = context.createRadialGradient(
        frame.x,
        frame.y,
        0,
        frame.x,
        frame.y,
        starSize * frame.scale * 3,
    )
    halo.addColorStop(0, `hsla(${hue}, 70%, 50%, ${frame.alpha * 0.6})`)
    halo.addColorStop(0.3, `hsla(${hue}, 60%, 40%, ${frame.alpha * 0.4})`)
    halo.addColorStop(0.6, `hsla(${hue}, 50%, 30%, ${frame.alpha * 0.2})`)
    halo.addColorStop(1, `hsla(${hue}, 40%, 20%, 0)`)
    context.fillStyle = halo
    context.beginPath()
    context.arc(
        frame.x,
        frame.y,
        starSize * frame.scale * 3,
        0,
        Math.PI * 2,
    )
    context.fill()

    context.translate(frame.x, frame.y)
    context.rotate(frame.rotation)
    context.scale(frame.scale, frame.scale)

    const drawBeam = (angle: number, length: number, thin: boolean) => {
        context.save()
        context.rotate(angle)

        const gradient = context.createLinearGradient(0, 0, length, 0)
        gradient.addColorStop(0, `hsla(${hue}, 100%, 95%, ${frame.alpha})`)
        gradient.addColorStop(0.1, `hsla(${hue}, 95%, 85%, ${frame.alpha * 0.95})`)
        gradient.addColorStop(0.3, `hsla(${hue}, 90%, 75%, ${frame.alpha * 0.85})`)
        gradient.addColorStop(0.6, `hsla(${hue}, 80%, 65%, ${frame.alpha * 0.5})`)
        gradient.addColorStop(1, `hsla(${hue}, 70%, 55%, 0)`)
        context.fillStyle = gradient

        const halfWidth = starSize * (thin ? 0.05 : 0.15)
        context.beginPath()
        context.moveTo(0, 0)
        context.lineTo(length * 0.3, -halfWidth)
        context.lineTo(length, 0)
        context.lineTo(length * 0.3, halfWidth)
        context.closePath()
        context.fill()
        context.restore()
    }

    for (let arm = 0; arm < 4; arm += 1) {
        const angle = arm * Math.PI / 2
        drawBeam(angle, beamLength, false)
        drawBeam(angle, beamLength * 1.3, true)
    }

    const pulse = 0.95 + Math.sin(elapsed / 100 + index * 0.5) * 0.05
    const core = context.createRadialGradient(
        0,
        0,
        0,
        0,
        0,
        starSize * 1.2 * pulse,
    )
    core.addColorStop(0, `hsla(${hue}, 100%, 95%, ${frame.alpha})`)
    core.addColorStop(0.2, `hsla(${hue}, 95%, 90%, ${frame.alpha * 0.95})`)
    core.addColorStop(0.4, `hsla(${hue}, 90%, 80%, ${frame.alpha * 0.85})`)
    core.addColorStop(0.7, `hsla(${hue}, 85%, 70%, ${frame.alpha * 0.4})`)
    core.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`)
    context.fillStyle = core
    context.beginPath()
    context.arc(0, 0, starSize * 1.2 * pulse, 0, Math.PI * 2)
    context.fill()

    const innerCore = context.createRadialGradient(
        0,
        0,
        0,
        0,
        0,
        starSize * 0.3,
    )
    innerCore.addColorStop(0, `hsla(${hue}, 100%, 100%, ${frame.alpha})`)
    innerCore.addColorStop(0.5, `hsla(${hue}, 100%, 95%, ${frame.alpha * 0.8})`)
    innerCore.addColorStop(1, `hsla(${hue}, 95%, 85%, 0)`)
    context.fillStyle = innerCore
    context.beginPath()
    context.arc(0, 0, starSize * 0.3, 0, Math.PI * 2)
    context.fill()

    for (let sparkle = 0; sparkle < 6; sparkle += 1) {
        const angle = sparkle * Math.PI / 3 - frame.rotation * 0.6
        const distance = starSize * (
            1.4 + Math.sin(elapsed / 150 + sparkle) * 0.25
        )
        const sparkleX = Math.cos(angle) * distance
        const sparkleY = Math.sin(angle) * distance
        const sparkleSize = starSize * 0.15 * (
            0.6 + Math.sin(elapsed / 120 + sparkle * 2) * 0.4
        )
        const sparkleAlpha = frame.alpha * (
            0.6 + Math.sin(elapsed / 80 + sparkle * 3) * 0.3
        )
        const sparkleHue = (hue + sparkle * 60) % 360
        const sparkleGradient = context.createRadialGradient(
            sparkleX,
            sparkleY,
            0,
            sparkleX,
            sparkleY,
            sparkleSize * 2.5,
        )
        sparkleGradient.addColorStop(
            0,
            `hsla(${sparkleHue}, 100%, 90%, ${sparkleAlpha})`,
        )
        sparkleGradient.addColorStop(
            0.4,
            `hsla(${sparkleHue}, 90%, 80%, ${sparkleAlpha * 0.6})`,
        )
        sparkleGradient.addColorStop(1, `hsla(${sparkleHue}, 80%, 70%, 0)`)
        context.fillStyle = sparkleGradient
        context.beginPath()
        context.arc(sparkleX, sparkleY, sparkleSize * 2.5, 0, Math.PI * 2)
        context.fill()
    }

    context.restore()
}

export function NFTChipOverlay({
    image,
    nftId,
    expectedCount,
    chips,
    onSnapshotReady,
    onSnapshotPending,
}: NFTChipOverlayProps) {
    const colorCanvasRef = useRef<HTMLCanvasElement>(null)
    const sparkleCanvasRef = useRef<HTMLCanvasElement>(null)
    const validChips = useMemo(() => getValidChipCoordinates(chips), [chips])
    const renderedChips = useMemo(
        () => validChips.slice(0, expectedCount),
        [expectedCount, validChips],
    )
    const hasExactChipCoordinates = Number.isInteger(expectedCount)
        && expectedCount >= 0
        && chips.length === expectedCount
        && validChips.length === expectedCount
    const sparkleChips = useMemo(
        () => selectSparkleChips(renderedChips),
        [renderedChips],
    )
    const starPlans = useMemo(
        () => createFloatingStarPlans(sparkleChips),
        [sparkleChips],
    )

    useEffect(() => {
        if (hasExactChipCoordinates) return

        console.error({
            event: 'nft_chip_coordinates_invalid',
            nftId,
            expectedCount,
            receivedCount: chips.length,
            validCount: validChips.length,
        })
    }, [chips.length, expectedCount, hasExactChipCoordinates, nftId, validChips.length])

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
        if (!onSnapshotReady) return
        onSnapshotPending?.()
        if (!hasExactChipCoordinates) return

        let cancelled = false
        void createFragmentShareImage({
            image,
            expectedCount,
            chips,
        }).then((blob) => {
            if (!cancelled) onSnapshotReady(blob)
        }).catch((error: unknown) => {
            if (cancelled) return
            console.error({
                event: 'nft_fragment_share_image_failed',
                nftId,
                expectedCount,
                validCount: validChips.length,
                error: error instanceof Error ? error.message : String(error),
            })
        })

        return () => {
            cancelled = true
        }
    }, [
        chips,
        expectedCount,
        hasExactChipCoordinates,
        image,
        nftId,
        onSnapshotPending,
        onSnapshotReady,
        validChips.length,
    ])

    useEffect(() => {
        const canvas = sparkleCanvasRef.current
        const context = canvas?.getContext('2d')
        if (!canvas || !context || starPlans.length === 0) return

        const reduceMotion = typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduceMotion) return

        let startedAt: number | null = null

        return startAnimationFrameLoop((timestamp) => {
            if (startedAt === null) startedAt = timestamp
            const elapsed = timestamp - startedAt
            context.clearRect(0, 0, NFT_PREVIEW_SIZE, NFT_PREVIEW_SIZE)
            starPlans.forEach((plan, index) => {
                const frame = getFloatingStarFrame(
                    plan,
                    index,
                    starPlans.length,
                    elapsed,
                )
                if (frame.alpha <= 0) return
                drawFloatingStar(context, plan, frame, elapsed, index)
            })
            return elapsed < STAR_SEQUENCE_MS
        })
    }, [starPlans])

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
                className="absolute inset-0 h-full w-full object-contain"
            />
            <canvas
                ref={sparkleCanvasRef}
                width={NFT_PREVIEW_SIZE}
                height={NFT_PREVIEW_SIZE}
                className="absolute inset-0 h-full w-full object-contain"
            />
        </div>
    )
}
