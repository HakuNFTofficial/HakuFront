import { useAccount, useBalance, useReadContract } from 'wagmi'
import { formatEther, formatUnits } from 'viem'
import { CONTRACTS, ERC20_ABI } from '../config/contracts'

/**
 * Wallet Balance Component - Similar to blockchain explorer's balance display
 * 
 * Blockchain explorer mechanism:
 * 1. Native token balance (ETH/STT): Uses RPC call eth_getBalance(address)
 * 2. ERC20 token balance: Calls balanceOf(address) on token contract
 * 
 * This component implements the same functionality using wagmi hooks
 */
export function WalletBalance() {
    const { address, isConnected } = useAccount()

    // 1. Query native token balance (STT) - corresponds to eth_getBalance in blockchain explorer
    const { data: nativeBalance, isLoading: isLoadingNative } = useBalance({
        address: address,
        query: {
            enabled: isConnected && !!address,
            refetchInterval: 5000, // Refresh every 5 seconds
        },
    })

    // 2. Query TokenB balance (ERC20) - corresponds to balanceOf(address) in blockchain explorer
    const { data: tokenBBalance, isLoading: isLoadingTokenB } = useReadContract({
        address: CONTRACTS.TOKEN_B,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: {
            enabled: isConnected && !!address,
            refetchInterval: 5000,
        },
    })

    // Get TokenB token information
    const { data: tokenBSymbol } = useReadContract({
        address: CONTRACTS.TOKEN_B,
        abi: ERC20_ABI,
        functionName: 'symbol',
    })

    // Dynamically read TokenB decimals
    const { data: tokenBDecimals } = useReadContract({
        address: CONTRACTS.TOKEN_B,
        abi: ERC20_ABI,
        functionName: 'decimals',
    })

    if (!isConnected || !address) {
        return null
    }

    const nativeBalanceFormatted = nativeBalance ? formatEther(nativeBalance.value) : '0'
    // Use dynamically read decimals, default to 18 if read fails
    const tokenBBalanceFormatted = tokenBBalance ? formatUnits(tokenBBalance, tokenBDecimals ?? 18) : '0'

    return (
        <div className="w-full bg-[#1a1b23] rounded-2xl p-4 shadow-2xl border border-gray-800">
            <div className="space-y-3">
                {/* Native token balance (STT) */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            STT
                        </div>
                        <div className="text-white text-sm font-medium">STT</div>
                    </div>
                    <div className="text-right">
                        {isLoadingNative ? (
                            <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                            <div className="text-white font-semibold text-sm">
                                {parseFloat(nativeBalanceFormatted).toFixed(4)}
                            </div>
                        )}
                    </div>
                </div>

                {/* TokenB balance */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {(tokenBSymbol as string)?.slice(0, 2) || 'TB'}
                        </div>
                        <div className="text-white text-sm font-medium">
                            {(tokenBSymbol as string) || 'TokenB'}
                        </div>
                    </div>
                    <div className="text-right">
                        {isLoadingTokenB ? (
                            <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                            <div className="text-white font-semibold text-sm">
                                {parseFloat(tokenBBalanceFormatted).toFixed(4)}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

