import { useEffect, useState } from 'react'

import { getIPFSImageUrl, getIPFSPreviewUrl } from '../config/ipfs'
import {
    canViewNftOriginal,
    resolveNftImageSource,
    type NFTImageState,
} from '../nft/imagePolicy'
import type { ChipCoordinate } from '../nft/chipOverlay'
import { NFTChipOverlay } from './NFTChipOverlay'

interface NFTImageRevealProps {
    nft: NFTImageState & {
        all_chips_owned: boolean
        owned_chips_count: number
        total_chips_count: number
        owned_chips?: ChipCoordinate[]
    }
    onViewOriginal?: () => void
}

export function NFTImageReveal({ nft, onViewOriginal }: NFTImageRevealProps) {
    const squareMediaClassName = 'relative aspect-square w-full'
    const [failedUrl, setFailedUrl] = useState<string | null>(null)
    const [loadedPreview, setLoadedPreview] = useState<HTMLImageElement | null>(null)
    const source = resolveNftImageSource(nft)
    let imageUrl: string | null = null
    let missingFields: string[] = []

    if (!source.ok) {
        missingFields = source.missingFields
    } else {
        try {
            imageUrl = source.kind === 'preview'
                ? getIPFSPreviewUrl(source.fileName)
                : getIPFSImageUrl(source.fileName)
        } catch {
            missingFields = ['VITE_IPFS_PREVIEW_CID']
        }
    }

    const missingFieldsKey = missingFields.join(',')

    useEffect(() => {
        if (!missingFieldsKey) return

        console.error({
            event: 'nft_image_source_error',
            nftId: nft.nft_id,
            status: nft.is_mint ?? 0,
            missingFields,
        })
    }, [missingFieldsKey, nft.is_mint, nft.nft_id])

    useEffect(() => {
        setFailedUrl(null)
        setLoadedPreview(null)
    }, [imageUrl])

    if (!source.ok || !imageUrl || failedUrl === imageUrl) {
        const label = source.ok && source.kind === 'original'
            ? 'Image unavailable'
            : 'Preview unavailable'

        return (
            <div className={squareMediaClassName}>
                <div className="flex h-full w-full items-center justify-center bg-gray-800 text-sm text-gray-400">
                    {label}
                </div>
            </div>
        )
    }

    const handleImageError = () => {
        console.error({
            event: 'nft_image_load_error',
            nftId: nft.nft_id,
            status: nft.is_mint ?? 0,
            sourceKind: source.kind,
            imageUrl,
        })
        setFailedUrl(imageUrl)
    }

    const isPreview = source.kind === 'preview'
    const image = (
        <img
            src={imageUrl}
            alt={isPreview
                ? `NFT #${nft.nft_id} silhouette`
                : `NFT #${nft.nft_id}`}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-contain ${isPreview ? 'nft-preview-shadow' : ''}`}
            onLoad={(event) => {
                if (isPreview) setLoadedPreview(event.currentTarget)
            }}
            onError={handleImageError}
        />
    )

    const preview = isPreview ? (
        <div className="relative h-full w-full overflow-hidden bg-[#171922]">
            {image}
            {loadedPreview && (
                <NFTChipOverlay
                    image={loadedPreview}
                    nftId={nft.nft_id}
                    expectedCount={nft.owned_chips_count}
                    chips={nft.owned_chips ?? []}
                />
            )}
        </div>
    ) : image

    const content = source.kind === 'original'
        && onViewOriginal
        && canViewNftOriginal(nft) ? (
        <button
            type="button"
            aria-label={`View original NFT #${nft.nft_id}`}
            className="block h-full w-full cursor-zoom-in"
            onClick={onViewOriginal}
        >
            {image}
        </button>
    ) : (
        <div className="h-full w-full">{preview}</div>
    )

    return (
        <div className={squareMediaClassName}>
            {content}
        </div>
    )
}
