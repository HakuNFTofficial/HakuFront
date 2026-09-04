import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'

import { NFTImageReveal } from './NFTImageReveal'
import { useWebSocketEvent, useWebSocketReconnect } from '../providers/WebSocketProvider'
import type { ChipCoordinate } from '../nft/chipOverlay'

interface NFT {
    nft_id: number
    file_name: string | null
    all_chips_owned: boolean
    owned_chips_count: number
    total_chips_count: number
    owned_chips?: ChipCoordinate[]
    is_mint: number
    token_id?: string | null
}

interface NFTListResponse {
    total: number
    page: number
    page_size: number
    total_pages: number
    nfts: NFT[]
}

interface NFTUpdateEvent {
    user_address: string
    nfts: NFT[]
}

interface NFTSectionProps {
    onViewAll?: () => void
}

export function NFTSection({ onViewAll }: NFTSectionProps = {}) {
    const { address } = useAccount()
    const [nfts, setNfts] = useState<NFT[]>([])
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [completedNftId, setCompletedNftId] = useState<number | null>(null)
    const visibleNftsRef = useRef<NFT[]>([])

    useEffect(() => {
        visibleNftsRef.current = nfts
    }, [nfts])

    const fetchNFTSnapshot = useCallback(async (showLoading = true) => {
        if (!address) {
            setNfts([])
            return
        }

        if (showLoading) setIsLoading(true)
        setError(null)

        try {
            const apiUrl = `/api/user-nft-list?user_address=${address}&filter=in_progress&page=${page}&page_size=6&include_chips=true`
            const response = await fetch(apiUrl)
            if (!response.ok) {
                const responseText = await response.text()
                console.error({
                    event: 'swap_incomplete_nft_query_failed',
                    userAddress: address,
                    page,
                    status: response.status,
                    responseText,
                })
                throw new Error(`Failed to load NFT fragments: ${response.status}`)
            }

            const data: NFTListResponse = await response.json()
            const nextTotalPages = Math.max(1, data.total_pages)
            setTotalPages(nextTotalPages)
            setNfts(data.nfts)
            if (page > nextTotalPages) setPage(nextTotalPages)
        } catch (fetchError) {
            console.error('[NFTSection] Failed to load incomplete NFTs:', fetchError)
            setError(fetchError instanceof Error ? fetchError.message : 'Failed to load NFT fragments')
        } finally {
            if (showLoading) setIsLoading(false)
        }
    }, [address, page])

    useEffect(() => {
        void fetchNFTSnapshot()
    }, [fetchNFTSnapshot])

    useWebSocketEvent<NFTUpdateEvent>('NFTUpdate', (nftUpdate) => {
        if (!address || nftUpdate.user_address.toLowerCase() !== address.toLowerCase()) {
            return
        }

        const completed = visibleNftsRef.current.find((current) =>
            nftUpdate.nfts.some((updated) =>
                updated.nft_id === current.nft_id && updated.all_chips_owned,
            ),
        )
        if (completed) setCompletedNftId(completed.nft_id)

        void fetchNFTSnapshot(false)
    }, Boolean(address))

    useWebSocketReconnect(() => {
        void fetchNFTSnapshot(false)
    })

    useEffect(() => {
        setPage(1)
        setCompletedNftId(null)
    }, [address])

    useEffect(() => {
        if (completedNftId === null) return
        const timeout = window.setTimeout(() => setCompletedNftId(null), 8_000)
        return () => window.clearTimeout(timeout)
    }, [completedNftId])

    return (
        <div>
            <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white">
                NFT Fragments
                <button
                    type="button"
                    onClick={onViewAll}
                    className="text-xs font-normal text-blue-400 hover:underline"
                >
                    Profile
                </button>
            </h3>

            {completedNftId !== null && (
                <div className="mb-3 flex items-center justify-between rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-300">
                    <span>NFT #{completedNftId} is complete and ready in Profile.</span>
                    <button type="button" onClick={onViewAll} className="font-medium underline">
                        Open Profile
                    </button>
                </div>
            )}

            {!address ? (
                <div className="py-10 text-center text-gray-500">
                    Please connect your wallet to view NFT fragments
                </div>
            ) : isLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
            ) : error ? (
                <div className="alert alert-error"><span>{error}</span></div>
            ) : nfts.length === 0 ? (
                <div className="py-10 text-center text-gray-500">
                    No incomplete NFT fragments
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        {nfts.map((nft) => (
                            <div
                                key={nft.nft_id}
                                className="overflow-hidden rounded-xl border border-gray-800 bg-[#1a1b23] transition-all hover:border-gray-600"
                            >
                                <NFTImageReveal nft={nft} />
                                <div className="p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-sm font-bold text-white">NFT #{nft.nft_id}</span>
                                        <span className="flex-shrink-0 text-xs text-gray-400">
                                            {nft.owned_chips_count} / {nft.total_chips_count}
                                        </span>
                                    </div>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-700">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-blue-400 to-purple-500"
                                            style={{
                                                width: `${(nft.owned_chips_count / nft.total_chips_count) * 100}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <nav aria-label="NFT card pagination" className="mt-4 flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                                disabled={page === 1}
                                className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Previous
                            </button>
                            <span className="min-w-16 text-center text-xs text-gray-400">{page} / {totalPages}</span>
                            <button
                                type="button"
                                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                                disabled={page === totalPages}
                                className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Next
                            </button>
                        </nav>
                    )}
                </>
            )}
        </div>
    )
}
