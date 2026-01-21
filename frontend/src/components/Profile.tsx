import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { NFTImageStatic } from './NFTImageStatic'

// Chip coordinate structure from backend
interface Chip {
    x: number  // X coordinate in pixels
    y: number  // Y coordinate in pixels
    w: number  // Width in pixels
    h: number  // Height in pixels
}

// NFT data type from backend API
interface NFT {
    nft_id: number
    file_name: string | null
    all_chips_owned: boolean
    owned_chips_count: number
    total_chips_count: number
    owned_chips?: Chip[]  // Array of owned chips with x,y,w,h coordinates
    is_mint: number // 0: not minted, 1: minted, 2: burned
    token_id?: string | null
}

interface NFTListResponse {
    total: number
    page: number
    page_size: number
    total_pages: number
    nfts: NFT[]
}

type FilterType = 'all' | 'burned' | 'minted'

export function Profile() {
    const { address } = useAccount()
    const [filter, setFilter] = useState<FilterType>('all')
    const [page, setPage] = useState(1)
    const [nftData, setNftData] = useState<NFTListResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (!address) return

        const fetchNFTs = async () => {
            setIsLoading(true)
            try {
                const url = `/api/user-nft-list?user_address=${address}&page=${page}&page_size=20`
                console.log('[Profile] Fetching NFTs:', url)
                
                const response = await fetch(url)
                if (response.ok) {
                    const data = await response.json()
                    console.log('[Profile] NFT data received:', data)
                    
                    // Note: Backend should return owned_chips array for each NFT
                    // Example: { nft_id: 258, owned_chips: [1, 5, 10, 23, ...], total_chips_count: 100 }
                    // If owned_chips is not provided, the component will show grayscale only
                    
                    setNftData(data)
                } else {
                    console.error('[Profile] Failed to fetch NFTs:', response.status)
                }
            } catch (error) {
                console.error('[Profile] Failed to fetch NFTs:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchNFTs()
    }, [address, page])

    // Filter NFTs based on selected filter
    const filteredNFTs = nftData?.nfts.filter((nft) => {
        if (filter === 'all') return true
        if (filter === 'burned') return nft.is_mint === 2
        if (filter === 'minted') {
            // Mintable: is_mint === 1 OR (is_mint === 0 AND owned_chips_count === total_chips_count)
            return nft.is_mint === 1 || (nft.is_mint === 0 && nft.owned_chips_count === nft.total_chips_count)
        }
        return true
    }) || []

    // Get filter counts
    const allCount = nftData?.total || 0
    const burnedCount = nftData?.nfts.filter(n => n.is_mint === 2).length || 0
    const mintedCount = nftData?.nfts.filter(n => 
        n.is_mint === 1 || (n.is_mint === 0 && n.owned_chips_count === n.total_chips_count)
    ).length || 0

    // Get NFT status label and color
    const getNFTStatus = (nft: NFT): { label: string; color: string } => {
        if (nft.is_mint === 2) {
            return { label: 'Burnable', color: 'bg-red-500/20 text-red-400 border-red-500/50' }
        }
        if (nft.is_mint === 1) {
            return { label: 'Mintable', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' }
        }
        if (nft.owned_chips_count === nft.total_chips_count) {
            return { label: 'Mintable', color: 'bg-green-500/20 text-green-400 border-green-500/50' }
        }
        return { label: 'In Progress', color: 'bg-gray-500/20 text-gray-400 border-gray-500/50' }
    }

    if (!address) {
        return (
            <div className="text-center py-20">
                <p className="text-gray-400">Please connect your wallet to view NFTs</p>
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto">
            {/* Filter Buttons */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                        filter === 'all'
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                            : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50'
                    }`}
                >
                    All ({allCount})
                </button>
                <button
                    onClick={() => setFilter('burned')}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                        filter === 'burned'
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                            : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50'
                    }`}
                >
                    Burnable ({burnedCount})
                </button>
                <button
                    onClick={() => setFilter('minted')}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                        filter === 'minted'
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                            : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50'
                    }`}
                >
                    Mintable ({mintedCount})
                </button>
            </div>

            {/* NFT Grid */}
            {isLoading ? (
                <div className="flex justify-center py-20">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
            ) : filteredNFTs.length > 0 ? (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 max-w-4xl mx-auto">
                        {filteredNFTs.map((nft) => {
                            const status = getNFTStatus(nft)

                            return (
                                <div
                                    key={nft.nft_id}
                                    className="bg-[#1a1b23] rounded-lg md:rounded-xl border border-gray-700/50 overflow-hidden hover:border-blue-500/50 transition-all group"
                                >
                                    {/* NFT Image with Grayscale + Colored Chips */}
                                    <div className="relative aspect-square bg-gray-800">
                                        <NFTImageStatic
                                            nftId={nft.nft_id}
                                            fileName={nft.file_name}
                                            ownedChips={nft.owned_chips || []}
                                            ownedChipsCount={nft.owned_chips_count}
                                            totalChips={nft.total_chips_count}
                                            isMint={nft.is_mint}
                                            allChipsOwned={nft.all_chips_owned}
                                            className="w-full h-full object-contain"
                                        />
                                        
                                        {/* Status Badge - Top Left */}
                                        <div className="absolute top-2 left-2 z-10">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-md border backdrop-blur-sm ${status.color}`}>
                                                {status.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* NFT Info */}
                                    <div className="p-2 md:p-4">
                                        <div className="flex items-center justify-between mb-1.5 md:mb-2">
                                            <h3 className="text-sm md:text-lg font-bold text-white">
                                                NFT #{nft.nft_id}
                                            </h3>
                                            {nft.token_id && (
                                                <span className="text-[10px] md:text-xs text-yellow-400 font-mono">
                                                    Token #{nft.token_id}
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Status-based display */}
                                        {nft.is_mint === 2 ? (
                                            // Burnable: No need to show anything (Token ID already shown above)
                                            null
                                        ) : nft.owned_chips_count === nft.total_chips_count ? (
                                            // Mintable: Show "Ready to Mint"
                                            <div className="flex items-center justify-center py-2">
                                                <span className="text-xs md:text-sm text-green-400 font-medium">
                                                    ✨ Ready to Mint
                                                </span>
                                            </div>
                                        ) : (
                                            // In Progress: Show Chip Progress
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-xs md:text-sm">
                                                    <span className="text-gray-400">Chip Progress</span>
                                                    <span className="font-medium text-gray-300">
                                                        {nft.owned_chips_count} / {nft.total_chips_count}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-700 rounded-full h-1 md:h-2 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all bg-gradient-to-r from-blue-400 to-purple-500"
                                                        style={{
                                                            width: `${(nft.owned_chips_count / nft.total_chips_count) * 100}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Pagination */}
                    {nftData && nftData.total_pages > 1 && (
                        <div className="flex justify-center items-center gap-4 mt-8">
                            <button
                                onClick={() => setPage(page - 1)}
                                disabled={page === 1}
                                className="btn btn-outline btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-gray-400">
                                Page {nftData.page} of {nftData.total_pages}
                            </span>
                            <button
                                onClick={() => setPage(page + 1)}
                                disabled={page >= nftData.total_pages}
                                className="btn btn-outline btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-20">
                    <div className="text-6xl mb-4">🎨</div>
                    <p className="text-xl text-gray-400 mb-2">No NFTs found</p>
                    <p className="text-sm text-gray-500">
                        Address: {address?.slice(0, 6)}...{address?.slice(-4)}
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                        Check browser console for API response details
                    </p>
                </div>
            )}
        </div>
    )
}
