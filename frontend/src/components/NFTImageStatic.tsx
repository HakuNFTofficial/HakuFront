import { useEffect, useRef, useState } from 'react'
import { getIPFSImageUrl } from '../config/ipfs'

// Chip coordinate structure (x, y, w, h describe chip position in parent NFT)
interface Chip {
    x: number  // X coordinate in pixels
    y: number  // Y coordinate in pixels
    w: number  // Width in pixels
    h: number  // Height in pixels
}

interface NFTImageStaticProps {
    nftId: number
    fileName: string | null
    ownedChips: Chip[]  // Array of chip coordinates
    ownedChipsCount: number  // Actual count from backend
    totalChips: number
    isMint: number  // 0: not minted, 1: minting, 2: burned
    allChipsOwned: boolean  // Whether all chips are collected
    className?: string
}

/**
 * NFTImageStatic Component
 * Displays NFT image as grayscale background with colored chips overlay
 * For Mintable (all chips owned) or Burnable status: shows full color image
 * No animations - static display only
 */
export function NFTImageStatic({ nftId, fileName, ownedChips, ownedChipsCount, isMint, allChipsOwned, className = '' }: NFTImageStaticProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [imageLoaded, setImageLoaded] = useState(false)
    const [imageError, setImageError] = useState(false)

    // Get image URL from IPFS
    const imageUrl = fileName 
        ? getIPFSImageUrl(fileName)
        : getIPFSImageUrl(`${nftId}.png`)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !imageLoaded) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Load the image
        const img = new Image()
        img.crossOrigin = 'anonymous'
        
        img.onload = () => {
            // Set canvas size to match container (will be scaled by CSS)
            canvas.width = img.width
            canvas.height = img.height

            // Only draw colored chips (no grayscale background - that's handled by the img tag)
            if (ownedChips && ownedChips.length > 0) {
                drawChips(ctx, img, ownedChips, 1) // scale = 1 since canvas matches image size
            }
        }

        img.onerror = () => {
            setImageError(true)
        }

        img.src = imageUrl
    }, [imageUrl, imageLoaded, ownedChips])

    // Draw colored chips overlay using x,y,w,h coordinates from backend
    const drawChips = (
        ctx: CanvasRenderingContext2D,
        img: HTMLImageElement,
        ownedChips: Chip[],
        _scale: number = 1
    ) => {
        // Draw each owned chip using its coordinates (no scaling needed)
        ownedChips.forEach((chip, index) => {
            try {
                // Draw the colored chip from the original image
                ctx.globalAlpha = 1.0
                ctx.filter = 'brightness(1.2) saturate(1.3)' // Brighten the chip
                
                // Draw chip area from original image at original size
                ctx.drawImage(
                    img,
                    chip.x, chip.y, chip.w, chip.h,  // Source: chip area in original image
                    chip.x, chip.y, chip.w, chip.h   // Dest: same position on canvas
                )
                
                ctx.filter = 'none'
                ctx.globalAlpha = 1.0
            } catch (err) {
                console.warn(`[NFTImageStatic] Failed to draw chip ${index}:`, err)
            }
        })
    }

    // Handle image load from img tag
    const handleImageLoad = () => {
        setImageLoaded(true)
    }

    const handleImageError = () => {
        setImageError(true)
    }

    if (imageError) {
        return (
            <div className={`flex items-center justify-center bg-gray-800 ${className}`}>
                <div className="text-center text-gray-400">
                    <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">NFT #{nftId}</p>
                </div>
            </div>
        )
    }

    // Check if should show full color image (Mintable or Burned status)
    const isMintable = isMint === 0 && allChipsOwned
    const isBurned = isMint === 2
    const showFullColor = isMintable || isBurned
    
    // When chips are incomplete, keep image mysterious (dark + blur) to maintain game feel
    // Only show full color when all chips are collected or NFT is burned
    const hasNoChips = ownedChipsCount === 0
    const backgroundOpacity = showFullColor ? 1 : (hasNoChips ? 0.25 : 0.15) // Slightly visible for 0 chips, very dark for partial
    const backgroundFilter = showFullColor 
        ? 'none' 
        : hasNoChips
            ? 'grayscale(100%) blur(12px) brightness(0.4) contrast(0.6)' // Dark + strong blur for 0 chips (mysterious)
            : 'grayscale(100%) blur(8px) brightness(0.3) contrast(0.5)' // Dark for partial chips

    return (
        <div className={`relative ${className}`}>
            {/* Base layer: Image with conditional grayscale filter */}
            <img
                src={imageUrl}
                alt={`NFT #${nftId}`}
                className="absolute inset-0 w-full h-full object-contain"
                onLoad={handleImageLoad}
                onError={handleImageError}
                style={{
                    // Show full color for Mintable or Burned, otherwise mysterious dark + blur effect
                    // Maintains game feel: users can see outline but not details until chips are collected
                    filter: backgroundFilter,
                    opacity: backgroundOpacity,
                    zIndex: 1,
                    display: imageLoaded ? 'block' : 'none'
                }}
            />

            {/* Top layer: Canvas for colored chips (only show if not full color) */}
            {!showFullColor && (
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-contain"
                    style={{ 
                        zIndex: 2,
                        display: imageLoaded ? 'block' : 'none'
                    }}
                />
            )}

            {/* Loading state */}
            {!imageLoaded && !imageError && (
                <div className="flex items-center justify-center bg-gray-800 aspect-square">
                    <span className="loading loading-spinner loading-md text-primary"></span>
                </div>
            )}
        </div>
    )
}
