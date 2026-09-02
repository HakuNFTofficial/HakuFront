export interface NFTDisplayState {
    all_chips_owned: boolean
    owned_chips_count: number
    total_chips_count: number
    is_mint?: number
}

export const NFT_PREVIEW_LIMIT = 6

export function needsChipCoordinates(nft: NFTDisplayState): boolean {
    return (
        nft.is_mint !== 2 &&
        !nft.all_chips_owned &&
        nft.owned_chips_count > 0 &&
        nft.owned_chips_count < nft.total_chips_count
    )
}
