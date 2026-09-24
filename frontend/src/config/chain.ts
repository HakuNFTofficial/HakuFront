/**
 * Chain Configuration
 * Defines supported chain IDs and network information for the application
 */

export const ARC_MAINNET = {
    id: 5042,
    name: 'Arc',
    nativeCurrency: {
        decimals: 18,
        name: 'USDC',
        symbol: 'USDC',
    },
    rpcUrls: ['https://rpc.mainnet.arc.io'],
    explorerUrl: 'https://explorer.arc.io',
} as const

// Required chain ID for all production wallet transactions.
export const REQUIRED_CHAIN_ID = ARC_MAINNET.id

// Mapping of chain IDs to network names
export const CHAIN_NAMES: Record<number, string> = {
    1: 'Ethereum Mainnet',
    5: 'Goerli',
    11155111: 'Sepolia',
    [ARC_MAINNET.id]: ARC_MAINNET.name,
    5042002: 'Arc Testnet',
}

// Get chain name (returns default format if not found)
export function getChainName(chainId: number | undefined | null): string {
    if (!chainId) return 'Unknown'
    return CHAIN_NAMES[chainId] || `Chain ${chainId}`
}
