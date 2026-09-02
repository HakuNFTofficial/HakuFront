export interface NFTDisplayState {
    all_chips_owned: boolean
    owned_chips_count: number
    total_chips_count: number
    is_mint?: number
}

export const NFT_PREVIEW_LIMIT = 6

export interface NftPage<T> {
    items: T[]
    currentPage: number
    totalPages: number
}

export function getNftPage<T>(
    items: T[],
    requestedPage: number,
    pageSize = NFT_PREVIEW_LIMIT,
): NftPage<T> {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
    const currentPage = Math.min(Math.max(1, requestedPage), totalPages)
    const start = (currentPage - 1) * pageSize

    return {
        items: items.slice(start, start + pageSize),
        currentPage,
        totalPages,
    }
}

export function needsChipCoordinates(nft: NFTDisplayState): boolean {
    return (
        nft.is_mint !== 2 &&
        !nft.all_chips_owned &&
        nft.owned_chips_count > 0 &&
        nft.owned_chips_count < nft.total_chips_count
    )
}
