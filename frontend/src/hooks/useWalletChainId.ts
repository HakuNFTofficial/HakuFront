/**
 * Custom Hook: Get the actual chain ID connected by the wallet
 * Retrieves real-time chain ID directly from wallet provider (window.ethereum), ensuring immediate updates on network switch
 * Supports multi-wallet environments, uses dual mechanism of polling + event listening to ensure network switches are detected
 */

import { useEffect, useState, useRef } from 'react'
import { useAccount } from 'wagmi'

export function useWalletChainId() {
    const { isConnected, connector } = useAccount()
    const [chainId, setChainId] = useState<number | undefined>(undefined)

    // Use ref to store provider, avoiding closure issues
    const providerRef = useRef<any>(null)
    // Use ref to store the latest chainId for polling comparison
    const lastChainIdRef = useRef<number | undefined>(undefined)

    useEffect(() => {
        if (!isConnected || !connector) {
            console.log('[useWalletChainId] Wallet not connected or connector does not exist, clearing chain ID')
            setChainId(undefined)
            providerRef.current = null
            lastChainIdRef.current = undefined
            return
        }

        let isMounted = true
        let pollInterval: NodeJS.Timeout | null = null

        // Define event handler inside effect to avoid closure issues
        const handleChainChanged = (hexChainId: string) => {
            if (!isMounted) return
            const id = parseInt(hexChainId, 16)
            console.log('[useWalletChainId] 🔔 Wallet chain changed event triggered:', {
                newChainId: id,
                hex: hexChainId,
                time: new Date().toLocaleTimeString()
            })
            lastChainIdRef.current = id
            setChainId(id)
        }

        const handleAccountsChanged = () => {
            if (!isMounted) return
            console.log('[useWalletChainId] 🔔 accountsChanged event triggered, re-fetching chain ID')
            if (providerRef.current) {
                providerRef.current.request({ method: 'eth_chainId' })
                    .then((hexChainId: string) => {
                        if (!isMounted) return
                        const id = parseInt(hexChainId, 16)
                        lastChainIdRef.current = id
                        setChainId(id)
                    })
                    .catch((error: any) => {
                        console.error('[useWalletChainId] Failed to get chain ID:', error)
                    })
            }
        }

        // Polling function: serves as a backup mechanism for event listening
        const pollChainId = async () => {
            if (!isMounted || !providerRef.current) return

            try {
                const hexChainId = await providerRef.current.request({ method: 'eth_chainId' })
                const id = parseInt(hexChainId, 16)

                // Only update state when chain ID changes
                if (id !== lastChainIdRef.current) {
                    console.log('[useWalletChainId] 🔄 Polling detected chain ID change:', {
                        oldChainId: lastChainIdRef.current,
                        newChainId: id,
                        time: new Date().toLocaleTimeString()
                    })
                    lastChainIdRef.current = id
                    setChainId(id)
                }
            } catch (error) {
                console.error('[useWalletChainId] Polling failed to get chain ID:', error)
            }
        }

        const getCorrectProvider = async (): Promise<any> => {
            if (typeof window === 'undefined' || !(window as any).ethereum) {
                return null
            }

            const ethereum = (window as any).ethereum
            const connectorName = connector?.name?.toLowerCase() || ''

            console.log('[useWalletChainId] 🔍 Looking for current connected wallet provider:', {
                connectorName,
                connectorId: connector?.id,
                currentWallet: connector?.name || 'Unknown'
            })

            // Try to get provider via connector.getProvider() first
            if ((connector as any).getProvider) {
                try {
                    const provider = await (connector as any).getProvider()
                    console.log('[useWalletChainId] ✅ Got provider via connector.getProvider()')
                    return provider
                } catch (e) {
                    console.warn('[useWalletChainId] connector.getProvider() failed:', e)
                }
            }

            // If multiple wallets exist, find the currently connected one
            if (ethereum.providers && Array.isArray(ethereum.providers)) {
                console.log('[useWalletChainId] 🔍 Multiple wallets detected (providers count:', ethereum.providers.length, ')')

                // Use strict matching logic (consistent with previous fixes)
                for (const provider of ethereum.providers) {
                    let isMatch = false

                    if (connectorName.includes('okx') || connectorName.includes('okex')) {
                        // OKX Wallet: must have isOKExWallet identifier
                        isMatch = provider.isOKExWallet === true
                    } else if (connectorName.includes('metamask')) {
                        // MetaMask: has isMetaMask but no isOKExWallet
                        isMatch = provider.isMetaMask === true && !provider.isOKExWallet
                    } else if (connectorName.includes('coinbase')) {
                        // Coinbase Wallet
                        isMatch = provider.isCoinbaseWallet === true
                    }

                    if (isMatch) {
                        const providerInfo = provider.isOKExWallet ? 'OKX Wallet' :
                            provider.isMetaMask ? 'MetaMask' :
                                provider.isCoinbaseWallet ? 'Coinbase Wallet' :
                                    'Unknown'
                        console.log('[useWalletChainId] ✅ Found matching provider:', providerInfo)
                        return provider
                    }
                }

                console.warn('[useWalletChainId] ⚠️ No matching provider found, using default ethereum')
                return ethereum
            } else {
                console.log('[useWalletChainId] ℹ️ Only one wallet, using it directly')
                return ethereum
            }
        }

        const initializeProvider = async () => {
            try {
                const provider = await getCorrectProvider()

                if (!provider) {
                    console.error('[useWalletChainId] Unable to get provider')
                    return
                }

                providerRef.current = provider

                // Get initial chain ID
                const hexChainId = await provider.request({ method: 'eth_chainId' })
                const id = parseInt(hexChainId, 16)

                if (isMounted) {
                    const providerInfo = provider.isOKExWallet ? 'OKX Wallet' :
                        provider.isMetaMask ? 'MetaMask' :
                            provider.isCoinbaseWallet ? 'Coinbase Wallet' :
                                'Unknown'

                    console.log('[useWalletChainId] 📊 Initial chain ID:', {
                        wallet: connector?.name || 'Unknown',
                        providerType: providerInfo,
                        chainId: id,
                        hex: hexChainId
                    })
                    lastChainIdRef.current = id
                    setChainId(id)

                    // Register event listeners
                    console.log('[useWalletChainId] 📡 Registering chain change listener to:', providerInfo)
                    provider.on('chainChanged', handleChainChanged)
                    provider.on('accountsChanged', handleAccountsChanged)

                    console.log('[useWalletChainId] 🔍 Verify event listeners registered:', {
                        hasOn: typeof provider.on === 'function',
                        hasRemoveListener: typeof provider.removeListener === 'function'
                    })

                    // Start polling as backup mechanism (events may be unreliable in multi-wallet environments)
                    console.log('[useWalletChainId] 🔄 Starting polling backup mechanism (every 2 seconds)')
                    pollInterval = setInterval(pollChainId, 2000)
                }
            } catch (error) {
                console.error('[useWalletChainId] Initialization failed:', error)
            }
        }

        initializeProvider()

        return () => {
            isMounted = false
            console.log('[useWalletChainId] 🧹 Cleaning up event listeners and polling')

            // Clean up polling
            if (pollInterval) {
                clearInterval(pollInterval)
                pollInterval = null
            }

            // Clean up event listeners
            if (providerRef.current) {
                try {
                    providerRef.current.removeListener('chainChanged', handleChainChanged)
                    providerRef.current.removeListener('accountsChanged', handleAccountsChanged)
                } catch (e) {
                    console.warn('[useWalletChainId] Failed to clean up listeners:', e)
                }
            }
        }
    }, [isConnected, connector])

    return chainId
}
