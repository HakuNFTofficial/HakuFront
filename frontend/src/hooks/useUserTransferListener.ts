import { useWatchContractEvent, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { CONTRACTS, ERC20_ABI } from '../config/contracts'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`

/**
 * Hook: Listen for HakuToken user transfer events (excluding mint/burn)
 * 
 * Uses standard ERC20 Transfer events, filtering out mint/burn operations on the client side
 * 
 * @param onUserTransfer User transfer callback function
 * @param options Optional configuration
 */
export function useUserTransferListener(
  onUserTransfer?: (params: {
    from: string
    to: string
    amount: string // Formatted amount
    amountRaw: bigint // Raw amount (wei)
    blockNumber: bigint
    transactionHash: string
  }) => void,
  options?: {
    enabled?: boolean // Whether to enable listening, defaults to true
    tokenAddress?: `0x${string}` // Token address, defaults to CONTRACTS.TOKEN_B
    decimals?: number // Decimal places for formatting amount (automatically fetched if not provided)
  }
) {
  const {
    enabled = true,
    tokenAddress = CONTRACTS.TOKEN_B,
    decimals: providedDecimals,
  } = options || {}

  // Dynamically read decimals (if not provided)
  const { data: tokenDecimals } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: enabled && providedDecimals === undefined,
    },
  })

  // Use provided decimals or read decimals, defaults to 18
  const decimals = providedDecimals ?? (tokenDecimals as number | undefined) ?? 18

  // Listen for Transfer events
  useWatchContractEvent({
    address: tokenAddress,
    abi: ERC20_ABI,
    eventName: 'Transfer',
    enabled: enabled && (providedDecimals !== undefined || tokenDecimals !== undefined),
    onLogs: (logs) => {
      logs.forEach((log) => {
        const { from, to, value } = log.args

        // Filter out mint (from == 0x0) and burn (to == 0x0)
        if (
          !from ||
          !to ||
          from.toLowerCase() === ZERO_ADDRESS.toLowerCase() ||
          to.toLowerCase() === ZERO_ADDRESS.toLowerCase()
        ) {
          return // Skip mint/burn
        }

        // This is a user transfer, trigger callback
        if (onUserTransfer && value !== undefined) {
          const amountFormatted = formatUnits(value, decimals)
          onUserTransfer({
            from: from.toLowerCase(),
            to: to.toLowerCase(),
            amount: amountFormatted,
            amountRaw: value,
            blockNumber: log.blockNumber || 0n,
            transactionHash: log.transactionHash || '',
          })
        }
      })
    },
  })
}

