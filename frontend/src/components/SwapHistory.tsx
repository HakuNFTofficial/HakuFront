import { formatUnits } from 'viem'

interface SwapRecord {
    id: number
    user_address: string
    zero_for_one: boolean
    amount_in_raw: string
    amount_out_raw: string
    token_decimals: number
    block_timestamp_raw: number
    timestamp_utc: string
    created_at: string
}

interface SwapHistoryData {
    user_address: string
    total_amount_in: string
    total_amount_out: string
    amount_difference: string
    swap_records: SwapRecord[]
}

// Helper to parse scientific notation or regular strings to BigInt
const parseAmount = (amount: string): bigint => {
    if (amount.includes('e+')) {
        const [base, exponent] = amount.split('e+')
        const exp = parseInt(exponent)
        const baseNum = parseFloat(base)
        // Handle simple cases like 200e+16 -> 200 * 10^16
        // For more complex cases, this might need a library, but for this specific format:
        if (Number.isInteger(baseNum)) {
            return BigInt(baseNum) * (10n ** BigInt(exp))
        } else {
            // Fallback for decimals in base (e.g. 1.5e+18)
            // This is a simplified handler
            return BigInt(Number(amount))
        }
    }
    return BigInt(amount)
}

const formatAmount = (amount: string, decimals: number = 18) => {
    try {
        const value = parseAmount(amount)
        const formatted = formatUnits(value, decimals)
        // Format to 2 decimal places
        return parseFloat(formatted).toFixed(2)
    } catch (e) {
        console.error("Error formatting amount:", amount, e)
        return "0.00"
    }
}

export function SwapHistory({ data }: { data: SwapHistoryData }) {
    return (
        <div className="w-full max-w-2xl mx-auto font-sans space-y-3">
            {/* Summary Card */}
            <div className="bg-[#1a1b23] rounded-2xl p-3 shadow-2xl border border-gray-800">
                <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <span className="w-1 h-4 bg-gradient-to-b from-pink-500 to-violet-500 rounded-full"></span>
                    Swap Summary
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="bg-[#2a2b36] p-2 rounded-xl border border-gray-700/50">
                        <div className="text-gray-400 text-[10px] mb-0.5 uppercase tracking-wider">Total In</div>
                        <div className="text-white font-mono text-sm font-bold">
                            {formatAmount(data.total_amount_in)}
                        </div>
                    </div>

                    <div className="bg-[#2a2b36] p-2 rounded-xl border border-gray-700/50">
                        <div className="text-gray-400 text-[10px] mb-0.5 uppercase tracking-wider">Total Out</div>
                        <div className="text-white font-mono text-sm font-bold">
                            {formatAmount(data.total_amount_out)}
                        </div>
                    </div>

                    <div className="bg-[#2a2b36] p-2 rounded-xl border border-gray-700/50">
                        <div className="text-gray-400 text-[10px] mb-0.5 uppercase tracking-wider">Net Diff</div>
                        <div className={`font-mono text-sm font-bold ${data.amount_difference.startsWith('-') ? 'text-red-400' : 'text-green-400'}`}>
                            {formatAmount(data.amount_difference)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Records List */}
            <div className="bg-[#1a1b23] rounded-2xl p-3 shadow-2xl border border-gray-800">
                <h3 className="text-md font-bold text-white mb-2">Recent Swaps</h3>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {data.swap_records.map((record) => (
                        <div key={record.id} className="bg-[#2a2b36] p-2 rounded-xl border border-gray-700/50 hover:border-gray-600 transition-colors">
                            <div className="flex justify-between items-start mb-1.5">
                                <div className="flex items-center gap-1.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${record.zero_for_one ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {record.zero_for_one ? 'BUY' : 'SELL'}
                                    </span>
                                    <span className="text-gray-500 text-[10px] font-mono">
                                        {new Date(record.timestamp_utc).toLocaleString()}
                                    </span>
                                </div>
                                <span className="text-gray-600 text-[10px] font-mono">#{record.id}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <div>
                                    <div className="text-gray-500 text-[10px] mb-0.5">Pay</div>
                                    <div className="text-white font-mono text-sm">
                                        {formatAmount(record.amount_in_raw)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-gray-500 text-[10px] mb-0.5">Receive</div>
                                    <div className="text-white font-mono text-sm">
                                        {formatAmount(record.amount_out_raw)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
