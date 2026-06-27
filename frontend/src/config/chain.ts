/**
 * Chain Configuration
 * Defines supported chain IDs and network information for the application
 */

// Required chain ID for the application (Arc Testnet)
export const REQUIRED_CHAIN_ID = 5042002

// Mapping of chain IDs to network names
export const CHAIN_NAMES: Record<number, string> = {
    1: 'Ethereum Mainnet',
    5: 'Goerli',
    11155111: 'Sepolia',
    5042002: 'Arc Testnet',
}

// Get chain name (returns default format if not found)
export function getChainName(chainId: number | undefined | null): string {
    if (!chainId) return 'Unknown'
    return CHAIN_NAMES[chainId] || `Chain ${chainId}`
}
