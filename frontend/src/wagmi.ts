import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { defineChain } from 'viem'

// Define Arc testnet
export const arcTestnet = defineChain({
    id: 5042002,
    name: 'Arc Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'USDC',
        symbol: 'USDC',
    },
    rpcUrls: {
        default: {
            http: ['https://rpc.testnet.arc.network'],
        },
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
        [arcTestnet.id]: http('https://rpc.testnet.arc.network'),
    },
})
