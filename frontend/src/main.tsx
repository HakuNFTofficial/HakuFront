import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './wagmi'
import App from './App'
import './index.css'
import { logVersionInfo } from './utils/version'
import { WebSocketProvider } from './providers/WebSocketProvider'

// Display version information in development environment or when debugging is needed
if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
    logVersionInfo()
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
            retry: 2,
        },
    },
})

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <WebSocketProvider>
                    <App />
                </WebSocketProvider>
            </QueryClientProvider>
        </WagmiProvider>
    </StrictMode>,
)
