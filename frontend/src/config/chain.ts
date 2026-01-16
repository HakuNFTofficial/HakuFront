/**
 * Chain Configuration
 * Defines supported chain IDs and network information for the application
 */

// Required chain ID for the application (Somnia Testnet)
export const REQUIRED_CHAIN_ID = 50312

// Mapping of chain IDs to network names
export const CHAIN_NAMES: Record<number, string> = {
    1: 'Ethereum Mainnet',
    5: 'Goerli',
    11155111: 'Sepolia',
    50312: 'Somnia Testnet',
}

// Get chain name (returns default format if not found)
export function getChainName(chainId: number | undefined | null): string {
    if (!chainId) return 'Unknown'
    return CHAIN_NAMES[chainId] || `Chain ${chainId}`
}

