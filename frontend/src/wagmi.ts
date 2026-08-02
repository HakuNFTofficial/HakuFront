import { http, createConfig } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { defineChain } from 'viem'

export const RPC_PROXY_URL = '/api/rpc'

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

const walletConnectProjectId =
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim()
const appOrigin =
    typeof window === 'undefined'
        ? 'https://www.hakupump.club'
        : window.location.origin

const connectors = [
    // Compatibility fallback for older EIP-1193 wallets that do not announce
    // themselves through EIP-6963.
    injected({
        shimDisconnect: true,
    }),
    ...(walletConnectProjectId
        ? [
              walletConnect({
                  projectId: walletConnectProjectId,
                  showQrModal: true,
                  metadata: {
                      name: 'Haku',
                      description:
                          'Haku decentralized exchange and NFT platform',
                      url: appOrigin,
                      icons: [`${appOrigin}/favicon.svg`],
                  },
              }),
          ]
        : []),
]

if (
    !walletConnectProjectId &&
    import.meta.env.DEV &&
    import.meta.env.MODE !== 'test'
) {
    console.warn(
        '[wagmi] WalletConnect is disabled. Set VITE_WALLETCONNECT_PROJECT_ID to enable it.',
    )
}

export const config = createConfig({
    chains: [arcTestnet],
    connectors,
    multiInjectedProviderDiscovery: true,
    transports: {
        [arcTestnet.id]: http(RPC_PROXY_URL, {
            batch: {
                batchSize: 20,
                wait: 50,
            },
            // The backend gateway owns bounded retry/backoff so failures are not multiplied.
            retryCount: 0,
            timeout: 40_000,
        }),
    },
})
