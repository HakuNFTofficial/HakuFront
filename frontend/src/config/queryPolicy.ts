export const BALANCE_REFETCH_MS = 15_000
export const POOL_REFETCH_MS = 15_000
export const STATIC_REFETCH_MS = 30_000
export const WALLET_CHAIN_POLL_MS = 30_000

// React Query's refetchIntervalInBackground=false suppresses hidden-page fetches.
// Keep the timer configured so it automatically resumes after focus returns.
export const visibleRefetchInterval = (milliseconds: number) => () => milliseconds
