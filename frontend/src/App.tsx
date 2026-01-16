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
    const [activeTab, setActiveTab] = useState<'swap' | 'history'>('swap')
    const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    // History Data State
    const [historyData, setHistoryData] = useState<any>(null)
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)
    const [historyError, setHistoryError] = useState<string | null>(null)

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
            setHistoryData(null)
            setHistoryError(null)
            setIsLoadingHistory(false)
            setActiveTab('swap') // Reset to default tab
        }
    }, [isConnected, currentChainId, address, connector])

    // Fetch History
    useEffect(() => {
        if (activeTab === 'history' && address) {
            const fetchHistory = async () => {
                setIsLoadingHistory(true)
                setHistoryError(null)
                try {
                    const response = await fetch(`/api/user-swaps?user_address=${address}`)
                    if (!response.ok) {
                        throw new Error('Failed to fetch history')
                    }
                    const data = await response.json()
                    setHistoryData(data)
                } catch (err) {
                    console.error(err)
                    setHistoryError('Failed to load swap history')
                } finally {
                    setIsLoadingHistory(false)
                }
            }
            fetchHistory()
        }
    }, [activeTab, address])

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

                        {/* Wallet Section - Right */}
                        <div className="flex-shrink-0 flex items-center gap-3">
                        {isConnected ? (
                                <>
                                    {/* Mobile: Compact Wallet Display */}
                                    <div className="md:hidden">
                                        <div className="flex items-center gap-2 bg-[#20212d] border border-gray-700 rounded-lg px-2 py-2">
                                    {connector?.icon && (
                                        <img
                                            src={connector.icon}
                                            alt={connector.name || 'Wallet'}
                                            className="w-5 h-5 rounded-full"
                                        />
                                    )}
                                            <span className="text-xs font-mono">{address?.slice(0, 4)}..{address?.slice(-2)}</span>
                                        </div>
                                    </div>

                                    {/* Desktop: Full Wallet Info */}
                                    <div className="hidden md:flex items-center gap-2">
                                        <div className="flex items-center gap-2 bg-[#20212d] border border-gray-700 rounded-lg px-3 py-2">
                                            {connector?.icon && (
                                                <img
                                                    src={connector.icon}
                                                    alt={connector?.name || 'Wallet'}
                                                    className="w-5 h-5 rounded-full"
                                                />
                                            )}
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-400">{connector?.name || 'Wallet'}</span>
                                        <span className="text-sm font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                                    </div>
                                </div>

                                        {/* Network info */}
                                {currentChainId && (
                                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                                                currentChainId === REQUIRED_CHAIN_ID
                                        ? 'bg-green-500/10 border-green-500/50'
                                        : 'bg-yellow-500/10 border-yellow-500/50'
                                        }`}>
                                        <div className="flex flex-col">
                                                    <span className={`text-xs ${
                                                        currentChainId === REQUIRED_CHAIN_ID ? 'text-green-400' : 'text-yellow-400'
                                                }`}>
                                                {chainName}
                                            </span>
                                            <span className="text-xs text-gray-400">ID: {currentChainId}</span>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() => disconnect()}
                                    className="btn btn-outline btn-sm"
                                >
                                    Disconnect
                                </button>
                            </div>
                                </>
                        ) : (
                            <div className="flex gap-2">
                                {connectors.map((connector) => (
                                    <button
                                        key={connector.uid}
                                        onClick={() => connect({ connector })}
                                            className="btn btn-primary flex items-center gap-2 text-sm md:text-base px-3 md:px-4">
                                        {connector.icon && (
                                            <img
                                                src={connector.icon}
                                                alt={connector.name}
                                                className="w-5 h-5 rounded-full"
                                            />
                                        )}
                                            <span className="hidden md:inline">{connector.name}</span>
                                    </button>
                                ))}
                            </div>
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
                                                    alt={connector.name || 'Wallet'}
                                                    className="w-5 h-5 rounded-full"
                                                />
                                            )}
                                            <span className="text-xs text-gray-400">{connector?.name || 'Wallet'}</span>
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
                                            <div className="text-xs opacity-75">ID: {currentChainId}</div>
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
            <div className="p-4 md:p-8">
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
                            <div className="max-w-4xl mx-auto space-y-8">
                                {/* Swap Page Content */}
                        <Banner />

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                            {/* Left Column: Chart & NFTs */}
                            <div className="lg:col-span-2 space-y-6">
                                <KLineChart />
                                <NFTSection />
                            </div>

                            {/* Right Column: Transaction Area */}
                            <div className="flex flex-col space-y-[1px]">
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
                                        onClick={() => setActiveTab('history')}
                                        className={`flex-1 py-2 rounded-lg font-medium transition-all ${activeTab === 'history'
                                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                            : 'text-gray-500 hover:text-gray-300'
                                            }`}
                                    >
                                        History
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
                                        {isLoadingHistory ? (
                                            <div className="flex justify-center items-center h-64">
                                                <span className="loading loading-spinner loading-lg text-primary"></span>
                                            </div>
                                        ) : historyError ? (
                                            <div className="alert alert-error">
                                                <span>{historyError}</span>
                                            </div>
                                        ) : historyData ? (
                                            <SwapHistory data={historyData} />
                                        ) : (
                                            <div className="text-center text-gray-500 mt-10">No history found</div>
                                        )}
                                    </div>
                                )}
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
