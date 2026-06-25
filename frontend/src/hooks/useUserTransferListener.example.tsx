/**
 * useUserTransferListener Hook Usage Examples
 * 
 * This file demonstrates how to use useUserTransferListener hook in different scenarios
 * to listen for HakuToken user transfer events
 */

import { useUserTransferListener } from './useUserTransferListener'

// ============ Example 1: Basic Usage ============
export function BasicExample() {
  useUserTransferListener((transfer) => {
    console.log('User transfer:', {
      from: transfer.from,
      to: transfer.to,
      amount: transfer.amount, // Formatted amount (e.g.: "100.5")
      amountRaw: transfer.amountRaw, // Raw amount (wei)
      blockNumber: transfer.blockNumber,
      transactionHash: transfer.transactionHash,
    })
  })

  return <div>Listening...</div>
}

// ============ Example 2: Custom Token Address and Decimals ============
export function CustomTokenExample() {
  useUserTransferListener(
    (transfer) => {
      console.log('Transfer:', transfer)
    },
    {
      tokenAddress: '0xYourTokenAddress' as `0x${string}`,
      decimals: 6, // If token uses 6 decimals (e.g. USDC)
    }
  )

  return <div>Listening to custom token...</div>
}

// ============ Example 3: Conditional Enable Listening ============
export function ConditionalExample({ enabled }: { enabled: boolean }) {
  useUserTransferListener(
    (transfer) => {
      // Only process transfers with amount > 1000
      if (parseFloat(transfer.amount) > 1000) {
        console.log('Large transfer:', transfer)
      }
    },
    {
      enabled, // Enable/disable listening based on condition
    }
  )

  return <div>{enabled ? 'Listening...' : 'Listening disabled'}</div>
}

// ============ Example 4: Use in Component (Real Scenario) ============
import { useState } from 'react'

export function TransferHistoryExample() {
  const [transfers, setTransfers] = useState<Array<{
    from: string
    to: string
    amount: string
    timestamp: Date
    txHash: string
  }>>([])

  useUserTransferListener((transfer) => {
    // Add new transfer to history
    setTransfers((prev) => [
      {
        from: transfer.from,
        to: transfer.to,
        amount: transfer.amount,
        timestamp: new Date(),
        txHash: transfer.transactionHash,
      },
      ...prev,
    ].slice(0, 100)) // Only keep last 100 records
  })

  return (
    <div>
      <h2>Transfer History</h2>
      <ul>
        {transfers.map((transfer, index) => (
          <li key={index}>
            {transfer.from} → {transfer.to}: {transfer.amount}
            <br />
            <small>{transfer.timestamp.toLocaleString()}</small>
            <br />
            <small>Tx: {transfer.txHash}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ============ Example 5: Only Listen to Transfers from Specific Address ============
export function FilterByAddressExample({ userAddress }: { userAddress?: string }) {
  useUserTransferListener((transfer) => {
    // Only process transfers related to user address
    if (
      userAddress &&
      (transfer.from.toLowerCase() === userAddress.toLowerCase() ||
       transfer.to.toLowerCase() === userAddress.toLowerCase())
    ) {
      console.log('User-related transfer:', transfer)
    }
  })

  return <div>Listening to user-related transfers...</div>
}

// ============ Example 6: Send to Backend API ============
export function BackendSyncExample() {
  useUserTransferListener(async (transfer) => {
    try {
      // Send transfer info to backend
      const response = await fetch('/api/user-transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: transfer.from,
          to: transfer.to,
          amount: transfer.amount,
          amountRaw: transfer.amountRaw.toString(),
          blockNumber: transfer.blockNumber.toString(),
          transactionHash: transfer.transactionHash,
        }),
      })

      if (!response.ok) {
        console.error('Sync failed:', await response.text())
      }
    } catch (error) {
      console.error('Sync error:', error)
    }
  })

  return <div>Syncing...</div>
}

