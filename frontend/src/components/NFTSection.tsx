import { useEffect, useState, useRef } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { NFTImageReveal } from './NFTImageReveal'
import { CONTRACTS, HUKU_NFT_ABI, ERC20_ABI } from '../config/contracts'
import { useEventAssociation } from '../hooks/useEventAssociation'
import { useWebSocket } from '../hooks/useWebSocket'

interface NFT {
    nft_id: number
    file_name: string | null
    all_chips_owned: boolean
    owned_chips_count: number
    total_chips_count: number
    is_mint: number // 0: Not requested, 1: In progress, 2: Minted
    token_id?: string | null // On-chain tokenId returned by backend (string format, e.g. "21", "20"), displayed after successful minting
}

interface NFTQueryResponse {
    user_address: string
    can_mint: number
    nfts: NFT[]
}

// Backend validation endpoint response
interface MintEligibilityResponse {
    eligible: boolean  // Backend returns eligible field
    message: string
    contract_address?: string
    token_id?: string
    uint256_param?: number  // Backend returns uint256_param, not remark
}

interface NFTSectionProps {
    onViewAll?: () => void
}

export function NFTSection({ onViewAll }: NFTSectionProps = {}) {
    const { address } = useAccount()
    const [nfts, setNfts] = useState<NFT[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [mintingNftId, setMintingNftId] = useState<number | null>(null) // NFT ID currently minting
    const [approvingNftId, setApprovingNftId] = useState<number | null>(null) // NFT ID currently approving
    const [burningNftId, setBurningNftId] = useState<number | null>(null) // NFT ID currently burning
    // ✅ Independent approve status for each NFT: track which NFTs have completed approve (for displaying correct button)
    const [approvedNftIds, setApprovedNftIds] = useState<Set<number>>(new Set())
    const timeoutRef = useRef<NodeJS.Timeout | null>(null) // Timeout timer reference
    const hasRequestedInitialDataRef = useRef<boolean>(false) // Track if initial data has been requested
    
    // Wagmi hooks for contract interaction
    const { writeContract, data: hash, error: writeError, isPending: isWritePending } = useWriteContract()
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
    
    // Approve related states (using separate writeContract hook)
    const { writeContract: writeApproveContract, data: approveHash, isPending: isApprovePending } = useWriteContract()
    const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({ 
        hash: approveHash 
    })
    
    // Revoke allowance related states
    const [revokingNftId, setRevokingNftId] = useState<number | null>(null) // NFT ID currently revoking authorization
    const { writeContract: writeRevokeContract, data: revokeHash, isPending: isRevokePending } = useWriteContract()
    const { isLoading: isRevokeConfirming, isSuccess: isRevokeConfirmed } = useWaitForTransactionReceipt({ 
        hash: revokeHash 
    })
    
    // Burn related states (using separate writeContract hook)
    const { writeContract: writeBurnContract, data: burnHash, isPending: isBurnPending, error: burnError } = useWriteContract()
    const { isLoading: isBurnConfirming, isSuccess: isBurnConfirmed } = useWaitForTransactionReceipt({ 
        hash: burnHash 
    })
    
    // Listen for burn errors
    useEffect(() => {
        if (burnError && burningNftId) {
            console.error('[NFTSection] ❌ Burn transaction error:', burnError)
            setBurningNftId(null)
            
            let errorMessage = 'Burn failed: '
            if (burnError.message) {
                errorMessage += burnError.message
                // Check common errors
                if (burnError.message.includes('ERC721InsufficientApproval') || burnError.message.includes('ERC721InsufficientApproval')) {
                    errorMessage = 'You do not have permission to burn this NFT (not owner or not approved)'
                } else if (burnError.message.includes('ERC721NonexistentToken')) {
                    errorMessage = 'This NFT does not exist or has been destroyed'
                } else if (burnError.message.includes('execution reverted')) {
                    errorMessage = 'Contract execution failed: You may not be the owner of this NFT, or the NFT has been burned'
                }
            } else {
                errorMessage += 'Unknown error'
            }
            alert(errorMessage)
        }
    }, [burnError, burningNftId])
    
    // Read mintPrice
    const { data: mintPrice } = useReadContract({
        address: CONTRACTS.HUKU_NFT,
        abi: HUKU_NFT_ABI,
        functionName: 'mintPrice',
        query: {
            refetchInterval: 10000, // Refresh every 10 seconds
        },
    })
    
    // Read HakuToken decimals
    const { data: tokenBDecimals } = useReadContract({
        address: CONTRACTS.TOKEN_B,
        abi: ERC20_ABI,
        functionName: 'decimals',
    })
    
    // Read allowance (amount of HakuToken user has authorized to HukuNFT contract)
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: CONTRACTS.TOKEN_B,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address && CONTRACTS.HUKU_NFT 
            ? [address, CONTRACTS.HUKU_NFT] 
            : undefined,
        query: {
            enabled: !!address && !!CONTRACTS.HUKU_NFT,
            refetchInterval: 3000, // Refresh every 3 seconds
        },
    })
    
    // ✅ No longer need global needsApprove, as we use approvedNftIds to manage independent authorization status for each NFT
    // Each NFT is only added to approvedNftIds after user clicks "Mint" and completes authorization
    
    // After approve confirmed, refresh allowance and mark this NFT as approved
    useEffect(() => {
        if (isApproveConfirmed && approvingNftId !== null) {
            const nftIdToApprove = approvingNftId
            console.log('[NFTSection] 🔔 Approve confirmed for NFT:', nftIdToApprove)
            console.log('[NFTSection] Current approvedNftIds before update:', [...approvedNftIds])
            
            // ✅ First mark this NFT as approved (independent state management), then refresh allowance
            // This avoids clearing just-added state when refetchAllowance triggers other updates
            setApprovedNftIds(prev => {
                // ⚠️ Critical: ensure only add currently authorized NFT, don't add other NFTs
                if (prev.has(nftIdToApprove)) {
                    console.log('[NFTSection] ⚠️ NFT already in approvedNftIds:', nftIdToApprove)
                    return prev
                }
                // ⚠️ Critical: only add this one NFT, don't add all NFTs
                const newSet = new Set([...prev])
                newSet.add(nftIdToApprove)
                console.log('[NFTSection] ✅ Updated approvedNftIds:', {
                    previous: [...prev],
                    added: nftIdToApprove,
                    new: [...newSet],
                    totalNFTs: nfts.length,
                    note: '⚠️ Only the approved NFT is added, not all NFTs'
        })
                return newSet
            })
    
            // Delay refreshing allowance to ensure state update completes
            setTimeout(() => {
            refetchAllowance()
            }, 100)
            
            setApprovingNftId(null)
        }
    }, [isApproveConfirmed, approvingNftId, nfts.length])

    // After revoke authorization confirmed, refresh allowance and clear this NFT's approve status
    useEffect(() => {
        if (isRevokeConfirmed && revokingNftId !== null) {
            refetchAllowance()
            // ✅ Clear this NFT's approve status
            setApprovedNftIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(revokingNftId)
                return newSet
            })
            setRevokingNftId(null)
            console.log('[NFTSection] ✅ NFT allowance revoked:', revokingNftId)
        }
    }, [isRevokeConfirmed, revokingNftId, refetchAllowance])

    // ✅ Subscribe to WebSocket to receive NFTUpdate events (real-time updates)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = window.location.host
    const { status: wsStatus } = useWebSocket({
        url: `${wsProtocol}//${wsHost}/ws`,
        enabled: !!address,  // Only connect when address exists
        onMessage: (message: any) => {
            // Only process NFTUpdate events
            if (message.type === 'NFTUpdate' && message.data) {
                const nftUpdate = message.data as NFTQueryResponse
                
                // Only update current user's NFT data
                if (address && nftUpdate.user_address.toLowerCase() === address.toLowerCase()) {
                    console.log('[NFTSection] 📦 Received NFTUpdate via WebSocket:', nftUpdate)
                    console.log('[NFTSection] Updating NFTs list:', nftUpdate.nfts?.length || 0, 'NFTs')
                    
                    if (nftUpdate.nfts && nftUpdate.nfts.length > 0) {
                        setNfts(nftUpdate.nfts)
                        // ✅ When NFT list updates via WebSocket, sync update approvedNftIds
                        // ⚠️ Important: only clear approve status of NFTs that entered minting process (is_mint !== 0)
                        // Preserve approve status of all NFTs with is_mint === 0
                        // ⚠️ Critical: don't clear just-authorized NFT status, even if WebSocket update happens after authorization confirmed
                        setApprovedNftIds(prev => {
                            const newSet = new Set<number>()
                            // Traverse new NFT list, preserve approve status of NFTs with is_mint === 0
                            nftUpdate.nfts.forEach((nft: NFT) => {
                                if (nft.is_mint === 0 && prev.has(nft.nft_id)) {
                                    newSet.add(nft.nft_id)
                                }
                            })
                            // ⚠️ Important: only preserve NFTs already in prev and with is_mint === 0 in new list
                            // Don't add new NFTs, only preserve existing authorization status
                            // This avoids erroneously adding all NFTs during WebSocket update
                            console.log('[NFTSection] WebSocket update - approvedNftIds:', {
                                previous: [...prev],
                                new: [...newSet],
                                nftsInUpdate: nftUpdate.nfts.map((n: NFT) => ({ id: n.nft_id, is_mint: n.is_mint })),
                                note: 'Preserving approvedNftIds for NFTs with is_mint === 0'
                            })
                            return newSet
                        })
                    } else {
                        setNfts([])
                        setApprovedNftIds(new Set())
                    }
                    
                    // Clear error and loading states
                    setError(null)
                    setIsLoading(false)
                } else {
                    console.log('[NFTSection] Ignoring NFTUpdate for different user:', nftUpdate.user_address)
                }
            }
        },
        onError: () => {
            // Silently handle WebSocket errors (backend may be offline)
            if (import.meta.env.DEV) {
                console.warn('[NFTSection] WebSocket unavailable (backend offline)')
            }
            // Don't show error to user, just stop loading
            setIsLoading(false)
        },
    })

    // ✅ After WebSocket connection succeeds, actively request initial data once (only on first connection)
    useEffect(() => {
            if (!address) {
                setNfts([])
            setIsLoading(false)
            hasRequestedInitialDataRef.current = false
                return
            }

        // Only request when WebSocket connected and initial data hasn't been requested yet
        if (wsStatus === 'connected' && !hasRequestedInitialDataRef.current) {
            hasRequestedInitialDataRef.current = true

            const fetchInitialNFTs = async () => {
            setIsLoading(true)
            setError(null)

            try {
                    // Use deprecated endpoint to get initial data (only for first load after WebSocket connection)
                const apiUrl = `/api/query-mint?user_address=${address}`
                    console.log('[NFTSection] Fetching initial NFTs after WebSocket connected:', apiUrl)
                
                const response = await fetch(apiUrl)
                if (!response.ok) {
                    const errorText = await response.text()
                    console.error('[NFTSection] API error:', response.status, errorText)
                    throw new Error(`Failed to fetch NFTs: ${response.status} ${response.statusText}`)
                }
                const data: NFTQueryResponse = await response.json()
                    console.log('[NFTSection] Initial API response:', data)
                console.log('[NFTSection] Found NFTs:', data.nfts?.length || 0)
                
                if (data.nfts && data.nfts.length > 0) {
                    setNfts(data.nfts)
                    // ✅ When NFT list updates, sync update approvedNftIds
                    // ⚠️ Important: only clear approve status of NFTs that entered minting process (is_mint !== 0)
                    // Preserve approve status of all NFTs with is_mint === 0
                    setApprovedNftIds(prev => {
                        const newSet = new Set<number>()
                        // Traverse new NFT list, preserve approve status of NFTs with is_mint === 0
                        data.nfts.forEach((nft: NFT) => {
                            if (nft.is_mint === 0 && prev.has(nft.nft_id)) {
                                newSet.add(nft.nft_id)
                            }
                        })
                        // ⚠️ Important: only preserve NFTs already in prev and with is_mint === 0 in new list
                        // Don't add new NFTs, only preserve existing authorization status
                        // This avoids erroneously adding all NFTs during initial load
                        console.log('[NFTSection] Initial load - approvedNftIds:', {
                            previous: [...prev],
                            new: [...newSet],
                            nftsInData: data.nfts.map((n: NFT) => ({ id: n.nft_id, is_mint: n.is_mint }))
                        })
                        return newSet
                    })
                } else {
                    setNfts([])
                    setApprovedNftIds(new Set())
                }
            } catch (err) {
                    console.error('[NFTSection] Failed to fetch initial NFTs:', err)
                setError(`Failed to load NFTs: ${err instanceof Error ? err.message : 'Unknown error'}`)
                setNfts([])
            } finally {
                setIsLoading(false)
            }
        }

            fetchInitialNFTs()
        }
    }, [wsStatus, address])  // Only trigger when WebSocket status or address changes

    // Log WebSocket connection status
    useEffect(() => {
        if (address) {
            console.log('[NFTSection] WebSocket status:', wsStatus, 'for user:', address)
        }
    }, [wsStatus, address])

    // Listen for transaction hash - get hash after wallet popup and user confirmation
    useEffect(() => {
        if (hash && mintingNftId) {
            console.log('[NFTSection] ✅ Transaction hash received:', hash)
            console.log('[NFTSection] ⏳ Waiting for transaction confirmation...')
            
            // Clear timeout timer (transaction submitted)
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
        }
    }, [hash, mintingNftId])
    
    // Listen for writeContract calls - set timeout handling
    useEffect(() => {
        // If waiting for wallet response (isWritePending), set timeout
        if (isWritePending && mintingNftId && !hash) {
            console.log('[NFTSection] ⏱️ Setting timeout for wallet response...')
            
            // Clear previous timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
            
            // Set new timeout: if no hash within 30 seconds, consider user rejected or wallet not responding
            timeoutRef.current = setTimeout(async () => {
                if (!hash && mintingNftId) {
                    console.warn('[NFTSection] ⚠️ Wallet timeout - no transaction hash after 30s')
                    
                    // Notify backend to rollback
                    try {
                        await fetch('/api/mint-failed', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_address: address,
                                nft_id: mintingNftId.toString(),
                                error: 'Wallet timeout: User may have rejected the transaction or wallet did not respond',
                            }),
                        })
                        console.log('[NFTSection] ✅ Notified backend about wallet timeout')
                    } catch (notifyErr) {
                        console.error('[NFTSection] ❌ Failed to notify backend:', notifyErr)
                    }
                    
                    alert('Wallet not responding or transaction rejected, backend has been notified to rollback state')
                    setMintingNftId(null)
                }
            }, 30000) // 30 second timeout
        }
        
        // Cleanup function: clear timeout on component unmount or state change
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
        }
    }, [isWritePending, mintingNftId, hash, address])

    // Associate events via transaction hash (method 1: recommended)
    const { associatedTransfer } = useEventAssociation(
        hash || undefined,
        isConfirmed // Only enable after transaction confirmed
    )

    // Listen for transaction confirmation success - refresh NFT list (continuous polling until backend status updates)
    useEffect(() => {
        if (isConfirmed && mintingNftId && address) {
            console.log('[NFTSection] ✅ Mint transaction confirmed, starting polling for backend state update')
            
            // If event association succeeds, display remark info
            if (associatedTransfer?.mintEvent) {
                console.log('[NFTSection] 📝 Mint event remark:', associatedTransfer.mintEvent.remark)
                console.log('[NFTSection] 🎫 Token ID:', associatedTransfer.mintEvent.tokenId.toString())
            }
            
            let retryCount = 0
            const maxRetries = 60 // Maximum 60 polls (about 3 minutes)
            let pollingInterval: NodeJS.Timeout | null = null
            
            // Refresh NFT list - continuous polling until backend status updates to is_mint === 2
            const fetchNFTs = async () => {
                try {
                    const apiUrl = `/api/query-mint?user_address=${address}`
                    const res = await fetch(apiUrl)
                    if (res.ok) {
                        const result = await res.json()
                        if (result.nfts) {
                            setNfts(result.nfts)
                            // ✅ Sync update approvedNftIds (clear approve status of NFTs that entered minting process)
                            // ⚠️ Important: only clear approve status of NFTs that entered minting process (is_mint !== 0)
                            // Preserve approve status of all NFTs with is_mint === 0
                            setApprovedNftIds(prev => {
                                const newSet = new Set<number>()
                                // Traverse new NFT list, preserve approve status of NFTs with is_mint === 0
                                result.nfts.forEach((nft: NFT) => {
                                    if (nft.is_mint === 0 && prev.has(nft.nft_id)) {
                                        newSet.add(nft.nft_id)
                                    }
                                })
                                // ⚠️ Important: only preserve NFTs already in prev and with is_mint === 0 in new list
                                // Don't add new NFTs, only preserve existing authorization status
                                // This avoids erroneously adding all NFTs during polling update
                                return newSet
                            })
                            // Check backend status
                            const mintedNft = result.nfts.find((n: NFT) => n.nft_id === mintingNftId)
                            if (mintedNft) {
                                if (mintedNft.is_mint === 2) {
                                    // Backend status updated to minted, clear mintingNftId and stop polling
                                    console.log('[NFTSection] ✅ Backend state updated to is_mint=2, clearing mintingNftId')
                                setMintingNftId(null)
                                    // ✅ Clear this NFT's approve status (minting completed)
                                    setApprovedNftIds(prev => {
                                        const newSet = new Set(prev)
                                        newSet.delete(mintingNftId!)
                                        return newSet
                                    })
                                    if (pollingInterval) {
                                        clearInterval(pollingInterval)
                                        pollingInterval = null
                                    }
                                    return
                                } else if (mintedNft.is_mint === 1) {
                                    // Backend status still minting, continue polling
                                    retryCount++
                                    if (retryCount < maxRetries) {
                                        console.log(`[NFTSection] ⏳ Backend state still is_mint=1 (retry ${retryCount}/${maxRetries}), will retry in 3 seconds`)
                                    } else {
                                        console.warn('[NFTSection] ⚠️ Max retries reached, stopping polling')
                                        if (pollingInterval) {
                                            clearInterval(pollingInterval)
                                            pollingInterval = null
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('[NFTSection] Failed to refresh NFTs:', err)
                    retryCount++
                    if (retryCount >= maxRetries) {
                        console.warn('[NFTSection] ⚠️ Max retries reached after error, stopping polling')
                        if (pollingInterval) {
                            clearInterval(pollingInterval)
                            pollingInterval = null
                        }
                    }
                }
            }
            
            // Execute immediately once, then poll every 3 seconds
            fetchNFTs()
            pollingInterval = setInterval(() => {
                fetchNFTs()
            }, 3000)
            
            // Cleanup function: clear polling on component unmount or state change
            return () => {
                if (pollingInterval) {
                    clearInterval(pollingInterval)
                    pollingInterval = null
                }
            }
        }
    }, [isConfirmed, mintingNftId, address, associatedTransfer])

    // Listen for burn transaction confirmation success - refresh NFT list
    useEffect(() => {
        if (isBurnConfirmed && burningNftId && address) {
            console.log('[NFTSection] ✅ Burn transaction confirmed, refreshing NFT list')
            
            // Refresh NFT list
            const fetchNFTs = async () => {
                try {
                    const apiUrl = `/api/query-mint?user_address=${address}`
                    const res = await fetch(apiUrl)
                    if (res.ok) {
                        const result = await res.json()
                        if (result.nfts) {
                            setNfts(result.nfts)
                            // ✅ Sync update approvedNftIds
                            setApprovedNftIds(prev => {
                                const newSet = new Set<number>()
                                result.nfts.forEach((nft: NFT) => {
                                    if (nft.is_mint === 0 && prev.has(nft.nft_id)) {
                                        newSet.add(nft.nft_id)
                                    }
                                })
                                return newSet
                            })
                            // Clear burningNftId
                            setBurningNftId(null)
                        }
                    }
                } catch (err) {
                    console.error('[NFTSection] Failed to refresh NFTs after burn:', err)
                }
            }
        fetchNFTs()
        }
    }, [isBurnConfirmed, burningNftId, address])

    // Listen for transaction failure - call backend rollback endpoint
    useEffect(() => {
        if (writeError && mintingNftId && address) {
            console.error('[NFTSection] ❌ Mint transaction failed:', writeError)
            
            // ✅ Parse error message, provide friendly hint
            let errorMessage = 'Minting failed'
            
            // Check if gas estimation error
            if (writeError.message.includes('estimateGas') || writeError.message.includes('execution reverted')) {
                // Try to decode error message from error data
                const errorData = (writeError as any).data
                if (errorData) {
                    // Check if custom error
                    if (typeof errorData === 'string' && errorData.startsWith('0x')) {
                        // Try to decode common errors
                        const errorSelector = errorData.slice(0, 10) // First 4 bytes are error selector
                        
                        console.log('[NFTSection] Error selector:', errorSelector)
                        console.log('[NFTSection] Error data:', errorData)
                        
                        // 0xe450d38c might be insufficient balance or insufficient authorization error
                        if (errorSelector === '0xe450d38c') {
                            try {
                                // Extract parameters from error data (address, uint256, uint256)
                                const address = '0x' + errorData.slice(26, 66)
                                const uint256_1 = BigInt('0x' + errorData.slice(66, 130))
                                const uint256_2 = BigInt('0x' + errorData.slice(130, 194))
                                
                                console.log('[NFTSection] Decoded error data:', {
                                    selector: errorSelector,
                                    address,
                                    uint256_1: uint256_1.toString(),
                                    uint256_2: uint256_2.toString(),
                                })
                                
                                // Determine possible error type based on values
                                // If uint256_2 > uint256_1, might be "insufficient balance" or "insufficient authorization" error
                                if (uint256_2 > uint256_1) {
                                    errorMessage = `Minting failed: Insufficient HakuToken balance or authorization\n\n` +
                                        `Required: ${formatUnits(uint256_2, 18)} HakuToken\n` +
                                        `Current: ${formatUnits(uint256_1, 18)} HakuToken\n\n` +
                                        `Suggestions:\n` +
                                        `1. Check HakuToken balance in your wallet\n` +
                                        `2. Confirm authorization is complete (click "Mint")\n` +
                                        `3. If already authorized, refresh the page and try again`
                                } else {
                                    errorMessage = `Minting failed: Unknown error (Error code: ${errorSelector})\n\nPlease contact administrator.`
                                }
                            } catch (decodeErr) {
                                console.error('[NFTSection] Failed to decode error data:', decodeErr)
                                errorMessage = `Minting failed: Gas estimation failed\n\nPossible causes:\n` +
                                    `1. Insufficient HakuToken balance\n` +
                                    `2. Insufficient authorization amount\n` +
                                    `3. Contract parameter error\n\n` +
                                    `Suggestion: Check balance and authorization then retry.`
                            }
                        } else if (errorSelector === '0x08c379a0') {
                            // This is a string error (Error(string))
                            errorMessage = `Minting failed: ${writeError.message}`
                        } else {
                            errorMessage = `Minting failed: Gas estimation failed\n\nPossible causes:\n` +
                                `1. Insufficient or expired authorization\n` +
                                `2. Contract state has changed\n` +
                                `3. Parameter error\n\n` +
                                `Suggestion: Refresh page and re-authorize then retry.`
                        }
                    } else {
                        errorMessage = `Minting failed: ${writeError.message}`
                    }
                } else {
                    errorMessage = `Minting failed: ${writeError.message}`
                }
            } else {
                errorMessage = `Minting failed: ${writeError.message}`
            }
            
            // Call backend rollback endpoint
            const notifyMintFailed = async () => {
                try {
                    await fetch('/api/mint-failed', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_address: address,
                            nft_id: mintingNftId,
                            error: writeError.message || 'Transaction failed',
                        }),
                    })
                    console.log('[NFTSection] ✅ Notified backend about mint failure')
                } catch (err) {
                    console.error('[NFTSection] ❌ Failed to notify backend:', err)
                }
            }
            notifyMintFailed()
            
            alert(errorMessage)
            setMintingNftId(null)
        }
    }, [writeError, mintingNftId, address])

    // ✅ When user address changes, clear all states (including approvedNftIds)
    useEffect(() => {
        if (!address) {
            setNfts([])
            setApprovedNftIds(new Set())
            setMintingNftId(null)
            setApprovingNftId(null)
            setBurningNftId(null)
        }
    }, [address])

    if (!address) {
        return (
            <div>
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    My NFTs
                    <span 
                        onClick={onViewAll}
                        className="text-xs font-normal text-blue-400 cursor-pointer hover:underline"
                    >
                        view all
                    </span>
                </h3>
                <div className="text-center text-gray-500 py-10">
                    Please connect your wallet to view NFTs
                </div>
            </div>
        )
    }

    // Copy contract address feature
    const [copied, setCopied] = useState(false)
    const handleCopyContractAddress = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault()
        e.stopPropagation()
        
        try {
            const contractAddress = CONTRACTS.HUKU_NFT
            console.log('[NFTSection] Copying contract address:', contractAddress)
            
            // Use Clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(contractAddress)
                console.log('[NFTSection] ✅ Contract address copied successfully')
            } else {
                // Fallback: use traditional method
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
                console.log('[NFTSection] ✅ Contract address copied (fallback method)')
            }
            
            // Update state to show feedback
            setCopied(true)
            setTimeout(() => {
                setCopied(false)
                console.log('[NFTSection] Copy feedback reset')
            }, 2000) // Restore after 2 seconds
        } catch (err) {
            console.error('[NFTSection] ❌ Failed to copy:', err)
            // Show feedback even on failure, let user know they clicked
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    return (
        <div>
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                My NFTs
                <button
                    onClick={handleCopyContractAddress}
                    className="flex items-center justify-center text-xs text-gray-400 hover:text-gray-300 transition-all duration-200"
                    title={copied ? "Copied" : CONTRACTS.HUKU_NFT}
                    type="button"
                >
                    {copied ? (
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    )}
                </button>
                <span 
                    onClick={onViewAll}
                    className="text-xs font-normal text-blue-400 cursor-pointer hover:underline"
                >
                    view all
                </span>
            </h3>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
            ) : error ? (
                <div className="alert alert-error">
                    <span>{error}</span>
                </div>
            ) : nfts.length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                    <div>No NFTs found</div>
                    <div className="text-xs mt-2 text-gray-600">
                        Address: {address?.slice(0, 6)}...{address?.slice(-4)}
                    </div>
                    <div className="text-xs mt-1 text-gray-600">
                        Check browser console for API response details
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    {nfts.map((nft) => {
                        const isApproved = approvedNftIds.has(nft.nft_id)
                        const canMint = nft.all_chips_owned && nft.is_mint === 0
                        console.log(`[NFTSection] Rendering NFT #${nft.nft_id}:`, {
                            isApproved,
                            canMint,
                            approvedNftIds: [...approvedNftIds],
                            button: isApproved && canMint ? 'Mint NFT' : canMint ? 'Mint' : 'N/A'
                        })
                        return (
                            <div
                                key={nft.nft_id}
                                className="bg-[#1a1b23] rounded-xl overflow-hidden border border-gray-800 hover:border-gray-600 transition-all group"
                            >
                                <NFTImageReveal nft={nft} />
                            <div className="p-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-white font-bold text-sm truncate flex items-center gap-1">
                                        <span>NFT</span>
                                        {nft.token_id && (
                                            <span className="text-yellow-400">#{nft.token_id}</span>
                                        )}
                                        {nft.is_mint === 2 && (
                                            <span className="ml-2 text-xs text-yellow-400 flex items-center gap-1">
                                                <span>⭐</span>
                                                <span>Minted</span>
                                            </span>
                                        )}
                                        {nft.all_chips_owned && nft.is_mint !== 2 && (
                                            <span className="ml-2 text-xs text-green-400">✓ Complete</span>
                                        )}
                                    </div>
                                    <div className="text-gray-400 text-xs flex-shrink-0 ml-2">
                                        ID: {nft.nft_id}
                                    </div>
                                </div>
                                <div className="text-gray-400 text-xs mt-1">
                                    {nft.owned_chips_count} / {nft.total_chips_count} chips
                                </div>
                                <div className="flex gap-2 mt-2">
                                    {/* When is_mint === 2, show burn button */}
                                    {nft.is_mint === 2 && nft.token_id ? (
                                                <button
                                                    onClick={async () => {
                                                if (!address || !nft.token_id) {
                                                            alert('Please connect wallet first')
                                                            return
                                                        }
                                                        
                                                try {
                                                    setBurningNftId(nft.nft_id)
                                                    const tokenId = BigInt(nft.token_id)
                                                    
                                                    console.log(`[NFTSection] 🔥 Checking ownership for NFT #${nft.nft_id} (tokenId: ${tokenId})`)
                                                    
                                                    // Note: burn doesn't need approve, only requires user is owner
                                                    // ERC721Burnable's burn function automatically checks permissions
                                                    console.log(`[NFTSection] ✅ Calling userBurn (contract will verify ownership)...`)
                                                            
                                                    writeBurnContract({
                                                        address: CONTRACTS.HUKU_NFT,
                                                        abi: HUKU_NFT_ABI,
                                                        functionName: 'userBurn',
                                                        args: [tokenId],
                                                            })
                                                        } catch (err) {
                                                    console.error('[NFTSection] ❌ Failed to burn NFT:', err)
                                                    setBurningNftId(null)
                                                    
                                                    let errorMessage = 'Burn failed: '
                                                    if (err instanceof Error) {
                                                        errorMessage += err.message
                                                        // Check if it's a permission error
                                                        if (err.message.includes('ERC721InsufficientApproval') || err.message.includes('ERC721InsufficientApproval')) {
                                                            errorMessage = 'You do not have permission to burn this NFT (not owner or not approved)'
                                                        } else if (err.message.includes('ERC721NonexistentToken')) {
                                                            errorMessage = 'This NFT does not exist or has been destroyed'
                                                        }
                                                    } else {
                                                        errorMessage += 'Unknown error'
                                                    }
                                                    alert(errorMessage)
                                                        }
                                                    }}
                                            disabled={burningNftId === nft.nft_id || isBurnPending || isBurnConfirming}
                                                    className={`flex-1 text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1 ${
                                                burningNftId === nft.nft_id || isBurnPending || isBurnConfirming
                                                    ? 'bg-orange-600/20 text-orange-400 border border-orange-600/50 cursor-default'
                                                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                                                    }`}
                                                >
                                            {burningNftId === nft.nft_id || isBurnPending || isBurnConfirming ? (
                                                isBurnConfirming ? (
                                                    <>
                                                        <span className="loading loading-spinner loading-xs"></span>
                                                        <span>Confirming…</span>
                                                    </>
                                                ) : isBurnPending ? (
                                                    <>
                                                        <span className="loading loading-spinner loading-xs"></span>
                                                        <span>Awaiting wallet confirmation...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="loading loading-spinner loading-xs"></span>
                                                        <span>Burning...</span>
                                                    </>
                                                )
                                            ) : (
                                                <>
                                                    <span>🔥</span>
                                                    <span>Burn</span>
                                                </>
                                            )}
                                                </button>
                                    ) : nft.all_chips_owned && nft.is_mint === 0 ? (
                                        <>
                                            {/* ✅ Independent management for each NFT: only show button for NFTs with all_chips_owned === true and is_mint === 0 */}
                                            {/* ✅ Button state based on: whether this NFT is approved (approvedNftIds) */}
                                            {/* Status order: Mint (NFT not approved) > Mint NFT (NFT approved) */}
                                            {/* ✅ Key logic: only NFTs that actually clicked "Mint" and completed authorization show "Mint NFT" button */}
                                            {/* ✅ Other eligible NFTs should continue showing "Mint", even if global allowance is sufficient */}
                                            {/* ✅ Button display logic: only NFTs in approvedNftIds show "Mint NFT" button */}
                                            {(() => {
                                                const isApproved = approvedNftIds.has(nft.nft_id)
                                                if (process.env.NODE_ENV === 'development') {
                                                    console.log(`[NFTSection] Button logic for NFT #${nft.nft_id}:`, {
                                                        isApproved,
                                                        approvedNftIds: [...approvedNftIds],
                                                        willShowMintButton: isApproved
                                                    })
                                                }
                                                return isApproved
                                            })() ? (
                                                /* ✅ If this NFT is in approvedNftIds (authorized), show Mint button */
                                                <>
                                                <button
                                                    onClick={async () => {
                                                                // Ensure is_mint === 0 before minting
                                                if (mintingNftId === nft.nft_id || nft.is_mint !== 0) return
                                                
                                                // Check allowance again (prevent allowance changed when clicking)
                                                try {
                                                    const currentAllowance = await refetchAllowance()
                                                    const currentAllowanceValue = currentAllowance.data
                                                    
                                                    if (!mintPrice || !currentAllowanceValue) {
                                                        alert('Unable to get authorization info, please refresh page and retry')
                                                        return
                                                    }
                                                    
                                                    const mintPriceBigInt = typeof mintPrice === 'bigint' ? mintPrice : BigInt(String(mintPrice))
                                                    if (currentAllowanceValue < mintPriceBigInt) {
                                                                        alert(`Insufficient authorization! Current allowance: ${currentAllowanceValue.toString()}, Required: ${mintPriceBigInt.toString()}. Please click the "Mint" button first.`)
                                                        return
                                                    }
                                                } catch (allowanceCheckErr) {
                                                    console.error('[NFTSection] Failed to check allowance:', allowanceCheckErr)
                                                    alert('Error checking authorization, please refresh page and retry')
                                                    return
                                                }
                                                
                                                setMintingNftId(nft.nft_id)
                                                
                                                try {
                                                    // Step 1: Call backend validation endpoint to get contract parameters
                                                    console.log('[NFTSection] 🔍 Verifying mint eligibility...')
                                                    const verifyResponse = await fetch('/api/verify-mint-eligibility', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            user_address: address,
                                                            nft_id: nft.nft_id.toString(),
                                                        }),
                                                    })
                                                    
                                                    if (!verifyResponse.ok) {
                                                        const errorText = await verifyResponse.text()
                                                        throw new Error(`Verification failed: ${errorText}`)
                                                    }
                                                    
                                                    const verifyData: MintEligibilityResponse = await verifyResponse.json()
                                                    console.log('[NFTSection] ✅ Verification response:', verifyData)
                                                    
                                                    if (!verifyData.eligible) {
                                                        alert(verifyData.message || 'Minting eligibility verification failed')
                                                        setMintingNftId(null)
                                                        return
                                                    }
                                                    
                                                    // ✅ Mark this NFT entered minting process, clear approve status (because is_mint will become 1)
                                                    setApprovedNftIds(prev => {
                                                        const newSet = new Set(prev)
                                                        newSet.delete(nft.nft_id)
                                                        return newSet
                                                    })
                                                    
                                                    // Step 2: Extract contract parameters from validation response
                                                    const tokenIdNum = verifyData.uint256_param || (verifyData.token_id ? parseInt(verifyData.token_id.replace('.png', '')) : 0)
                                                    const remark = verifyData.token_id || nft.nft_id.toString()
                                                    
                                                    console.log('[NFTSection] 📝 Contract params:', {
                                                        to: address,
                                                        remark,
                                                        tokenURL: tokenIdNum,
                                                    })
                                                    
                                                    // Step 3: Call user wallet to execute contract
                                                    console.log('[NFTSection] 🚀 Calling safeMint from user wallet...')
                                                    console.log('[NFTSection] Contract details:', {
                                                        address: CONTRACTS.HUKU_NFT,
                                                        functionName: 'safeMint',
                                                        args: [address, remark, tokenIdNum],
                                                    })
                                                    
                                                    // writeContract will trigger wallet popup
                                                    // Note: writeContract may not throw error immediately, need to track status via writeError and hash
                                                    // Timeout handling done by useEffect monitoring isWritePending and hash
                                                    try {
                                                        writeContract({
                                                            address: CONTRACTS.HUKU_NFT as `0x${string}`,
                                                            abi: HUKU_NFT_ABI,
                                                            functionName: 'safeMint',
                                                            args: [address as `0x${string}`, remark, BigInt(tokenIdNum)],
                                                        })
                                                        console.log('[NFTSection] ✅ writeContract called successfully, waiting for wallet popup...')
                                                    } catch (contractErr) {
                                                        console.error('[NFTSection] ❌ writeContract threw error:', contractErr)
                                                        throw contractErr
                                                    }
                                                    
                                                } catch (err) {
                                                    console.error('[NFTSection] ❌ Mint process failed:', err)
                                                    alert(`Minting failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
                                                    
                                                    // Notify backend to rollback
                                                    try {
                                                        await fetch('/api/mint-failed', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                user_address: address,
                                                                nft_id: nft.nft_id,
                                                                error: err instanceof Error ? err.message : 'Unknown error',
                                                            }),
                                                        })
                                                    } catch (notifyErr) {
                                                        console.error('[NFTSection] ❌ Failed to notify backend:', notifyErr)
                                                    }
                                                    
                                                    setMintingNftId(null)
                                                }
                                            }}
                                                            disabled={mintingNftId === nft.nft_id && (isWritePending || isConfirming)}
                                            className={`flex-1 text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1 ${
                                                                mintingNftId === nft.nft_id
                                                    ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/50 cursor-default'
                                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                            }`}
                                        >
                                                            {mintingNftId === nft.nft_id ? (
                                                                // In minting process, show detailed status
                                                isConfirming ? (
                                                    <>
                                                        <span className="loading loading-spinner loading-xs"></span>
                                                        <span>Confirming...</span>
                                                    </>
                                                ) : hash ? (
                                                    <>
                                                        <span className="loading loading-spinner loading-xs"></span>
                                                        <span>Minting...</span>
                                                    </>
                                                ) : isWritePending ? (
                                                    <>
                                                        <span className="loading loading-spinner loading-xs"></span>
                                                        <span>Awaiting wallet confirmation...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="loading loading-spinner loading-xs"></span>
                                                        <span>Processing...</span>
                                                    </>
                                                )
                                            ) : (
                                                <span>Mint NFT</span>
                                            )}
                                        </button>
                                        
                                        {/* ✅ Revoke authorization button: only show when this NFT is authorized */}
                                        {approvedNftIds.has(nft.nft_id) && allowance !== undefined && allowance !== null && allowance > 0n && (
                                            <button
                                                onClick={async () => {
                                                    if (!address) {
                                                        alert('Please connect wallet first')
                                                        return
                                                    }
                                                    
                                                    // Confirm revoke authorization
                                                    const confirmed = window.confirm(
                                                        `Are you sure you want to revoke authorization?\n\nThis will set allowance to 0. You will need to re-authorize before minting any NFT.`
                                                    )
                                                    
                                                    if (!confirmed) {
                                                        return
                                                    }
                                                    
                                                    setRevokingNftId(nft.nft_id)
                                                    
                                                    try {
                                                        console.log('[NFTSection] Revoking allowance (setting to 0)...')
                                                        
                                                        // Set allowance to 0 to revoke authorization
                                                        writeRevokeContract({
                                                            address: CONTRACTS.TOKEN_B,
                                                            abi: ERC20_ABI,
                                                            functionName: 'approve',
                                                            args: [CONTRACTS.HUKU_NFT, 0n],
                                                        })
                                                        console.log('[NFTSection] Revoke transaction sent')
                                                    } catch (err) {
                                                        console.error('[NFTSection] Revoke failed:', err)
                                                        alert(`Revoke authorization failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
                                                        setRevokingNftId(null)
                                                    }
                                                }}
                                                disabled={revokingNftId === nft.nft_id && (isRevokeConfirming || isRevokePending)}
                                                className={`text-xs py-2 px-2 rounded-lg transition-colors flex items-center justify-center gap-1 ${
                                                    revokingNftId === nft.nft_id && (isRevokeConfirming || isRevokePending)
                                                        ? 'bg-red-600/20 text-red-400 border border-red-600/50 cursor-default'
                                                        : 'bg-red-600 hover:bg-red-700 text-white'
                                                }`}
                                                title="Revoke all authorization (set allowance to 0)"
                                                style={{ minWidth: 'auto', flexShrink: 0 }}
                                            >
                                                {revokingNftId === nft.nft_id && (isRevokeConfirming || isRevokePending)
                                                    ? 'Revoking...'
                                                    : 'Revoke'}
                                        </button>
                                            )}
                                        </>
                                            ) : (
                                                /* ✅ If this NFT is not in approvedNftIds, always show "Mint" button (regardless of global allowance) */
                                                <>
                                                    {/* Mint button */}
                                                    <button
                                                        onClick={async () => {
                                                            if (!address || !mintPrice || !tokenBDecimals) {
                                                                alert('Please connect wallet first')
                                                                return
                                                            }
                                                            
                                                            setApprovingNftId(nft.nft_id)
                                                            
                                                            try {
                                                                // ✅ Precise to single NFT: only approve current NFT's mintPrice (each mint approves separatelyprove）
                                                                if (!mintPrice) {
                                                                    alert('Unable to get mintPrice, please refresh page and retry')
                                                                    setApprovingNftId(null)
                                                                    return
                                                                }
                                                                
                                                                const mintPriceBigInt = typeof mintPrice === 'bigint' 
                                                                    ? mintPrice 
                                                                    : BigInt(String(mintPrice))
                                                                
                                                                console.log('[NFTSection] Approving HakuToken for specific NFT...', {
                                                                    nft_id: nft.nft_id,
                                                                    mintPrice: mintPriceBigInt.toString(),
                                                                    spender: CONTRACTS.HUKU_NFT,
                                                                    note: 'Only approving amount for this specific NFT',
                                                                })
                                                                
                                                                writeApproveContract({
                                                                    address: CONTRACTS.TOKEN_B,
                                                                    abi: ERC20_ABI,
                                                                    functionName: 'approve',
                                                                    args: [CONTRACTS.HUKU_NFT, mintPriceBigInt],
                                                                })
                                                                console.log('[NFTSection] Approve transaction sent')
                                                            } catch (err) {
                                                                console.error('[NFTSection] Approve failed:', err)
                                                                alert(`Approve failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
                                                                setApprovingNftId(null)
                                                            }
                                                        }}
                                                        disabled={approvingNftId === nft.nft_id && (isApproveConfirming || isApprovePending)}
                                                        className={`flex-1 text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1 ${
                                                            approvingNftId === nft.nft_id && (isApproveConfirming || isApprovePending)
                                                                ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/50 cursor-default'
                                                                : 'bg-yellow-500 hover:bg-yellow-600 text-black font-semibold'
                                                        }`}
                                                    >
                                                        {approvingNftId === nft.nft_id && (isApproveConfirming || isApprovePending)
                                                                    ? 'Authorizing...'
                                                                    : `Mint`}
                                                    </button>
                                                    
                                                    {/* ⚠️ Unauthorized NFTs don't show "Revoke Authorization" button */}
                                                </>
                                            )}
                                        </>
                                    ) : nft.is_mint === 1 ? (
                                        /* ✅ Independent management for each NFT: NFTs with is_mint === 1 show "Minting..." button */
                                        <button
                                            disabled={true}
                                            className="flex-1 text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1 bg-yellow-600/20 text-yellow-400 border border-yellow-600/50 cursor-default"
                                        >
                                            <span className="loading loading-spinner loading-xs"></span>
                                            <span>Minting...</span>
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
