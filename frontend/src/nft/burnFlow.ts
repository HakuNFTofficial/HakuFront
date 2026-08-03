export interface BurnNftRecord {
    nft_id: number
    token_id?: string | null
    is_mint: number
}

export interface BurnSnapshot {
    nfts: readonly BurnNftRecord[]
}

export class BurnSynchronizationTimeoutError extends Error {
    constructor() {
        super('Burn confirmed on-chain, but application synchronization is delayed.')
        this.name = 'BurnSynchronizationTimeoutError'
    }
}

export function getBurnConfirmationMessage(nft: BurnNftRecord) {
    return [
        `Burn Token #${nft.token_id} (NFT ID ${nft.nft_id})?`,
        '',
        'This action is permanent. The NFT will be destroyed on-chain.',
        'The contract will return the recorded HAKU refund atomically.',
    ].join('\n')
}

export function isBurnSynchronized(
    snapshot: BurnSnapshot,
    nftId: number,
) {
    const nft = snapshot.nfts.find((item) => item.nft_id === nftId)
    return !nft || (nft.is_mint === 0 && !nft.token_id)
}

const defaultDelay = (milliseconds: number) =>
    new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))

export async function waitForBurnSynchronization<T extends BurnSnapshot>({
    nftId,
    fetchSnapshot,
    delay = defaultDelay,
    maxAttempts = 15,
    pollIntervalMs = 2_000,
}: {
    nftId: number
    fetchSnapshot: () => Promise<T>
    delay?: (milliseconds: number) => Promise<void>
    maxAttempts?: number
    pollIntervalMs?: number
}): Promise<T> {
    const attempts = Math.max(1, maxAttempts)
    let lastFetchError: unknown
    let receivedSnapshot = false

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            const snapshot = await fetchSnapshot()
            receivedSnapshot = true
            if (isBurnSynchronized(snapshot, nftId)) return snapshot
        } catch (error) {
            lastFetchError = error
        }

        if (attempt + 1 < attempts) {
            await delay(pollIntervalMs)
        }
    }

    if (!receivedSnapshot && lastFetchError) throw lastFetchError
    throw new BurnSynchronizationTimeoutError()
}
