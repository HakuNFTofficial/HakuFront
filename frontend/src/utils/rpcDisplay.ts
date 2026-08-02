export const RPC_UNAVAILABLE_MESSAGE = '链上数据暂时无法读取，请稍后重试'
export const BALANCE_UNAVAILABLE_LABEL = '暂时无法读取'

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
