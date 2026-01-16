import { decodeEventLog, getEventSelector, type Log, type Address, type PublicClient } from 'viem'
import { CONTRACTS } from '../config/contracts'

/**
 * Transfer event (ERC20 standard)
 * keccak256("Transfer(address,address,uint256)")
 */
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const

/**
 * HakuNFTMint event ABI (for calculating signature and parsing)
 */
const HAKU_NFT_MINT_EVENT_ABI = {
  type: 'event',
  name: 'HakuNFTMint',
  inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'value', type: 'uint256', indexed: false },
    { name: 'tokenId', type: 'uint256', indexed: true },
    { name: 'remark', type: 'string', indexed: false },
  ],
} as const

/**
 * Calculate HakuNFTMint event signature
 */
const HAKU_NFT_MINT_EVENT_SIGNATURE = getEventSelector(HAKU_NFT_MINT_EVENT_ABI)

/**
 * Associated transfer information (including remark)
 */
export interface AssociatedTransfer {
  // Transfer event information
  transfer: {
    from: Address
    to: Address
    value: bigint
    transactionHash: string
    blockNumber: bigint
  }
  // HakuNFTMint event information (including remark)
  mintEvent?: {
    tokenId: bigint
    remark: string
  }
}

/**
 * Get and associate events by transaction hash
 * 
 * @param publicClient viem PublicClient instance
 * @param txHash Transaction hash
 * @returns Associated transfer information, returns null if Transfer event is not found
 */
export async function associateEventsByTxHash(
  publicClient: PublicClient,
  txHash: `0x${string}`
): Promise<AssociatedTransfer | null> {
  try {
    // 1. Get transaction receipt
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash })
    
    if (!receipt || !receipt.logs || receipt.logs.length === 0) {
      console.warn('[EventAssociator] No logs found in transaction receipt')
      return null
    }

    console.log('[EventAssociator] 📋 Transaction receipt logs:', receipt.logs.length)

    // 2. Find Transfer event (from HakuToken)
    const transferLog = receipt.logs.find((log: Log) => {
      return (
        log.address?.toLowerCase() === CONTRACTS.TOKEN_B.toLowerCase() &&
        log.topics[0] === TRANSFER_EVENT_SIGNATURE
      )
    })

    if (!transferLog) {
      console.warn('[EventAssociator] Transfer event not found')
      return null
    }

    // 3. Decode Transfer event
    const transferDecodedResult = decodeEventLog({
      abi: [
        {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { name: 'from', type: 'address', indexed: true },
            { name: 'to', type: 'address', indexed: true },
            { name: 'value', type: 'uint256', indexed: false },
          ],
        },
      ],
      data: transferLog.data,
      topics: transferLog.topics,
    })
    const transferDecoded = transferDecodedResult.args as { from: Address; to: Address; value: bigint }

    console.log('[EventAssociator] ✅ Transfer event decoded:', {
      from: transferDecoded.from,
      to: transferDecoded.to,
      value: transferDecoded.value.toString(),
    })

    // 4. Find HakuNFTMint event (from HukuNFT)
    const mintEventLog = receipt.logs.find((log: Log) => {
      return (
        log.address?.toLowerCase() === CONTRACTS.HUKU_NFT.toLowerCase() &&
        log.topics[0] === HAKU_NFT_MINT_EVENT_SIGNATURE
      )
    })

    let mintEvent: { tokenId: bigint; remark: string } | undefined

    if (mintEventLog) {
      try {
        // Decode HakuNFTMint event
        const mintEventDecodedResult = decodeEventLog({
          abi: [HAKU_NFT_MINT_EVENT_ABI],
          data: mintEventLog.data,
          topics: mintEventLog.topics,
        })
        const mintEventDecoded = mintEventDecodedResult.args as {
          from: Address
          to: Address
          value: bigint
          tokenId: bigint
          remark: string
        }

        // Verify parameter match (from, to, value should be consistent)
        if (
          mintEventDecoded.from.toLowerCase() === transferDecoded.from.toLowerCase() &&
          mintEventDecoded.to.toLowerCase() === transferDecoded.to.toLowerCase() &&
          mintEventDecoded.value === transferDecoded.value
        ) {
          mintEvent = {
            tokenId: mintEventDecoded.tokenId,
            remark: mintEventDecoded.remark,
          }
          console.log('[EventAssociator] ✅ HakuNFTMint event decoded:', {
            tokenId: mintEvent.tokenId.toString(),
            remark: mintEvent.remark,
          })
        } else {
          console.warn('[EventAssociator] ⚠️ Parameter mismatch between Transfer and HakuNFTMint')
        }
      } catch (err) {
        console.warn('[EventAssociator] Failed to decode HakuNFTMint event:', err)
      }
    } else {
      console.log('[EventAssociator] HakuNFTMint event not found (this is OK for non-mint transfers)')
    }

    // 5. Return association result
    return {
      transfer: {
        from: transferDecoded.from,
        to: transferDecoded.to,
        value: transferDecoded.value,
        transactionHash: txHash,
        blockNumber: receipt.blockNumber,
      },
      mintEvent,
    }
  } catch (error) {
    console.error('[EventAssociator] ❌ Failed to associate events:', error)
    return null
  }
}

