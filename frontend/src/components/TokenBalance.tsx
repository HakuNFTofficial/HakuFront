import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { ERC20_ABI } from '../config/contracts'

interface TokenBalanceProps {
    address: `0x${string}`
    userAddress: `0x${string}`
    label: string
}

export function TokenBalance({
    address,
    userAddress,
    label,
}: TokenBalanceProps) {
    const { data: balance } = useReadContract({
        address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress],
    })

    const { data: symbol } = useReadContract({
        address,
        abi: ERC20_ABI,
        functionName: 'symbol',
    })

    const { data: name } = useReadContract({
        address,
        abi: ERC20_ABI,
        functionName: 'name',
    })

    return (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-white/20 mt-2">
            <h3 className="text-lg font-semibold text-white mb-2">{label}</h3>
            <p className="text-sm text-white/70 mb-4">
                {name} ({symbol})
            </p>
            <div className="text-3xl font-bold text-white">
                {balance ? formatUnits(balance, 18) : '0.00'}
            </div>
            <p className="text-sm text-white/70 mt-1">{symbol}</p>
        </div>
    )
}
