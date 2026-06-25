import { useEffect, useState } from 'react'
import { usePublicClient } from 'wagmi'
import { associateEventsByTxHash, type AssociatedTransfer } from '../utils/eventAssociator'

/**
 * Hook: Associate events by transaction hash (Method 1: Recommended)
 * 
 * After transaction confirmation, automatically get transaction receipt and associate Transfer and HakuTokenTransferForMint events
 * 
 * @param txHash Transaction hash (optional)
 * @param enabled Whether to enable association, defaults to true
 * @returns Associated transfer information
 */
export function useEventAssociation(
  txHash: `0x${string}` | undefined,
  enabled: boolean = true
) {
  const publicClient = usePublicClient()
  const [associatedTransfer, setAssociatedTransfer] = useState<AssociatedTransfer | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!txHash || !enabled || !publicClient) {
      setAssociatedTransfer(null)
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    const fetchAndAssociate = async () => {
      setIsLoading(true)
      setError(null)

      try {
        console.log('[useEventAssociation] 🔍 Associating events for txHash:', txHash)
        const result = await associateEventsByTxHash(publicClient, txHash)

        if (cancelled) return

        if (result) {
          setAssociatedTransfer(result)
          console.log('[useEventAssociation] ✅ Events associated successfully:', {
            from: result.transfer.from,
            to: result.transfer.to,
            value: result.transfer.value.toString(),
            hasRemark: !!result.mintEvent,
            remark: result.mintEvent?.remark,
          })
        } else {
          setAssociatedTransfer(null)
          console.warn('[useEventAssociation] ⚠️ No Transfer event found in transaction')
        }
      } catch (err) {
        if (cancelled) return
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        console.error('[useEventAssociation] ❌ Failed to associate events:', error)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchAndAssociate()

    return () => {
      cancelled = true
    }
  }, [txHash, enabled, publicClient])

  return {
    associatedTransfer,
    isLoading,
    error,
  }
}

