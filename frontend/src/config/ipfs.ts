/**
 * IPFS Configuration
 * Unified IPFS gateway and CID configuration
 * The gateway can be overridden at build time with VITE_IPFS_GATEWAY.
 */

const DEFAULT_IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/'

function normalizeIPFSGateway(gateway: string): string {
    return `${gateway.replace(/\/+$/, '')}/`
}

const IPFS_GATEWAY = normalizeIPFSGateway(
    import.meta.env.VITE_IPFS_GATEWAY || DEFAULT_IPFS_GATEWAY,
)

export const IPFS_CONFIG = {
    // IPFS gateway address with build-time override support
    GATEWAY: IPFS_GATEWAY,

    // Image CID (for grayscale large images in My NFTs area)
    IMAGE_CID: 'QmWEBUGXYwUcbcMtJkyixobY8ajoDrGtdqK25eEF3GaUfb',

    // Metadata CID (for JSON metadata, baseCID in contract)
    METADATA_CID: 'QmeqYrSGKCaKzcLGuJT3N12HFH4ws47Lqbs18hSiuGEZGn',

    // Root CID (if needed)
    ROOT_CID: 'QmUTapwBtwq4fSBFmL7Qz9YVJgJtxZd1QuEi8pjULdCiix',
} as const

/**
 * Build IPFS image URL
 * @param fileName File name (e.g.: 22.png)
 * @returns Complete IPFS HTTP URL
 */
export function getIPFSImageUrl(fileName: string): string {
    return `${IPFS_CONFIG.GATEWAY}${IPFS_CONFIG.IMAGE_CID}/${fileName}`
}

/**
 * Build IPFS metadata URL
 * @param fileName File name (e.g.: 22.json)
 * @returns Complete IPFS HTTP URL
 */
export function getIPFSMetadataUrl(fileName: string): string {
    return `${IPFS_CONFIG.GATEWAY}${IPFS_CONFIG.METADATA_CID}/${fileName}`
}

/**
 * Convert ipfs:// format to HTTP URL
 * @param ipfsUrl ipfs:// format URL
 * @returns HTTP URL
 */
export function convertIPFSToHttp(ipfsUrl: string): string {
    if (ipfsUrl.startsWith('ipfs://')) {
        const ipfsHash = ipfsUrl.replace('ipfs://', '')
        return `${IPFS_CONFIG.GATEWAY}${ipfsHash}`
    }
    return ipfsUrl
}
