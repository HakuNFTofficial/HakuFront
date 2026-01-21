import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Swap } from './components/Swap'
import { SwapHistory } from './components/SwapHistory'
import { KLineChart } from './components/KLineChart'
import { Banner } from './components/Banner'
import { NFTSection } from './components/NFTSection'
import { Profile } from './components/Profile'
import { VersionChecker } from './components/VersionChecker'
import { NetworkMismatchModal } from './components/NetworkMismatchModal'
import { useWalletChainId } from './hooks/useWalletChainId'
import { REQUIRED_CHAIN_ID, getChainName } from './config/chain'
import { CONTRACTS } from './config/contracts'

function App() {
    const { address, isConnected, connector } = useAccount()
    // Use custom hook to get wallet's actual connected chain ID (retrieved directly from wallet provider, real-time updates)
    const chainId = useWalletChainId()
    const [copied, setCopied] = useState(false)
    
    // Format address display (shorten)
    const formatAddress = (addr: string) => {
        if (addr.length <= 10) return addr
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`
    }
    
    // Copy HakuToken contract address
    const handleCopyHakuTokenAddress = async (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        
        try {
            const contractAddress = CONTRACTS.TOKEN_B
            console.log('[App] Copying HakuToken address:', contractAddress)
            
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(contractAddress)
                console.log('[App] ✅ HakuToken address copied successfully')
            } else {
                // Fallback solution
                const textArea = document.createElement('textarea')
                textArea.value = contractAddress
                textArea.style.position = 'fixed'
                textArea.style.left = '-999999px'
                textArea.style.top = '-999999px'
                document.body.appendChild(textArea)
                textArea.focus()
                textArea.select()
                document.execCommand('copy')
                textArea.remove()
                console.log('[App] ✅ HakuToken address copied (fallback method)')
            }
            
            setCopied(true)
            setTimeout(() => {
                setCopied(false)
                console.log('[App] Copy feedback reset')
            }, 2000)
        } catch (err) {
            console.error('[App] ❌ Failed to copy:', err)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }
    const { connectors, connect, isPending: isConnecting } = useConnect()
    const { disconnect, isPending: isDisconnecting } = useDisconnect()

    // Get current chain name (directly use chain ID from wallet)
    const currentChainId = chainId
    const chainName = getChainName(currentChainId)
    
    // Page navigation state (Swap or Profile)
    const [currentPage, setCurrentPage] = useState<'swap' | 'profile'>('swap')
    const [activeTab, setActiveTab] = useState<'swap' | 'transaction'>('swap')
    const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false)  // Hamburger menu state

    // Transaction Data State
    const [transactionData, setTransactionData] = useState<any>(null)
    const [isLoadingTransaction, setIsLoadingTransaction] = useState(false)
    const [transactionError, setTransactionError] = useState<string | null>(null)

    // Network switch function
    const switchNetwork = async () => {
        if (!connector) {
            console.error('[App] Unable to switch network: connector does not exist')
            return
        }

        setIsSwitchingNetwork(true)
        try {
            // Get current connected wallet provider
            const provider = await (connector as any).getProvider()
            if (!provider) {
                throw new Error('Unable to get wallet provider')
            }

            const targetChainIdHex = `0x${REQUIRED_CHAIN_ID.toString(16)}`
            console.log('[App] 🔄 Attempting to switch network to:', {
                targetChainId: REQUIRED_CHAIN_ID,
                hex: targetChainIdHex,
                wallet: connector.name
            })

            try {
                // Try to switch to target network
                await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: targetChainIdHex }],
                })
                console.log('[App] ✅ Network switch successful')
            } catch (switchError: any) {
                // If network doesn't exist (error code 4902), try to add network
                if (switchError.code === 4902) {
                    console.log('[App] 📝 Network does not exist, trying to add...')
                    await provider.request({
                        method: 'wallet_addEthereumChain',
                        params: [
                            {
                                chainId: targetChainIdHex,
                                chainName: 'Somnia Testnet',
                                nativeCurrency: {
                                    name: 'STT',
                                    symbol: 'STT',
                                    decimals: 18,
                                },
                                rpcUrls: ['https://dream-rpc.somnia.network'],
                                blockExplorerUrls: ['https://somnia-devnet.socialscan.io'],
                            },
                        ],
                    })
                    console.log('[App] ✅ Network added successfully')
                } else {
                    throw switchError
                }
            }
        } catch (error) {
            console.error('[App] ❌ Network switch failed:', error)
            alert(`Network switch failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setIsSwitchingNetwork(false)
        }
    }

    // Network check: immediately check if network is correct after wallet connection
    useEffect(() => {
        if (isConnected && currentChainId !== undefined && currentChainId !== null) {
            console.log('[App] 🔍 Current connected wallet info:', {
                walletName: connector?.name || 'Unknown',
                walletId: connector?.id || 'Unknown',
                walletAddress: address,
                currentChainId: currentChainId,
                requiredChainId: REQUIRED_CHAIN_ID
            })
        }
        // If disconnected, reset all related states
        if (!isConnected) {
            setTransactionData(null)
            setTransactionError(null)
            setIsLoadingTransaction(false)
            setActiveTab('swap') // Reset to default tab
        }
    }, [isConnected, currentChainId, address, connector])

    // Fetch Transaction
    useEffect(() => {
        if (activeTab === 'transaction' && address) {
            const fetchTransaction = async () => {
                setIsLoadingTransaction(true)
                setTransactionError(null)
                try {
                    const response = await fetch(`/api/user-swaps?user_address=${address}`)
                    if (!response.ok) {
                        throw new Error('Failed to fetch transaction')
                    }
                    const data = await response.json()
                    setTransactionData(data)
                } catch (err) {
                    console.error(err)
                    setTransactionError('Failed to load swap transaction')
                } finally {
                    setIsLoadingTransaction(false)
                }
            }
            fetchTransaction()
        }
    }, [activeTab, address])

    // Close wallet menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement
            if (isWalletMenuOpen && !target.closest('.wallet-menu-container')) {
                setIsWalletMenuOpen(false)
            }
        }

        if (isWalletMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isWalletMenuOpen])

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
            {/* Top Navigation Bar */}
            <div className="w-full bg-[#1a1b23] border-b border-gray-700/50 shadow-lg sticky top-0 z-40">
                <div className="px-4 md:px-8 py-3">
                    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                        {/* Logo - Always on Left */}
                        <div className="flex-shrink-0">
                            <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
                            Haku Pump
                        </h1>
                    </div>

                        {/* Desktop Navigation Menu - Center */}
                        <div className="hidden md:flex flex-1 justify-center max-w-md">
                            <div className="flex w-full gap-2">
                                <button
                                    onClick={() => setCurrentPage('swap')}
                                    className={`flex-1 py-2 px-6 text-center font-medium transition-all rounded-lg ${
                                        currentPage === 'swap'
                                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                                    }`}
                                >
                                    Swap
                                </button>
                                <button
                                    onClick={() => setCurrentPage('profile')}
                                    className={`flex-1 py-2 px-6 text-center font-medium transition-all rounded-lg ${
                                        currentPage === 'profile'
                                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                                    }`}
                                >
                                    Profile
                                </button>
                            </div>
                        </div>

                        {/* Social Media + Wallet Section - Right */}
                        <div className="flex-shrink-0 flex items-center gap-1.5">
                            {/* X (Twitter) Link */}
                            <a
                                href="https://x.com/HakuNFTofficial"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#20212d] border border-gray-700 hover:border-gray-600 hover:bg-gray-800/50 transition-colors"
                                aria-label="Follow us on X"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                            </a>

                            {/* Discord Link */}
                            <a
                                href="https://discord.com/invite/zURfGaNf6p"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#20212d] border border-gray-700 hover:border-gray-600 hover:bg-gray-800/50 transition-colors"
                                aria-label="Join our Discord"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                                </svg>
                            </a>

                            {/* Wallet Section */}
                        {isConnected ? (
                                <>
                                    {/* Hamburger Menu Button - Desktop Only */}
                                    <div className="relative wallet-menu-container hidden md:block">
                                        <button
                                            onClick={() => setIsWalletMenuOpen(!isWalletMenuOpen)}
                                            className="flex items-center gap-2 bg-[#20212d] border border-gray-700 hover:border-gray-600 rounded-lg px-3 py-2 transition-colors"
                                        >
                                            {connector?.icon && (
                                                <img
                                                    src={connector.icon}
                                                    alt="Wallet"
                                                    className="w-5 h-5 rounded-full"
                                                />
                                            )}
                                            <span className="text-sm font-mono hidden sm:inline">{address?.slice(0, 4)}...{address?.slice(-4)}</span>
                                            {/* Hamburger Icon (三道杠) */}
                                            <svg 
                                                className="w-5 h-5"
                                                fill="none" 
                                                stroke="currentColor" 
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                            </svg>
                                        </button>

                                        {/* Dropdown Menu */}
                                        {isWalletMenuOpen && (
                                            <div className="absolute right-0 mt-2 w-72 bg-[#1a1b23] border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                                                {/* Wallet Info with Disconnect Button */}
                                                <div className="p-4 border-b border-gray-700">
                                                    <div className="flex items-center gap-3">
                                                        {connector?.icon && (
                                                            <img
                                                                src={connector.icon}
                                                                alt={connector?.name || 'Wallet'}
                                                                className="w-8 h-8 rounded-full"
                                                            />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs text-gray-400">Wallet</div>
                                                            <div className="text-sm font-mono text-white truncate">{address?.slice(0, 6)}...{address?.slice(-4)}</div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                disconnect()
                                                                setIsWalletMenuOpen(false)
                                                            }}
                                                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg transition-colors text-xs font-medium whitespace-nowrap"
                                                        >
                                                            Disconnect
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Network Info */}
                                                {currentChainId && (
                                                    <div className="p-4 border-b border-gray-700">
                                                        <div className="text-xs text-gray-400 mb-2">Network</div>
                                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                                                            currentChainId === REQUIRED_CHAIN_ID
                                                                ? 'bg-green-500/10 border-green-500/50'
                                                                : 'bg-yellow-500/10 border-yellow-500/50'
                                                        }`}>
                                                            <div className="flex flex-col flex-1">
                                                                <span className={`text-sm font-medium ${
                                                                    currentChainId === REQUIRED_CHAIN_ID ? 'text-green-400' : 'text-yellow-400'
                                                                }`}>
                                                                    {chainName}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                        ) : (
                            <button
                                onClick={() => {
                                    // Connect with the first available connector
                                    const firstConnector = connectors[0]
                                    if (firstConnector) {
                                        connect({ connector: firstConnector })
                                    }
                                }}
                                disabled={isConnecting || connectors.length === 0}
                                className="btn btn-primary px-6 py-2 text-sm md:text-base font-medium"
                            >
                                {isConnecting ? 'Connecting...' : 'Connect'}
                            </button>
                        )}

                            {/* Mobile: Hamburger Menu Button - Always on Right */}
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                <svg
                                    className="w-6 h-6 text-gray-300"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor">
                                    {isMobileMenuOpen ? (
                                        <path d="M6 18L18 6M6 6l12 12" />
                                    ) : (
                                        <path d="M4 6h16M4 12h16M4 18h16" />
                                    )}
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Sidebar Menu */}
            {isMobileMenuOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/60 z-40 md:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />

                    {/* Sidebar */}
                    <div className="fixed top-0 right-0 h-full w-64 bg-[#1a1b23] border-l border-gray-700 z-50 md:hidden shadow-2xl">
                        <div className="flex flex-col h-full">
                            {/* Sidebar Header */}
                            <div className="flex items-center justify-between p-4 border-b border-gray-700">
                                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
                                    Menu
                                </h2>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Navigation Links */}
                            <nav className="flex-1 p-4 space-y-2">
                                <button
                                    onClick={() => {
                                        setCurrentPage('swap')
                                        setIsMobileMenuOpen(false)
                                    }}
                                    className={`flex items-center gap-3 w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                                        currentPage === 'swap'
                                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50'
                                            : 'text-gray-300 hover:bg-gray-700/30'
                                    }`}
                                >
                                    Swap
                                </button>
                                <button
                                    onClick={() => {
                                        setCurrentPage('profile')
                                        setIsMobileMenuOpen(false)
                                    }}
                                    className={`flex items-center gap-3 w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                                        currentPage === 'profile'
                                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50'
                                            : 'text-gray-300 hover:bg-gray-700/30'
                                    }`}
                                >
                                    Profile
                                </button>
                            </nav>

                            {/* Sidebar Footer - Wallet Actions */}
                            {isConnected && (
                                <div className="p-4 border-t border-gray-700 space-y-3">
                                    {/* Wallet Info */}
                                    <div className="bg-[#20212d] border border-gray-700 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            {connector?.icon && (
                                                <img
                                                    src={connector.icon}
                                                    alt="Wallet"
                                                    className="w-5 h-5 rounded-full"
                                                />
                                            )}
                                            <span className="text-xs text-gray-400">Wallet</span>
                                        </div>
                                        <div className="text-sm font-mono text-gray-300">
                                            {address?.slice(0, 10)}...{address?.slice(-8)}
                                        </div>
                                    </div>

                                    {/* Network Status */}
                                    {currentChainId && (
                                        <div className={`px-3 py-2 rounded-lg border text-center ${
                                            currentChainId === REQUIRED_CHAIN_ID
                                                ? 'bg-green-500/10 border-green-500/50 text-green-400'
                                                : 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400'
                                        }`}>
                                            <div className="text-xs font-medium">{chainName}</div>
                                        </div>
                                    )}

                                    {/* Disconnect Button */}
                                    <button
                                        onClick={() => {
                                            disconnect()
                                            setIsMobileMenuOpen(false)
                                        }}
                                        className="w-full btn btn-outline btn-sm"
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Main Content */}
            <div className="p-2 md:p-4">
                {(isConnecting || isDisconnecting) ? (
                    <div className="w-full flex flex-col items-center justify-center py-20">
                        <div className="text-center space-y-4">
                            <span className="loading loading-spinner loading-lg text-primary"></span>
                            <p className="text-gray-500">
                                {isConnecting ? 'Connecting Wallet...' : 'Disconnecting...'}
                            </p>
                        </div>
                    </div>
                ) : isConnected && address ? (
                    <>
                        {/* Page Content */}
                        {currentPage === 'swap' ? (
                            <div className="max-w-4xl mx-auto space-y-3">
                                {/* Swap Page Content */}
                        <Banner />

                        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 items-stretch">
                            {/* PC: Left column with K-Line Chart + NFTs (tight vertical stack) */}
                            <div className="hidden lg:flex lg:flex-col lg:col-span-2 gap-2">
                                <KLineChart />
                                <NFTSection onViewAll={() => setCurrentPage('profile')} />
                            </div>

                            {/* Mobile only: K-Line Chart (order-1) */}
                            <div className="lg:hidden order-1">
                                <KLineChart />
                            </div>

                            {/* Swap/History Area - Mobile: order-2, PC: right column */}
                            <div className="order-2 lg:order-none flex flex-col space-y-[1px]">
                                {/* Tabs */}
                                <div className="flex gap-2 bg-black/20 p-1 rounded-xl">
                                    <button
                                        onClick={() => setActiveTab('swap')}
                                        className={`flex-1 py-2 rounded-lg font-medium transition-all ${activeTab === 'swap'
                                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                            : 'text-gray-500 hover:text-gray-300'
                                            }`}
                                    >
                                        Swap
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('transaction')}
                                        className={`flex-1 py-2 rounded-lg font-medium transition-all ${activeTab === 'transaction'
                                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                            : 'text-gray-500 hover:text-gray-300'
                                            }`}
                                    >
                                        Transaction
                                    </button>
                                </div>

                                {/* Content Area */}
                                {activeTab === 'swap' ? (
                                    <div className="space-y-[1px]">
                                        <div className="p-[1px] bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl group">
                                            <div 
                                                className="bg-[#1a1b23] rounded-2xl p-4 text-center cursor-pointer hover:bg-[#252630] transition-colors"
                                                onClick={handleCopyHakuTokenAddress}
                                                title={CONTRACTS.TOKEN_B}
                                            >
                                                <div className="flex items-center justify-center gap-2 min-h-[1.5rem]">
                                                    {copied ? (
                                                        <>
                                                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                                    <h3 className="text-green-400 font-bold">Copied</h3>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <h3 
                                                                className="text-white font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 group-hover:text-white transition-all"
                                                                style={{
                                                                    fontFamily: 'monospace',
                                                                    fontSize: '0.875rem',
                                                                    letterSpacing: '0.05em'
                                                                }}
                                                            >
                                                                <span className="group-hover:hidden">{formatAddress(CONTRACTS.TOKEN_B)}</span>
                                                            </h3>
                                                            <h3 
                                                                className="hidden group-hover:block text-white font-bold text-center"
                                                                style={{
                                                                    fontFamily: 'monospace',
                                                                    fontSize: '0.65rem',
                                                                    letterSpacing: '0.02em',
                                                                    lineHeight: '1.3',
                                                                    wordBreak: 'break-all',
                                                                    maxWidth: '100%'
                                                                }}
                                                            >
                                                                {CONTRACTS.TOKEN_B}
                                                </h3>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <Swap />
                                    </div>
                                ) : (
                                    <div className="min-h-[400px]">
                                        {isLoadingTransaction ? (
                                            <div className="flex justify-center items-center h-64">
                                                <span className="loading loading-spinner loading-lg text-primary"></span>
                                            </div>
                                        ) : transactionError ? (
                                            <div className="alert alert-error">
                                                <span>{transactionError}</span>
                                            </div>
                                        ) : transactionData ? (
                                            <SwapHistory data={transactionData} />
                                        ) : (
                                            <div className="text-center text-gray-500 mt-10">No transaction found</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Mobile only: My NFTs (order-3) */}
                            <div className="lg:hidden order-3">
                                <NFTSection onViewAll={() => setCurrentPage('profile')} />
                            </div>
                        </div>
                    </div>
                ) : (
                            /* Profile Page Content */
                            <div className="max-w-7xl mx-auto">
                                <Profile />
                            </div>
                        )}
                    </>
                ) : (
                    /* Not Connected */
                    <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-20">
                        <div className="text-center space-y-4">
                            <h2 className="text-2xl font-bold text-gray-300">Please Connect Wallet</h2>
                            <p className="text-gray-500">Click the wallet button in the top right corner to connect</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Version Checker */}
            <VersionChecker checkInterval={5 * 60 * 1000} autoShow={true} />

            {/* Network Mismatch Modal */}
            <NetworkMismatchModal
                isOpen={isConnected && currentChainId !== undefined && currentChainId !== REQUIRED_CHAIN_ID}
                currentChainName={chainName}
                currentChainId={currentChainId || 0}
                requiredChainName={getChainName(REQUIRED_CHAIN_ID)}
                requiredChainId={REQUIRED_CHAIN_ID}
                onSwitchNetwork={switchNetwork}
                isSwitching={isSwitchingNetwork}
            />
        </div>
    )
}

export default App
