export interface NFTImageState {
    nft_id: number
    file_name: string | null
    is_mint?: number
}

export type NFTImageSource =
    | { ok: true; kind: 'preview' | 'original'; fileName: string }
    | {
        ok: false
        code: 'NFT_IMAGE_SOURCE_MISSING'
        nftId: number
        status: number
        missingFields: ['file_name']
    }

function previewFileName(fileName: string): string {
    const finalSlash = fileName.lastIndexOf('/')
    const finalDot = fileName.lastIndexOf('.')
    const stem = finalDot > finalSlash ? fileName.slice(0, finalDot) : fileName

    return `${stem}.webp`
}

export function resolveNftImageSource(nft: NFTImageState): NFTImageSource {
    if (!nft.file_name?.trim()) {
        return {
            ok: false,
            code: 'NFT_IMAGE_SOURCE_MISSING',
            nftId: nft.nft_id,
            status: nft.is_mint ?? 0,
            missingFields: ['file_name'],
        }
    }

    return nft.is_mint === 2
        ? { ok: true, kind: 'original', fileName: nft.file_name }
        : { ok: true, kind: 'preview', fileName: previewFileName(nft.file_name) }
}

export function canViewNftOriginal(nft: NFTImageState): boolean {
    return nft.is_mint === 2 && Boolean(nft.file_name?.trim())
}
