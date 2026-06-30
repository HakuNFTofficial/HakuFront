import { useEffect, useState, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'

interface MintedNFT {
 nft_id: number
 file_name?: string | null
 token_id: string | null
 token_url: string | null
    image_url?: string | null  
}

interface LatestMintedNFTsEvent {
 total: number
  nfts: MintedNFT[]
}


import { IPFS_CONFIG, convertIPFSToHttp, getIPFSImageUrl } from '../config/ipfs'


const IPFS_GATEWAY = IPFS_CONFIG.GATEWAY
const IPFS_IMAGE_CID = IPFS_CONFIG.IMAGE_CID
const IPFS_JSON_CID = IPFS_CONFIG.METADATA_CID
const NFT_PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Crect%20width%3D%2240%22%20height%3D%2240%22%20fill%3D%22%23374151%22/%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20font-size%3D%2212%22%20font-family%3D%22Arial%22%20fill%3D%22%239CA3AF%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%3ENFT%3C/text%3E%3C/svg%3E'


function formatTokenId(tokenId: string | null): string {
 if (!tokenId) return '#?'
 return `#${tokenId}`
}


function processImageUrl(imageUrl: string | null | undefined, fileName?: string | null): string | undefined {
 if (!imageUrl && fileName) return getIPFSImageUrl(fileName)
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
 image_url: processImageUrl(nft.image_url, nft.file_name)
 }))

               
                const previousFirstId = mintedNFTs.length > 0 ? mintedNFTs[0]?.nft_id : null
                const newFirstId = processedNfts.length > 0 ? processedNfts[0]?.nft_id : null
                
                if (newFirstId !== null && newFirstId !== previousFirstId) {
                   
                    console.log('[Banner] ✨ New NFT detected:', newFirstId)
                    setNewNFTId(newFirstId)
                    
                    setTimeout(() => {
                        setNewNFTId(null)
                    }, 5500)  // 2.5s * 2 times + 0.5s buffer = 5.5s
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
 image_url: processImageUrl(nft.image_url, nft.file_name)
 }))

                    // ✨ On initial load, if there are NFTs, show spring effect on the first one
 if (processedNfts.length > 0) {
 const firstNftId = processedNfts[0].nft_id
                        console.log('[Banner] ✨ Initial load: Triggering spring animation for first NFT:', firstNftId)
                        setNewNFTId(firstNftId)
                        // Clear animation effect after 5.5 seconds (animation duration: 2.5s * 2 times + buffer)
                        setTimeout(() => {
                            setNewNFTId(null)
                        }, 5500)  // 2.5s * 2 times + 0.5s buffer = 5.5s
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
        <div className="w-full bg-[#1a1b23] border-gray-800 border-b overflow-hidden py-3">
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
                                animation: 'bounce-spring 2.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) 2',  // Bounce animation (2.5s * 2 times)
                                willChange: 'transform'
                            } : {}}
 >
                            <img
                                src={nft.image_url || NFT_PLACEHOLDER_IMAGE}
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
                                        target.src = NFT_PLACEHOLDER_IMAGE
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
                        transform: translateX(-35px) scale(1.25) rotate(-8deg); 
                    }
                    10% { 
                        transform: translateX(35px) scale(1.25) rotate(8deg); 
                    }
                    15% { 
                        transform: translateX(-30px) scale(1.2) rotate(-6deg); 
                    }
                    20% { 
                        transform: translateX(30px) scale(1.2) rotate(6deg); 
                    }
                    25% { 
                        transform: translateX(-25px) scale(1.15) rotate(-5deg); 
                    }
                    30% { 
                        transform: translateX(25px) scale(1.15) rotate(5deg); 
                    }
                    35% { 
                        transform: translateX(-20px) scale(1.12) rotate(-4deg); 
                    }
                    40% { 
                        transform: translateX(20px) scale(1.12) rotate(4deg); 
                    }
                    45% { 
                        transform: translateX(-15px) scale(1.08) rotate(-3deg); 
                    }
                    50% { 
                        transform: translateX(15px) scale(1.08) rotate(3deg); 
                    }
                    55% { 
                        transform: translateX(-10px) scale(1.05) rotate(-2deg); 
                    }
                    60% { 
                        transform: translateX(10px) scale(1.05) rotate(2deg); 
                    }
                    65% { 
                        transform: translateX(-6px) scale(1.03) rotate(-1deg); 
                    }
                    70% { 
                        transform: translateX(6px) scale(1.03) rotate(1deg); 
                    }
                    75% { 
                        transform: translateX(-3px) scale(1.02) rotate(-0.5deg); 
                    }
                    80% { 
                        transform: translateX(3px) scale(1.02) rotate(0.5deg); 
                    }
                    85% { 
                        transform: translateX(-1px) scale(1.01) rotate(-0.2deg); 
                    }
                    90% { 
                        transform: translateX(1px) scale(1.01) rotate(0.2deg); 
                    }
                    95% { 
                        transform: translateX(0) scale(1) rotate(0deg); 
                    }
 }
                .animate-bounce-spring {
                    animation: bounce-spring 2.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) 2;  /* Bounce animation (2.5s * 2 times = 5s total) */
                    animation-fill-mode: both;
                }
 `}</style>
 </div>
)
}
