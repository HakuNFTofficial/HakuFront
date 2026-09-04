import { useEffect, useState } from 'react'

import { getIPFSPreviewUrl } from '../config/ipfs'
import {
    resolveNftProfilePreviewSource,
    type NFTImageState,
} from '../nft/imagePolicy'

interface NFTProfileThumbnailProps {
    nft: NFTImageState
    onViewOriginal: () => void
}

export function NFTProfileThumbnail({ nft, onViewOriginal }: NFTProfileThumbnailProps) {
    const source = resolveNftProfilePreviewSource(nft)
    const [failedUrl, setFailedUrl] = useState<string | null>(null)
    let imageUrl: string | null = null
    let missingFields: string[] = []

    if (!source.ok) {
        missingFields = source.missingFields
    } else {
        try {
            imageUrl = getIPFSPreviewUrl(source.fileName)
        } catch {
            missingFields = ['VITE_IPFS_PREVIEW_CID']
        }
    }

    const missingFieldsKey = missingFields.join(',')

    useEffect(() => {
        if (!missingFieldsKey) return

        console.error({
            event: 'nft_profile_thumbnail_source_error',
            nftId: nft.nft_id,
            status: nft.is_mint ?? 0,
            missingFields,
        })
    }, [missingFieldsKey, nft.is_mint, nft.nft_id])

    useEffect(() => {
        setFailedUrl(null)
    }, [imageUrl])

    if (!source.ok || !imageUrl || failedUrl === imageUrl) {
        return (
            <div className="relative aspect-square w-full">
                <div className="flex h-full w-full items-center justify-center bg-gray-800 text-sm text-gray-400">
                    Preview unavailable
                </div>
            </div>
        )
    }

    return (
        <div className="relative aspect-square w-full">
            <button
                type="button"
                aria-label={`View original NFT #${nft.nft_id}`}
                className="block h-full w-full cursor-zoom-in"
                onClick={onViewOriginal}
            >
                <img
                    src={imageUrl}
                    alt={`NFT #${nft.nft_id} thumbnail`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain"
                    onError={() => {
                        console.error({
                            event: 'nft_profile_thumbnail_load_error',
                            nftId: nft.nft_id,
                            status: nft.is_mint ?? 0,
                            imageUrl,
                        })
                        setFailedUrl(imageUrl)
                    }}
                />
            </button>
        </div>
    )
}
