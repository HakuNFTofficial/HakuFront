import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { defineChain } from 'viem'

// Define Somnia testnet
export const somnia = defineChain({
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'STT',
        symbol: 'STT',
    },
    rpcUrls: {
        default: {
            http: ['https://dream-rpc.somnia.network'],
        },
    },
    blockExplorers: {
        default: { name: 'Explorer', url: 'https://somnia-devnet.socialscan.io' },
    },
})

export const config = createConfig({
    chains: [somnia],
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
        [somnia.id]: http('https://dream-rpc.somnia.network'),
    },
})
