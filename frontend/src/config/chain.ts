/**
 * Chain Configuration
 * Defines supported chain IDs and network information for the application
 */

export const ARC_TESTNET_CHAIN_ID = 5042002
export const ARC_TESTNET_RPC_URL = 'https://rpc.testnet.arc.network'
export const ARC_TESTNET_WS_URL = 'wss://rpc.testnet.arc.network'
export const ARC_TESTNET_EXPLORER_URL = 'https://testnet.arcscan.app'
export const ARC_NATIVE_SYMBOL = 'USDC'
export const ARC_NATIVE_NAME = 'USDC'
export const ARC_NATIVE_DECIMALS = 18
export const ARC_USDC_ERC20 = '0x3600000000000000000000000000000000000000'

// Required chain ID for the application (Arc Testnet)
export const REQUIRED_CHAIN_ID = ARC_TESTNET_CHAIN_ID

// Mapping of chain IDs to network names
export const CHAIN_NAMES: Record<number, string> = {
    1: 'Ethereum Mainnet',
    5: 'Goerli',
    11155111: 'Sepolia',
    [ARC_TESTNET_CHAIN_ID]: 'Arc Testnet',
}

// Get chain name (returns default format if not found)
export function getChainName(chainId: number | undefined | null): string {
    if (!chainId) return 'Unknown'
    return CHAIN_NAMES[chainId] || `Chain ${chainId}`
}
