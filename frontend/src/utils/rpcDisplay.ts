export const RPC_UNAVAILABLE_MESSAGE = 'On-chain data is temporarily unavailable. Please try again later.'
export const BALANCE_UNAVAILABLE_LABEL = 'Temporarily unavailable'

export type BalanceDisplayState =
    | { kind: 'loading' }
    | { kind: 'value'; value: string }
    | { kind: 'unavailable'; value: '--'; label: string }

export function getBalanceDisplayState(
    formattedBalance: string | undefined,
    isLoading: boolean,
    error: unknown,
): BalanceDisplayState {
    if (isLoading) return { kind: 'loading' }
    if (error || formattedBalance === undefined) {
        return {
            kind: 'unavailable',
            value: '--',
            label: BALANCE_UNAVAILABLE_LABEL,
        }
    }

    const numericBalance = Number(formattedBalance)
    return {
        kind: 'value',
        value: Number.isFinite(numericBalance)
            ? numericBalance.toFixed(4)
            : formattedBalance,
    }
}
