import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { getIPFSImageUrl } from '../config/ipfs'

interface Chip {
    x: number      // Pixel coordinate X
    y: number      // Pixel coordinate Y
    w: number      // Width (pixels)
    h: number      // Height (pixels)
    tile_x?: number // Tile index (for filename, e.g.: 0, 1, 2...)
    tile_y?: number // Backup tile coordinate (used if tile_x doesn't exist)
    file_name?: string // Complete file path (e.g.: haixin/haixin_0.png)
    id?: number    // chip ID
    base64?: string // Base64 encoded image (returned by batch API)
}

interface NFT {
    nft_id: number
    file_name: string | null
    all_chips_owned: boolean
    owned_chips_count: number
    total_chips_count: number
    is_mint?: number // 0: Not requested, 1: In progress, 2: Minted (optional, compatible with old data)
}

interface NFTImageRevealProps {
    nft: NFT
}

export function NFTImageReveal({ nft }: NFTImageRevealProps) {
    const { address } = useAccount() // Get current user address
    const canvasRef = useRef<HTMLCanvasElement>(null) // Bottom layer canvas (grayscale background)
    const chipsCanvasRef = useRef<HTMLCanvasElement>(null) // Top layer canvas (colored chips)
    const revealStartTimeRef = useRef<number>(0) // Chips fade-in animation start time
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [chips, setChips] = useState<Chip[]>([])
    const loadedChipsRef = useRef<Set<string>>(new Set()) // Use ref to avoid triggering re-render
    const isLoadingRef = useRef(false) // Prevent duplicate loading
    const hasInitializedRef = useRef(false) // Track whether already initialized
    const fetchChipsRequestRef = useRef<string | null>(null) // Track current request key to prevent duplicate requests
    const hasFetchedChipsRef = useRef<Set<string>>(new Set()) // Track NFTs already requested to prevent duplicates
    const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null)
    
    // ❄️ Star float-in animation: store random starting position and rotation for each chip
    const snowflakeStartPositions = useRef<Map<number, { startX: number; startY: number; rotation: number }>>(new Map())
    // ✨ Cache chips average center position (avoid repeated calculations)
    const chipsCenterRef = useRef<{ x: number; y: number } | null>(null)
    const chipsCenterCacheKeyRef = useRef<string>('') // Used to detect if chips changed
    
    // Test mode state
    const [debugMode, setDebugMode] = useState(false) // Show chips boundaries
    const [testMode, setTestMode] = useState(false) // Use test data (large chips)
    const [zoomLevel, setZoomLevel] = useState(1) // Zoom level
    const [_zoomCenter, setZoomCenter] = useState<{ x: number; y: number } | null>(null) // Zoom center point (reserved feature)

    // Load grayscale base image
    useEffect(() => {
        if (!nft.file_name) {
            setIsLoading(false)
            setError('No file name available')
            return
        }

        // Image path: use IPFS gateway (all images are on IPFS, backend doesn't provide image service)
        // Use unified IPFS configuration
        const fileName = nft.file_name || ''
        console.log('[NFTImageReveal] 📷 Original file_name:', fileName)
        
        // Build IPFS path
        const imagePath = getIPFSImageUrl(fileName)
        console.log('[NFTImageReveal] 📷 Loading image from IPFS:', imagePath)
        
        const img = new Image()
        // Don't use crossOrigin because nftstorage.link gateway doesn't support CORS
        // We will use CSS filter for grayscale effect instead of manipulating pixels in canvas
        
        img.onload = () => {
            console.log('[NFTImageReveal] ✅ Image loaded successfully from IPFS:', imagePath)
            setBaseImage(img)
            setIsLoading(false)
        }
        
        img.onerror = (e) => {
            console.error('[NFTImageReveal] ❌ Failed to load image from IPFS:', imagePath, e)
            console.error('[NFTImageReveal] File name details:', {
                original: nft.file_name,
                processed: fileName,
                fullPath: imagePath
            })
            setError(`loading failed: ${fileName || 'unknown file'}`)
            setIsLoading(false)
        }
        
        img.src = imagePath
    }, [nft.file_name])

    // Effect 1: Get user-owned chips list (single responsibility: only handles API request)
    // Dependencies: only depends on nft_id and address, re-request only when these values change
    useEffect(() => {
        // Responsibility 1: Validate required parameters
        if (!nft.nft_id || !address) {
            if (!nft.nft_id) {
                console.warn(`[NFTImageReveal] No NFT ID, cannot fetch chips`)
            }
            if (!address) {
                console.warn(`[NFTImageReveal] No user address, cannot fetch chips for NFT #${nft.nft_id}`)
            }
            setChips([])
            return
        }

        // Responsibility 2: Generate unique request identifier
        const requestKey = `${nft.nft_id}-${address}`
        
        // Responsibility 3: Duplicate request check (double protection)
        // Protection 1: Check if there's an ongoing request
        if (fetchChipsRequestRef.current === requestKey) {
            console.log(`[NFTImageReveal] ⏭️  Request already in progress: ${requestKey}`)
            return
        }
        
        // Protection 2: Check if already requested (prevent React StrictMode double rendering)
        if (hasFetchedChipsRef.current.has(requestKey)) {
            console.log(`[NFTImageReveal] ⏭️  Already fetched chips for: ${requestKey}`)
            return
        }
        
        // Responsibility 4: Mark request status
        fetchChipsRequestRef.current = requestKey
        hasFetchedChipsRef.current.add(requestKey)
        console.log(`[NFTImageReveal] 🔒 Starting fetch for: ${requestKey}`)
        
        // Responsibility 5: Execute API request
        const fetchChips = async () => {

            try {
                // Use batch API to get chips (includes base64 images)
                const apiUrl = `/api/nft-user-chips-batch`
                const requestStartTime = performance.now()
                console.log(`[NFTImageReveal] 📡 [Effect 1] Batch fetching chips for NFT #${nft.nft_id}, user: ${address}`)
                console.log(`[NFTImageReveal] 📊 [Effect 1] POST ${apiUrl} (Key: ${requestKey})`)
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        nft_id: nft.nft_id,
                        user_address: address
                    })
                })
                if (!response.ok) {
                    const errorText = await response.text()
                    console.error(`[NFTImageReveal] API error ${response.status}:`, errorText)
                    throw new Error(`Failed to fetch chips: ${response.status} ${response.statusText}`)
                }
                const data = await response.json()
                const requestEndTime = performance.now()
                const requestDuration = (requestEndTime - requestStartTime).toFixed(2)
                
                const chipsWithBase64 = data.chips?.filter((c: any) => c.base64).length || 0
                console.log(`[NFTImageReveal] ✅ Batch API Response received in ${requestDuration}ms`)
                console.log(`[NFTImageReveal] 📊 Total API Requests: 1 (batch API) - vs ${data.chips?.length || 0} requests in old method`)
                console.log(`[NFTImageReveal] 📦 Chips received: ${data.chips?.length || 0} (${chipsWithBase64} with base64 images)`)
                
                // Save request start time globally for subsequent performance statistics
                    ; (window as any).__nftBatchApiStartTime = requestStartTime
                console.log(`[NFTImageReveal] API Response for NFT #${nft.nft_id}:`, {
                    chips_count: data.chips?.length || 0,
                    chips_with_base64: data.chips?.filter((c: any) => c.base64).length || 0,
                    sample_chip: data.chips?.[0]
                })
                
                // Diagnostic information (removed unused state)
                
                if (data.chips && Array.isArray(data.chips)) {
                    console.log(`[NFTImageReveal] Found ${data.chips.length} chips from API`)
                    
                    // If API returns empty array, set to empty directly (don't use fallback)
                    if (data.chips.length === 0) {
                        console.log('[NFTImageReveal] API returned empty chips array - user has no chips')
                        setChips([])
                        return
                    }
                    
                    // Show details of first chip
                    console.log('[NFTImageReveal] Sample chip:', data.chips[0])
                    
                    // Validate chips data format
                    const validChips = data.chips.filter((chip: any) => {
                        const hasFile = chip.file_name && typeof chip.file_name === 'string'
                        const hasCoords = !isNaN(chip.x) && !isNaN(chip.y) && !isNaN(chip.w) && !isNaN(chip.h)
                        return hasFile || hasCoords
                    })
                    
                    if (validChips.length === 0) {
                        console.warn('[NFTImageReveal] No valid chips found. Sample chip:', data.chips[0])
                        setChips([]) // Set to empty array, don't use fallback
                        return
                    }
                    
                    console.log(`[NFTImageReveal] Valid chips: ${validChips.length}/${data.chips.length}`)

                    // ✅ Validation: Ensure chips count matches NFT data
                    // If API returned chips count doesn't match owned_chips_count, log warning and truncate
                    if (validChips.length !== nft.owned_chips_count) {
                        console.warn(
                            `[NFTImageReveal] ⚠️ Chips count mismatch! ` +
                            `API returned ${validChips.length} chips, but NFT data shows owned_chips_count=${nft.owned_chips_count}. ` +
                            `Using owned_chips_count as source of truth.`
                        )
                        // Truncate to correct count (take first owned_chips_count items)
                        const correctedChips = validChips.slice(0, nft.owned_chips_count)
                        console.log(`[NFTImageReveal] Corrected chips count: ${correctedChips.length} (from ${validChips.length})`)
                        setChips(correctedChips)
                    } else {
                        // Count matches, set normally
                        setChips(validChips)
                    }
                } else {
                    console.error('[NFTImageReveal] Invalid chips data format:', data)
                    throw new Error('Invalid chips data format')
                }
            } catch (err) {
                console.error('[NFTImageReveal] Failed to fetch chips:', err)
                
                // Test mode: Create large test chips to verify effect
                if (testMode && baseImage) {
                    console.log('[NFTImageReveal] Using test mode - creating test chips')
                    const testChips: Chip[] = []
                    const imgWidth = baseImage.width
                    const imgHeight = baseImage.height
                    
                    // Create 5 large test chips (each occupies 5% of image)
                    const testChipSize = Math.min(imgWidth, imgHeight) * 0.1 // 10% of image size
                    const testCount = Math.min(5, nft.owned_chips_count)
                    
                    for (let i = 0; i < testCount; i++) {
                        const x = (i % 3) * (imgWidth / 3) + imgWidth * 0.1
                        const y = Math.floor(i / 3) * (imgHeight / 3) + imgHeight * 0.1
                        testChips.push({
                            x,
                            y,
                            w: testChipSize,
                            h: testChipSize,
                            tile_x: i
                        })
                    }
                    setChips(testChips)
                    return
                }
                
                // On API call failure, set to empty array (don't use fallback to avoid showing wrong chips)
                console.warn('[NFTImageReveal] API failed, setting chips to empty array (no fallback)')
                setChips([])
                setError(`Failed to load chips: ${err instanceof Error ? err.message : 'Unknown error'}`)
            } finally {
                // Clear ongoing request mark (but keep requested record to prevent duplicates)
                fetchChipsRequestRef.current = null
                console.log(`[NFTImageReveal] 🔓 [Effect 1] Completed fetch for: ${requestKey}`)
            }
        }

        fetchChips()
        
        // Cleanup function: Clear request mark on component unmount (but keep requested record)
        return () => {
            fetchChipsRequestRef.current = null
            // Note: Don't clear hasFetchedChipsRef as it prevents duplicate requests
            // To re-request, trigger by changing nft_id or address
        }
    }, [nft.nft_id, address]) 

    // Effect 2: Use dual-layer canvas for rendering
    // Logic: 1. Bottom canvas: draw full image (converted to grayscale via CSS filter) 2. Top canvas: draw colored chips regions
    useEffect(() => {
        const baseCanvas = canvasRef.current
        const chipsCanvas = chipsCanvasRef.current
        if (!baseCanvas || !chipsCanvas || !baseImage) return

        const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true })
        const chipsCtx = chipsCanvas.getContext('2d', { willReadFrequently: true })
        if (!baseCtx || !chipsCtx) return

        // Set canvas size (maintain aspect ratio)
        const maxWidth = 800 // Maximum display width
        const scale = Math.min(maxWidth / baseImage.width, 1)
        const canvasWidth = baseImage.width * scale
        const canvasHeight = baseImage.height * scale
        
        // Both canvases use the same size
        baseCanvas.width = canvasWidth
        baseCanvas.height = canvasHeight
        chipsCanvas.width = canvasWidth
        chipsCanvas.height = canvasHeight

        // Calculate scale ratio
        const scaleX = canvasWidth / baseImage.width
        const scaleY = canvasHeight / baseImage.height

        // 1. Bottom canvas: draw full image (colored, but converted to grayscale via CSS filter)
        baseCtx.drawImage(baseImage, 0, 0, canvasWidth, canvasHeight)

        // Reset fade-in animation start time
        revealStartTimeRef.current = performance.now()

        // 2. Top canvas: if not all chips collected and not minted, draw colored chips regions
        // After minting (is_mint === 2) show full colored image, no need to draw chips regions
        chipsCtx.clearRect(0, 0, canvasWidth, canvasHeight) // Clear top canvas
        
        // ✅ Ensure only user-owned chips are drawn (use owned_chips_count as source of truth)
        const chipsToRender = chips.slice(0, nft.owned_chips_count)

        // ✅ Performance optimization: check if high-performance mode enabled
        const PERFORMANCE_THRESHOLD = 1000
        const isLowPerformanceMode = chips.length > PERFORMANCE_THRESHOLD

        // ✨ 8-second total duration constant (hoisted to scope top)
        const TOTAL_ANIMATION_TIME = 8000 // Total animation time: 8 seconds
        const STAR_ANIMATION_DURATION = 1500 // Star animation duration: 1500ms (1.5s, faster)
        const MAX_STARS = 30 // Default maximum 30 stars
        const MAX_STARS_LARGE = 100 // Use 100 stars when chip count > 1000
        const LARGE_CHIPS_THRESHOLD = 1000 // Chip count threshold

        // Draw function (can be called repeatedly for fade-in animation)
        // modifying drawChips to accept an optional 'forceShowAll' param for performance mode
        const drawChips = (forceShowAll = false) => {
            // If minted (is_mint === 2), no need to draw chips regions, show full colored image
            if (nft.is_mint === 2) {
                return
            }

            if (!nft.all_chips_owned && chipsToRender.length > 0) {
                // If not high-performance mode, clear and redraw each time (for animation)
                // If high-performance mode and forcing show all, also need to clear
                if (!isLowPerformanceMode || forceShowAll) {
                    chipsCtx.clearRect(0, 0, canvasWidth, canvasHeight)
                }

                // Calculate fade-in progress
                const now = performance.now()
                const revealElapsed = now - revealStartTimeRef.current
                
                // ✨ Limit star count to avoid too many chips causing star density
                // Rule: chips < 30 → show actual count; 30-1000 → 30 stars; > 1000 → 100 stars
                let starCount: number
                if (chipsToRender.length > LARGE_CHIPS_THRESHOLD) {
                    starCount = MAX_STARS_LARGE // 100 stars
                } else {
                    starCount = Math.min(chipsToRender.length, MAX_STARS) // Max 30 stars, or actual count
                }
                
                // Calculate delay: let last star start at (8000 - 1500) = 6500ms
                const chipRevealDelay = starCount > 1 
                    ? (TOTAL_ANIMATION_TIME - STAR_ANIMATION_DURATION) / (starCount - 1)
                    : 0 // If only 1 star, no delay needed

                chipsCtx.globalCompositeOperation = 'source-over'

                // High-performance mode optimization: don't use advanced filters and glow effects
                // But star animation still needs to be drawn, so don't return here
                if (forceShowAll) {
                    chipsCtx.filter = 'none'
                    // Batch draw without any calculations
                    for (let i = 0; i < chipsToRender.length; i++) {
                        const chip = chipsToRender[i]
                        const scaledX = chip.x * scaleX
                        const scaledY = chip.y * scaleY
                        const scaledW = chip.w * scaleX
                        const scaledH = chip.h * scaleY

                        chipsCtx.drawImage(
                            baseImage,
                            chip.x, chip.y, chip.w, chip.h,
                            scaledX, scaledY, scaledW, scaledH
                        )
                    }
                    // ⚠️ Note: Don't return, continue executing star drawing code below
                }

                // ✨ Calculate chips average center position (cache result)
                const chipsCacheKey = `${chipsToRender.length}-${chipsToRender.map(c => `${c.x}-${c.y}`).join(',')}`
                let chipsCenterX = canvasWidth / 2 // Default: image center
                let chipsCenterY = canvasHeight / 2
                
                // If chips exist, calculate average center; otherwise use image center
                if (chipsToRender.length > 0) {
                    // Check if cache is valid
                    if (chipsCenterRef.current && chipsCenterCacheKeyRef.current === chipsCacheKey) {
                        // Use cache
                        chipsCenterX = chipsCenterRef.current.x
                        chipsCenterY = chipsCenterRef.current.y
                    } else {
                        // Calculate average center
                        let sumX = 0
                        let sumY = 0
                        
                        for (const chip of chipsToRender) {
                            // Calculate center position of each chip (in canvas coordinate system)
                            const chipCenterX = chip.x * scaleX + (chip.w * scaleX) / 2
                            const chipCenterY = chip.y * scaleY + (chip.h * scaleY) / 2
                            
                            sumX += chipCenterX
                            sumY += chipCenterY
                        }
                        
                        chipsCenterX = sumX / chipsToRender.length
                        chipsCenterY = sumY / chipsToRender.length
                        
                        // Update cache
                        chipsCenterRef.current = { x: chipsCenterX, y: chipsCenterY }
                        chipsCenterCacheKeyRef.current = chipsCacheKey
                    }
                }

                // ✨ Batch display all chips in color directly, no need for serial fade-in animation
                // Only need to check if should skip when not in high-performance mode and not forcing display (but here we always batch display)
                if (!forceShowAll) {
                    // Batch draw all chips, display colored directly (no fade-in animation)
                    for (let i = 0; i < chipsToRender.length; i++) {
                        const chip = chipsToRender[i]
                        
                    try {
                        const scaledX = chip.x * scaleX
                        const scaledY = chip.y * scaleY
                        const scaledW = chip.w * scaleX
                        const scaledH = chip.h * scaleY
                        
                            chipsCtx.save()

                            // ✅ Remove glow effect to avoid border artifacts
                            // Draw colored chips regions directly (with brightness enhancement, no fade-in animation)
                            chipsCtx.globalAlpha = 1.0 // Fully opaque
                            chipsCtx.filter = `brightness(1.2) saturate(1.3)` // Fixed brightness enhancement

                        chipsCtx.drawImage(
                            baseImage,
                                chip.x, chip.y, chip.w, chip.h,
                                scaledX, scaledY, scaledW, scaledH
                        )

                            chipsCtx.filter = 'none'
                            chipsCtx.globalAlpha = 1.0
                            chipsCtx.restore()
                    } catch (err) {
                            console.warn(`[NFTImageReveal] Failed to light up chip:`, err)
                        }
                    }
                }

                // ❄️ Draw snowflake star effect (float from all sides of NFT image to chips average center)
                // ✨ If no chips, don't render stars (but continue function execution, don't return)
                if (chipsToRender.length > 0) {
                    // ✨ Use previously calculated starCount (max 30), avoid too many chips causing star overlap
                    console.log(`[NFTImageReveal] ⭐ Drawing ${starCount} stars, revealElapsed=${revealElapsed.toFixed(0)}ms, chipsCenter=(${chipsCenterX.toFixed(1)}, ${chipsCenterY.toFixed(1)})`)
                    for (let i = 0; i < starCount; i++) {
                    const chipRevealTime = i * chipRevealDelay
                    const chipRevealProgress = Math.max(0, Math.min(1, (revealElapsed - chipRevealTime) / STAR_ANIMATION_DURATION))

                    // ✨ Adjust fade timing: first 40% fade in, middle 40% hold, last 20% fade out
                    let starAlpha = 0
                    let starProgress = chipRevealProgress // Keep progress variable for later use
                    if (chipRevealProgress <= 0.4) {
                        // First 40%: fade in
                        starAlpha = chipRevealProgress / 0.4
                    } else if (chipRevealProgress <= 0.8) {
                        // Middle 40%: maintain brightest
                        starAlpha = 1.0
        } else {
                        // Last 20%: fade out
                        starAlpha = 1 - (chipRevealProgress - 0.8) / 0.2
                    }

                    if (starAlpha > 0.01) {
                        // Generate fixed random starting position for each star (generate only once)
                        if (!snowflakeStartPositions.current.has(i)) {
                            console.log(`[NFTImageReveal] ⭐ Generating start position for star ${i}`)
                            // Randomly select starting position from all sides of NFT image
                            const side = Math.floor(Math.random() * 4) // 0=top, 1=right, 2=bottom, 3=left
                            let startX, startY
                            
                            switch (side) {
                                case 0: // Top
                                    startX = Math.random() * canvasWidth
                                    startY = -80
                                    break
                                case 1: // Right
                                    startX = canvasWidth + 80
                                    startY = Math.random() * canvasHeight
                                    break
                                case 2: // Bottom
                                    startX = Math.random() * canvasWidth
                                    startY = canvasHeight + 80
                                    break
                                default: // Left
                                    startX = -80
                                    startY = Math.random() * canvasHeight
                            }
                            
                            snowflakeStartPositions.current.set(i, {
                                startX,
                                startY,
                                rotation: Math.random() * Math.PI * 2 // Random initial rotation angle
                            })
        }

                        const startPos = snowflakeStartPositions.current.get(i)!
                        
                        try {
                            chipsCtx.save()
                            
                            // Star size: dynamically adjust based on star count
                            // When 100 stars, reduce to half size, otherwise keep original size
                            const baseStarSize = starCount === MAX_STARS_LARGE ? 0.0125 : 0.025
                            const starSize = Math.min(canvasWidth, canvasHeight) * baseStarSize
                            
                            // Calculate current position (move from start position to chips average center, then disappear)
                            const easeInOut = starProgress < 0.5 
                                ? 2 * starProgress * starProgress 
                                : 1 - Math.pow(-2 * starProgress + 2, 2) / 2
                            const currentX = startPos.startX + (chipsCenterX - startPos.startX) * easeInOut
                            const currentY = startPos.startY + (chipsCenterY - startPos.startY) * easeInOut
                            
                            // Rotation angle (continuous rotation)
                            const currentRotation = startPos.rotation + starProgress * Math.PI * 6 // Rotate 3 times
                            
                            // Cross star light effect (4 beams)
                            // ✨ Draw colored background glow first to make stars visible on any background
                            // Generate different rainbow color for each star (based on index)
                            const hue = (i * 137.508) % 360 // Use golden angle distribution for even color spread
                            const bgGradient = chipsCtx.createRadialGradient(
                                currentX, currentY, 0,
                                currentX, currentY, starSize * 3
                            )
                            bgGradient.addColorStop(0, `hsla(${hue}, 70%, 50%, ${starAlpha * 0.6})`)
                            bgGradient.addColorStop(0.3, `hsla(${hue}, 60%, 40%, ${starAlpha * 0.4})`)
                            bgGradient.addColorStop(0.6, `hsla(${hue}, 50%, 30%, ${starAlpha * 0.2})`)
                            bgGradient.addColorStop(1, `hsla(${hue}, 40%, 20%, 0)`)
                            
                            chipsCtx.fillStyle = bgGradient
                            chipsCtx.beginPath()
                            chipsCtx.arc(currentX, currentY, starSize * 3, 0, Math.PI * 2)
                            chipsCtx.fill()
                            
                            chipsCtx.globalCompositeOperation = 'lighter' // Use additive blend mode to enhance glow
                            
                            // Move and rotate canvas
                            chipsCtx.translate(currentX, currentY)
                            chipsCtx.rotate(currentRotation)
            
                            // 1. Draw cross beams (colored beams)
                            const drawStarBeam = (angle: number, length: number) => {
                                chipsCtx.save()
                                chipsCtx.rotate(angle)
                                
                                // Create colored beam gradient (rainbow)
                                const beamGradient = chipsCtx.createLinearGradient(0, 0, length, 0)
                                beamGradient.addColorStop(0, `hsla(${hue}, 100%, 90%, ${starAlpha})`)
                                beamGradient.addColorStop(0.1, `hsla(${hue}, 95%, 85%, ${starAlpha * 0.95})`)
                                beamGradient.addColorStop(0.3, `hsla(${hue}, 90%, 75%, ${starAlpha * 0.85})`)
                                beamGradient.addColorStop(0.6, `hsla(${hue}, 80%, 65%, ${starAlpha * 0.5})`)
                                beamGradient.addColorStop(1, `hsla(${hue}, 70%, 55%, 0)`)
                                
                                chipsCtx.fillStyle = beamGradient
                                
                                // Draw beam (wider diamond)
                                chipsCtx.beginPath()
                                chipsCtx.moveTo(0, 0)
                                chipsCtx.lineTo(length * 0.3, -starSize * 0.15)
                                chipsCtx.lineTo(length, 0)
                                chipsCtx.lineTo(length * 0.3, starSize * 0.15)
                                chipsCtx.closePath()
                                chipsCtx.fill()
                                
                                chipsCtx.restore()
                            }
                            
                            // Draw 4 beams (cross shape, longer)
                            const beamLength = starSize * 5 // Longer beams
                            drawStarBeam(0, beamLength)                // Right
                            drawStarBeam(Math.PI / 2, beamLength)      // Down
                            drawStarBeam(Math.PI, beamLength)          // Left
                            drawStarBeam(Math.PI * 1.5, beamLength)    // Up
                            
                            // Draw second layer of thinner beams (colored enhancement effect)
                            const drawThinBeam = (angle: number, length: number) => {
                                chipsCtx.save()
                                chipsCtx.rotate(angle)
                                
                                const thinBeamGradient = chipsCtx.createLinearGradient(0, 0, length, 0)
                                thinBeamGradient.addColorStop(0, `hsla(${hue}, 100%, 95%, ${starAlpha * 1.2})`)
                                thinBeamGradient.addColorStop(0.3, `hsla(${hue}, 95%, 85%, ${starAlpha * 0.8})`)
                                thinBeamGradient.addColorStop(1, `hsla(${hue}, 85%, 70%, 0)`)
                                
                                chipsCtx.fillStyle = thinBeamGradient
                                
                                chipsCtx.beginPath()
                                chipsCtx.moveTo(0, 0)
                                chipsCtx.lineTo(length * 0.5, -starSize * 0.05)
                                chipsCtx.lineTo(length, 0)
                                chipsCtx.lineTo(length * 0.5, starSize * 0.05)
                                chipsCtx.closePath()
                                chipsCtx.fill()
                                
                                chipsCtx.restore()
                            }
                            
                            drawThinBeam(0, beamLength * 1.3)
                            drawThinBeam(Math.PI / 2, beamLength * 1.3)
                            drawThinBeam(Math.PI, beamLength * 1.3)
                            drawThinBeam(Math.PI * 1.5, beamLength * 1.3)
                            
                            // 2. Draw center bright core (colored, with pulsing effect)
                            const pulse = 0.95 + Math.sin(revealElapsed / 100 + i * 0.5) * 0.05
                            const coreGradient = chipsCtx.createRadialGradient(
                                0, 0, 0,
                                0, 0, starSize * 1.2 * pulse
                            )
                            coreGradient.addColorStop(0, `hsla(${hue}, 100%, 95%, ${starAlpha})`)
                            coreGradient.addColorStop(0.2, `hsla(${hue}, 95%, 90%, ${starAlpha * 0.95})`)
                            coreGradient.addColorStop(0.4, `hsla(${hue}, 90%, 80%, ${starAlpha * 0.85})`)
                            coreGradient.addColorStop(0.7, `hsla(${hue}, 85%, 70%, ${starAlpha * 0.4})`)
                            coreGradient.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`)
                            
                            chipsCtx.fillStyle = coreGradient
                            chipsCtx.beginPath()
                            chipsCtx.arc(0, 0, starSize * 1.2 * pulse, 0, Math.PI * 2)
                            chipsCtx.fill()
                            
                            // 2.5 Add extra super-bright core (colored strong light)
                            const innerCoreGradient = chipsCtx.createRadialGradient(
                                0, 0, 0,
                                0, 0, starSize * 0.3
                            )
                            innerCoreGradient.addColorStop(0, `hsla(${hue}, 100%, 100%, ${starAlpha})`)
                            innerCoreGradient.addColorStop(0.5, `hsla(${hue}, 100%, 95%, ${starAlpha * 0.8})`)
                            innerCoreGradient.addColorStop(1, `hsla(${hue}, 95%, 85%, 0)`)
                            
                            chipsCtx.fillStyle = innerCoreGradient
                            chipsCtx.beginPath()
                            chipsCtx.arc(0, 0, starSize * 0.3, 0, Math.PI * 2)
                            chipsCtx.fill()
                            
                            // 3. Draw twinkling small star points (colored, surrounding decoration, opposite rotation)
                            if (starAlpha > 0.3) {
                                const sparkleCount = 6
                                for (let s = 0; s < sparkleCount; s++) {
                                    const angle = (s / sparkleCount) * Math.PI * 2 - currentRotation * 0.6 // Reverse rotation
                                    const distance = starSize * (1.4 + Math.sin(revealElapsed / 150 + s) * 0.25)
                                    const sparkleX = Math.cos(angle) * distance
                                    const sparkleY = Math.sin(angle) * distance
                                    const sparkleSize = starSize * 0.15 * (0.6 + Math.sin(revealElapsed / 120 + s * 2) * 0.4)
                                    const sparkleAlpha = starAlpha * (0.6 + Math.sin(revealElapsed / 80 + s * 3) * 0.3)
                                    
                                    // Small stars use complementary or adjacent colors
                                    const sparkleHue = (hue + s * 60) % 360
                                    
                                    const sparkleGradient = chipsCtx.createRadialGradient(
                                        sparkleX, sparkleY, 0,
                                        sparkleX, sparkleY, sparkleSize * 2.5
                                    )
                                    sparkleGradient.addColorStop(0, `hsla(${sparkleHue}, 100%, 90%, ${sparkleAlpha})`)
                                    sparkleGradient.addColorStop(0.4, `hsla(${sparkleHue}, 90%, 80%, ${sparkleAlpha * 0.6})`)
                                    sparkleGradient.addColorStop(1, `hsla(${sparkleHue}, 80%, 70%, 0)`)
                                    
                                    chipsCtx.fillStyle = sparkleGradient
                                    chipsCtx.beginPath()
                                    chipsCtx.arc(sparkleX, sparkleY, sparkleSize * 2.5, 0, Math.PI * 2)
                                    chipsCtx.fill()
                                }
                            }
                            
                            chipsCtx.globalCompositeOperation = 'source-over'
                            chipsCtx.restore()
                        } catch (err) {
                            console.warn(`[NFTImageReveal] Failed to draw snowflake star:`, err)
                        }
                    }
                    } // End of star drawing loop for if (chipsToRender.length > 0)
                }
            }
        }

        // If minted (is_mint === 2), show full colored image, no need to draw chips regions
        if (nft.is_mint === 2) {
            console.log(`[NFTImageReveal] ✅ Minting complete - showing full color image`)
            revealStartTimeRef.current = 0
        } else if (!nft.all_chips_owned && chipsToRender.length > 0) {
            console.log(`[NFTImageReveal] 🔆 Lighting up ${chipsToRender.length} chips (owned: ${nft.owned_chips_count}, total chips: ${chips.length})`)

            // ✅ Performance optimization: if too many chips, draw all chips directly, but still need animation loop to draw stars
            if (isLowPerformanceMode) {
                console.log(`[NFTImageReveal] 🚀 Performance mode: Skipping chips reveal animation for ${chipsToRender.length} chips, but stars will still animate`)

                // Reset fade-in animation start time for star animation
                revealStartTimeRef.current = performance.now()
                
                // Still need animation loop to draw star effects
                const revealAnimate = () => {
                    const now = performance.now()
                    const revealElapsed = now - revealStartTimeRef.current

                    // If all animations completed (8s + 200ms buffer), stop animation
                    if (revealElapsed > TOTAL_ANIMATION_TIME + 200) {
                        return
                    }

                    // In high-performance mode: quickly draw all chips first, then draw star animation
                    drawChips(true) // forceShowAll=true will draw chips and continue executing star code
                    requestAnimationFrame(revealAnimate)
                }

                requestAnimationFrame(revealAnimate)
            } else {
                // ✨ Normal mode: batch display all chips directly, only keep star animation
                // Reset animation start time (for star animation)
                revealStartTimeRef.current = performance.now()

                // Initial draw (chips batch display, star animation)
                drawChips(false)

                // Animation loop (only for star animation, chips already batch displayed)
                const revealAnimate = () => {
                    const now = performance.now()
                    const revealElapsed = now - revealStartTimeRef.current

                    // If all animations completed (8s + 200ms buffer), stop animation
                    if (revealElapsed > TOTAL_ANIMATION_TIME + 200) {
                        return
                    }

                    // Continue drawing (chips stay displayed, stars continue animating)
                    drawChips(false)
                    requestAnimationFrame(revealAnimate)
                }

                requestAnimationFrame(revealAnimate)
            }
        } else {
            console.log(`[NFTImageReveal] ✅ Color base image drawn (all chips owned)`)
            revealStartTimeRef.current = 0
        }
    }, [baseImage, chips, nft.all_chips_owned, nft.is_mint]) // Depends on baseImage, chips, all_chips_owned and is_mint

    // ✅ Effect 3 removed: no longer draw border animation
    // All visual effects (chip lighting + star effects) completed in Effect 2

    // Effect 3 removed: chip drawing merged into Effect 2
    // Now based on chips position info, directly "light up" corresponding region from base image, no need to load separate chip image files

    if (isLoading) {
        return (
            <div className="w-full aspect-square bg-[#2a2b36] rounded-xl flex items-center justify-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="w-full aspect-square bg-[#2a2b36] rounded-xl flex flex-col items-center justify-center text-gray-400 border border-gray-700">
                <svg className="w-16 h-16 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div className="text-xs text-center px-4">
                    <div className="text-gray-300 mb-1">Image loading failed</div>
                    <div className="text-gray-500 text-[10px]">{nft.file_name || 'No filename'}</div>
                </div>
            </div>
        )
    }

    return (
        <div className="relative w-full aspect-square bg-[#1a1b23] rounded-xl border border-gray-800" style={{ overflow: 'hidden' }}>
            <div 
                className="w-full h-full"
                style={{
                    position: 'absolute',
                    inset: 0,
                    overflow: zoomLevel !== 1 ? 'auto' : 'hidden'
                }}
            >
                {/* Bottom canvas: display full image, apply grayscale filter */}
                <canvas
                    ref={canvasRef}
                    style={{ 
                        imageRendering: 'pixelated',
                        display: 'block',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: zoomLevel !== 1 ? `${zoomLevel * 100}%` : '100%',
                        height: zoomLevel !== 1 ? `${zoomLevel * 100}%` : '100%',
                        transition: 'width 0.3s ease, height 0.3s ease',
                        objectFit: 'contain',
                        // ✨ When user hasn't collected all chips and not minted, use multiple filters to achieve "ethereal" effect
                        // After minting (is_mint === 2) show colored original image
                        // When chips incomplete, keep image mysterious (dark + blur) to maintain game feel
                        filter: (!nft.all_chips_owned && nft.is_mint !== 2) 
                            ? (nft.owned_chips_count === 0 
                                ? 'grayscale(100%) blur(12px) brightness(0.4) contrast(0.6)' // Dark + strong blur for 0 chips (mysterious)
                                : 'grayscale(100%) blur(8px) brightness(0.3) contrast(0.5)') // Dark for partial chips
                            : 'none',
                        opacity: (!nft.all_chips_owned && nft.is_mint !== 2) 
                            ? (nft.owned_chips_count === 0 ? 0.25 : 0.15) // Slightly visible for 0 chips, very dark for partial
                            : 1,
                        zIndex: 1
                    }}
                />
                {/* Top canvas: display colored chips regions, no filter applied */}
                <canvas
                    ref={chipsCanvasRef}
                    style={{ 
                        imageRendering: 'pixelated',
                        display: 'block',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: zoomLevel !== 1 ? `${zoomLevel * 100}%` : '100%',
                        height: zoomLevel !== 1 ? `${zoomLevel * 100}%` : '100%',
                        transition: 'width 0.3s ease, height 0.3s ease',
                        objectFit: 'contain',
                        zIndex: 2
                    }}
                />
            </div>
            
            {/* Status information */}
            <div className="absolute top-2 right-2 flex flex-col gap-1">
                <div className="px-2 py-1 rounded-full text-[10px] font-bold bg-black/60 text-white backdrop-blur-md">
                    {nft.owned_chips_count}/{nft.total_chips_count}
                </div>
                {debugMode && (
                    <div className="px-2 py-1 rounded-full text-[10px] font-bold bg-green-500/60 text-white backdrop-blur-md">
                        Debug
                    </div>
                )}
                {testMode && (
                    <div className="px-2 py-1 rounded-full text-[10px] font-bold bg-yellow-500/60 text-white backdrop-blur-md">
                        Test
                    </div>
                )}
            </div>
            
            {/* Debug buttons hidden - not needed in production */}
            {false && (
            <div className="absolute bottom-2 left-2 right-2 flex gap-2 flex-wrap">
                <button
                    onClick={() => setDebugMode(!debugMode)}
                        className={`px-2 py-1 text-xs rounded bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors ${debugMode ? 'ring-2 ring-green-500' : ''
                    }`}
                    title="Show chips boundary boxes"
                >
                    {debugMode ? '✓' : ''} Debug
                </button>
                <button
                    onClick={() => {
                        setTestMode(!testMode)
                        loadedChipsRef.current.clear() // Reset loaded chips
                    }}
                        className={`px-2 py-1 text-xs rounded bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors ${testMode ? 'ring-2 ring-yellow-500' : ''
                    }`}
                    title="Use test data (large chips)"
                >
                    {testMode ? '✓' : ''} Test Mode
                </button>
                <button
                    onClick={() => {
                        const newZoomLevel = zoomLevel === 1 ? 3 : zoomLevel === 3 ? 5 : 1
                        setZoomLevel(newZoomLevel)
                        // Reset zoom center
                        if (newZoomLevel === 1) {
                            setZoomCenter(null)
                        } else if (baseImage) {
                            // Set zoom center to image center (relative to Canvas)
                            const canvas = canvasRef.current
                            if (canvas) {
                                setZoomCenter({ x: canvas.width / 2, y: canvas.height / 2 })
                            }
                        }
                    }}
                    className="px-2 py-1 text-xs rounded bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
                    title="Zoom in"
                >
                    Zoom in {zoomLevel === 1 ? '3x' : zoomLevel === 3 ? '5x' : '1x'}
                </button>
                <button
                    onClick={() => {
                        // Reset loaded chips (reset ref)
                        loadedChipsRef.current.clear()
                        isLoadingRef.current = false
                        hasInitializedRef.current = false
                        // Re-trigger drawing (by triggering useEffect)
                        // Note: grayscale effect implemented via CSS filter, no need for manual conversion
                    }}
                    className="px-2 py-1 text-xs rounded bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
                    title="Relight"
                >
                    Relight
                </button>
                
            </div>
            )}
            
          
           
        </div>
    )
}


