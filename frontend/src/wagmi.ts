import { http, createConfig } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { defineChain } from 'viem'
import { ARC_MAINNET } from './config/chain'

export const RPC_PROXY_URL = '/api/rpc'

export const arcMainnet = defineChain({
    id: ARC_MAINNET.id,
    name: ARC_MAINNET.name,
    nativeCurrency: ARC_MAINNET.nativeCurrency,
    rpcUrls: {
        default: {
            http: [...ARC_MAINNET.rpcUrls],
        },
    },
    blockExplorers: {
        default: { name: 'Arc Explorer', url: ARC_MAINNET.explorerUrl },
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
    chains: [arcMainnet],
    connectors,
    multiInjectedProviderDiscovery: true,
    transports: {
        [arcMainnet.id]: http(RPC_PROXY_URL, {
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
