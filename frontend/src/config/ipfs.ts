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
    IMAGE_CID: 'QmWALFJVacNc1EpMKdxMuCedDVcNwmWoc3L2jqX8erAb6L',

    // Metadata CID (for JSON metadata, baseCID in contract)
    METADATA_CID: 'Qmeub98s5ZPPANZVksF8Vs6CbPT3Xe5PEmkFEhgMP9ovzK',

    // Root CID (if needed)
    ROOT_CID: 'QmUCmfy48PsvUQBEHxeqPZTzQabFDY8U1CkT4ZFQN1pSQH',
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
 * Build an IPFS URL for a generated lightweight NFT silhouette.
 * The preview collection is a release artifact and must be configured explicitly.
 */
export function getIPFSPreviewUrl(fileName: string): string {
    const previewCID = import.meta.env.VITE_IPFS_PREVIEW_CID?.trim() || ''
    if (!previewCID) {
        throw new Error('Missing required VITE_IPFS_PREVIEW_CID')
    }

    return `${IPFS_CONFIG.GATEWAY}${previewCID}/${fileName}`
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

    try {
        const url = new URL(ipfsUrl)
        const ipfsPathMarker = '/ipfs/'
        const ipfsPathIndex = url.pathname.indexOf(ipfsPathMarker)

        if (ipfsPathIndex !== -1) {
            const ipfsPath = url.pathname.slice(
                ipfsPathIndex + ipfsPathMarker.length,
            )

            if (ipfsPath) {
                return `${IPFS_CONFIG.GATEWAY}${ipfsPath}${url.search}${url.hash}`
            }
        }
    } catch {
        // Preserve non-URL values so callers can handle them as before.
    }

    return ipfsUrl
}
