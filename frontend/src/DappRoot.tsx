import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'

import App from './App'
import { WebSocketProvider } from './providers/WebSocketProvider'
import { config } from './wagmi'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
            retry: false,
        },
    },
})

export function DappRoot() {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <WebSocketProvider>
                    <App />
                </WebSocketProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}
