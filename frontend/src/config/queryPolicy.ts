export const BALANCE_REFETCH_MS = 15_000
export const POOL_REFETCH_MS = 15_000
export const STATIC_REFETCH_MS = 30_000
export const WALLET_CHAIN_POLL_MS = 30_000

export const visibleRefetchInterval = (milliseconds: number) => () =>
    typeof document === 'undefined' || document.visibilityState === 'visible'
        ? milliseconds
        : false
