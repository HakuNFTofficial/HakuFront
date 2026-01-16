import { useEffect, useState, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'

interface MintedNFT {
    nft_id: number
    token_id: string | null
    token_url: string | null
    image_url?: string | null  
}

interface LatestMintedNFTsEvent {
    total: number
    nfts: MintedNFT[]
}


import { IPFS_CONFIG, convertIPFSToHttp } from '../config/ipfs'


const IPFS_GATEWAY = IPFS_CONFIG.GATEWAY
const IPFS_IMAGE_CID = IPFS_CONFIG.IMAGE_CID
const IPFS_JSON_CID = IPFS_CONFIG.METADATA_CID


function formatTokenId(tokenId: string | null): string {
    if (!tokenId) return '#?'
    return `#${tokenId}`
}


function processImageUrl(imageUrl: string | null | undefined): string | undefined {
    if (!imageUrl) return undefined

    
    void IPFS_IMAGE_CID
    void IPFS_JSON_CID

  
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl
    }

   
    if (imageUrl.startsWith('ipfs://')) {
        return convertIPFSToHttp(imageUrl)
    }

   
    return `${IPFS_GATEWAY}${imageUrl}`
}

export function Banner() {
    const [mintedNFTs, setMintedNFTs] = useState<MintedNFT[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [newNFTId, setNewNFTId] = useState<number | null>(null) 
    const hasRequestedInitialDataRef = useRef<boolean>(false) 

   
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = window.location.host
    const { status: wsStatus } = useWebSocket({
        url: `${wsProtocol}//${wsHost}/ws`,
        enabled: true,
        onMessage: (message: any) => {
           
            if (message.type === 'LatestMintedNFTs' && message.data) {
                const event: LatestMintedNFTsEvent = message.data
                console.log('[Banner] 📦 Received LatestMintedNFTs via WebSocket:', event)
                
               
                const processedNfts = event.nfts.map(nft => ({
                    ...nft,
                    image_url: processImageUrl(nft.image_url)
                }))

               
                const previousFirstId = mintedNFTs.length > 0 ? mintedNFTs[0]?.nft_id : null
                const newFirstId = processedNfts.length > 0 ? processedNfts[0]?.nft_id : null
                
                if (newFirstId !== null && newFirstId !== previousFirstId) {
                   
                    console.log('[Banner] ✨ New NFT detected:', newFirstId)
                    setNewNFTId(newFirstId)
                    
                    setTimeout(() => {
                        setNewNFTId(null)
                    }, 1500)
                }

                setMintedNFTs(processedNfts)
                setIsLoading(false)
            }
        },
        onError: () => {
            // Silently handle WebSocket errors (backend may be offline)
            if (import.meta.env.DEV) {
                console.warn('[Banner] WebSocket unavailable (backend offline)')
            }
            setIsLoading(false)
        },
    })

    // After WebSocket connection succeeds, actively request initial data once (only on first connection)
    useEffect(() => {
        // Only request when WebSocket is connected and initial data hasn't been requested yet
        if (wsStatus === 'connected' && !hasRequestedInitialDataRef.current) {
            hasRequestedInitialDataRef.current = true

            const fetchInitialNFTs = async () => {
                setIsLoading(true)
                try {
                    const response = await fetch('/api/query-minted-nfts-for-limit')
                    if (!response.ok) {
                        throw new Error(`Failed to fetch minted NFTs: ${response.status}`)
                    }
                    const data: LatestMintedNFTsEvent = await response.json()
                    const nfts = data.nfts || []

                    // Process image URLs
                    const processedNfts = nfts.map(nft => ({
                        ...nft,
                        image_url: processImageUrl(nft.image_url)
                    }))

                    // ✨ On initial load, if there are NFTs, show spring effect on the first one
                    if (processedNfts.length > 0) {
                        const firstNftId = processedNfts[0].nft_id
                        console.log('[Banner] ✨ Initial load: Triggering spring animation for first NFT:', firstNftId)
                        setNewNFTId(firstNftId)
                        // Clear animation effect after 1.5 seconds (animation duration shortened)
                        setTimeout(() => {
                            setNewNFTId(null)
                        }, 1500)
                    }

                    setMintedNFTs(processedNfts)
                } catch (err) {
                    console.error('[Banner] Failed to fetch initial NFTs:', err)
                    setMintedNFTs([])
                } finally {
                    setIsLoading(false)
                }
            }

            fetchInitialNFTs()
        }
    }, [wsStatus])

    // If no data, don't display banner
    if (!isLoading && mintedNFTs.length === 0) {
        return null
    }

    // If loading, show loading skeleton (optional, or can return null)
    if (isLoading) {
        return null // Or can return a loading skeleton
    }

    // ✅ Fixed display of the latest 10 NFTs (left to right), no more scrolling
    // Only take the first 10 (backend already limits to 10)
    const displayNFTs = mintedNFTs.slice(0, 10)

    return (
        <div className="w-full bg-[#1a1b23] border-gray-800 border-b overflow-hidden py-3 mb-4">
            <div className="flex whitespace-nowrap gap-4 items-center overflow-x-auto no-scrollbar">
                {displayNFTs.map((nft, i) => {
                    const isNewNFT = newNFTId !== null && nft.nft_id === newNFTId
                    // Debug log
                    if (isNewNFT) {
                        console.log('[Banner] 🎯 Rendering NFT with spring animation:', nft.nft_id, 'newNFTId:', newNFTId)
                    }
                    return (
                        <div
                            key={`${nft.nft_id}-${i}`}
                            className={`flex items-center gap-3 px-4 py-2 rounded-lg min-w-[240px] border shadow-md transition-all duration-300 ${
                                isNewNFT
                                    ? 'bg-yellow-400 border-yellow-500 animate-bounce-spring'
                                    : 'bg-[#20212d] border-gray-700/50'
                            }`}
                            style={isNewNFT ? { 
                                animation: 'bounce-spring 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                                willChange: 'transform'
                            } : {}}
                        >
                            <img
                                src={nft.image_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMzc0MTUxIi8+PHRleHQgeD0iNTA%2BIHk9IjUwJSIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5GVDwvdGV4dD48L3N2Zz4='}
                                alt={`NFT ${formatTokenId(nft.token_id)}`}
                                className="w-10 h-10 rounded-md object-cover bg-gray-700 flex-shrink-0"
                                loading="lazy"
                                onError={(e) => {
                                    // If image load fails, use placeholder
                                    const target = e.target as HTMLImageElement
                                    if (import.meta.env.DEV) {
                                        console.warn('[Banner] Image load failed for NFT:', nft.nft_id)
                                    }
                                    // Avoid infinite loop: only replace if not already a placeholder
                                    if (!target.src.includes('data:image/svg+xml')) {
                                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMzc0MTUxIi8+PHRleHQgeD0iNTA%2BIHk9IjUwJSIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5GVDwvdGV4dD48L3N2Zz4='
                                    }
                                }}
                            />
                            <div className="flex flex-col justify-center">
                                <span className={`font-mono text-sm font-bold ${
                                    isNewNFT ? 'text-gray-900' : 'text-gray-300'
                                }`}>
                                    {formatTokenId(nft.token_id)}
                                </span>
                                <span className={`text-xs ${
                                    isNewNFT ? 'text-gray-700' : 'text-gray-500'
                                }`}>
                                    just minted
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
            <style>{`
                /* Hide scrollbar */
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                
               
                @keyframes bounce-spring {
                    0%, 100% { 
                        transform: translateX(0) scale(1) rotate(0deg); 
                    }
                    5% { 
                        transform: translateX(-20px) scale(1.15) rotate(-5deg); 
                    }
                    10% { 
                        transform: translateX(20px) scale(1.15) rotate(5deg); 
                    }
                    15% { 
                        transform: translateX(-18px) scale(1.12) rotate(-4deg); 
                    }
                    20% { 
                        transform: translateX(18px) scale(1.12) rotate(4deg); 
                    }
                    25% { 
                        transform: translateX(-15px) scale(1.1) rotate(-3deg); 
                    }
                    30% { 
                        transform: translateX(15px) scale(1.1) rotate(3deg); 
                    }
                    35% { 
                        transform: translateX(-12px) scale(1.08) rotate(-2deg); 
                    }
                    40% { 
                        transform: translateX(12px) scale(1.08) rotate(2deg); 
                    }
                    45% { 
                        transform: translateX(-9px) scale(1.05) rotate(-1deg); 
                    }
                    50% { 
                        transform: translateX(9px) scale(1.05) rotate(1deg); 
                    }
                    55% { 
                        transform: translateX(-6px) scale(1.03) rotate(-0.5deg); 
                    }
                    60% { 
                        transform: translateX(6px) scale(1.03) rotate(0.5deg); 
                    }
                    65% { 
                        transform: translateX(-4px) scale(1.02) rotate(-0.3deg); 
                    }
                    70% { 
                        transform: translateX(4px) scale(1.02) rotate(0.3deg); 
                    }
                    75% { 
                        transform: translateX(-2px) scale(1.01) rotate(-0.2deg); 
                    }
                    80% { 
                        transform: translateX(2px) scale(1.01) rotate(0.2deg); 
                    }
                    85% { 
                        transform: translateX(-1px) scale(1) rotate(-0.1deg); 
                    }
                    90% { 
                        transform: translateX(1px) scale(1) rotate(0.1deg); 
                    }
                    95% { 
                        transform: translateX(0) scale(1) rotate(0deg); 
                    }
                }
                .animate-bounce-spring {
                    animation: bounce-spring 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                    animation-fill-mode: both;
                }
            `}</style>
        </div>
    )
}
