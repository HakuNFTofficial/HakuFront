export const KLINE_PRICE_PRECISION = 7
export const KLINE_PRICE_MIN_MOVE = 0.0000001

const KLINE_INITIAL_VISIBLE_BARS = 40

export function formatKlinePrice(value: string | number): string {
    const price = typeof value === 'number' ? value : Number.parseFloat(value)

    return Number.isFinite(price)
        ? price.toFixed(KLINE_PRICE_PRECISION)
        : '--'
}

export function getInitialVisibleLogicalRange(dataLength: number) {
    if (dataLength <= 0) return null

    return {
        from: Math.max(0, dataLength - KLINE_INITIAL_VISIBLE_BARS),
        to: dataLength - 1,
    }
}
