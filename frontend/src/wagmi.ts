import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { defineChain } from 'viem'
import {
    ARC_NATIVE_DECIMALS,
    ARC_NATIVE_NAME,
    ARC_NATIVE_SYMBOL,
    ARC_TESTNET_CHAIN_ID,
    ARC_TESTNET_EXPLORER_URL,
    ARC_TESTNET_RPC_URL,
} from './config/chain'

// Define Arc testnet
export const arcTestnet = defineChain({
    id: ARC_TESTNET_CHAIN_ID,
    name: 'Arc Testnet',
    nativeCurrency: {
        decimals: ARC_NATIVE_DECIMALS,
        name: ARC_NATIVE_NAME,
        symbol: ARC_NATIVE_SYMBOL,
    },
    rpcUrls: {
        default: {
            http: [ARC_TESTNET_RPC_URL],
        },
    },
    blockExplorers: {
        default: { name: 'ArcScan', url: ARC_TESTNET_EXPLORER_URL },
    },
})

export const config = createConfig({
    chains: [arcTestnet],
    connectors: [
        // Injected connector for MetaMask, Trust Wallet, OKX, etc.
        injected({
            target: 'metaMask',
            shimDisconnect: true,
        }),
        // Fallback injected connector for other wallets
        injected({
            shimDisconnect: true,
        }),
    ],
    transports: {
        [arcTestnet.id]: http(ARC_TESTNET_RPC_URL),
    },
})
