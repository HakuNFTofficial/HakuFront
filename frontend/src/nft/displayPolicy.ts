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
