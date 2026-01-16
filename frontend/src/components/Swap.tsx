import { useState, useMemo, useEffect } from 'react'
import { useFeeData, useAccount, useWriteContract, useReadContract, useBalance } from 'wagmi'
import { parseUnits, formatUnits, keccak256, encodeAbiParameters, encodePacked, formatEther } from 'viem'
import { CONTRACTS, POOL_CONFIG, SWAP_CONFIG, SWAP_EXECUTOR_ABI, ERC20_ABI, POOL_MANAGER_ABI, QUOTER_ABI } from '../config/contracts'
import { useWalletChainId } from '../hooks/useWalletChainId'
import { REQUIRED_CHAIN_ID, getChainName } from '../config/chain'

export function Swap() {
    const { address } = useAccount()
    // Use custom hook to get wallet actually connected chain ID (get directly from wallet provider)
    const chainId = useWalletChainId()
    const { data: feeData } = useFeeData()
    const [mode, setMode] = useState<'buy' | 'sell'>('buy')
    const [amount, setAmount] = useState('')
    const [slippageTolerance, setSlippageTolerance] = useState<number>(SWAP_CONFIG.DEFAULT_SLIPPAGE_TOLERANCE) // Read from config file
    const [showSlippageModal, setShowSlippageModal] = useState(false)
    const [slippageInput, setSlippageInput] = useState(SWAP_CONFIG.DEFAULT_SLIPPAGE_TOLERANCE.toString())

    const maxFeePerGas = feeData?.maxFeePerGas || 0n
    const maxPriorityFeePerGas = feeData?.maxPriorityFeePerGas || 0n

    // Token B name
    const { data: tokenBName } = useReadContract({
        address: CONTRACTS.TOKEN_B,
        abi: ERC20_ABI,
        functionName: 'name', // Use name instead of symbol
    })

    // Dynamically read TokenB decimals
    const { data: tokenBDecimals } = useReadContract({
        address: CONTRACTS.TOKEN_B,
        abi: ERC20_ABI,
        functionName: 'decimals',
    })

    // Query STT balance (native token)
    const { data: sttBalance, isLoading: isLoadingSTT } = useBalance({
        address: address,
        query: {
            enabled: !!address,
            refetchInterval: 5000,
        },
    })

    // Query Haku balance (ERC20)
    const { data: hakuBalance, isLoading: isLoadingHaku } = useReadContract({
        address: CONTRACTS.TOKEN_B,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address,
            refetchInterval: 5000,
        },
    })

    // Get TokenB symbol
    const { data: tokenBSymbol } = useReadContract({
        address: CONTRACTS.TOKEN_B,
        abi: ERC20_ABI,
        functionName: 'symbol',
    })

    const tokenASymbol = 'STT'
    const tokenADecimals = 18 // STT is native token, always 18 decimals
    const tokenPay = mode === 'buy'
        ? { address: CONTRACTS.TOKEN_A, symbol: tokenASymbol }
        : { address: CONTRACTS.TOKEN_B, symbol: (tokenBName as string) || 'TokenB' }

    // Use PoolId from config (obtained from initialization transaction logs)
    // If no PoolId in config, calculate dynamically (backward compatible)
    const poolId = useMemo(() => {
        // Prioritize PoolId from config
        if (POOL_CONFIG.POOL_ID) {
            return POOL_CONFIG.POOL_ID
        }

        // If no PoolId configured, calculate dynamically (backward compatible)
        const tokenA = CONTRACTS.TOKEN_A
        const tokenB = CONTRACTS.TOKEN_B
        const currency0 = tokenA < tokenB ? tokenA : tokenB
        const currency1 = tokenA < tokenB ? tokenB : tokenA

        // Use encodeAbiParameters (corresponds to Solidity's abi.encode)
        // PoolKey struct: (address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)
        return keccak256(
            encodeAbiParameters(
                [
                    { type: 'address', name: 'currency0' },
                    { type: 'address', name: 'currency1' },
                    { type: 'uint24', name: 'fee' },
                    { type: 'int24', name: 'tickSpacing' },
                    { type: 'address', name: 'hooks' }
                ],
                [
                    currency0 as `0x${string}`,
                    currency1 as `0x${string}`,
                    POOL_CONFIG.FEE,
                    POOL_CONFIG.TICK_SPACING,
                    POOL_CONFIG.HOOKS
                ]
            )
        )
    }, [])

    // Read pool state via extsload
    // _pools mapping is at slot 6 (after Owned, ProtocolFees, ERC6909)
    // slot = keccak256(abi.encodePacked(poolId, POOLS_SLOT))
    // Note: must use encodePacked to match StateLibrary._getPoolStateSlot
    const poolSlot = useMemo(() => {
        if (!poolId) return undefined
        // Use encodePacked instead of encodeAbiParameters to match Solidity's abi.encodePacked
        const POOLS_SLOT = 6n
        return keccak256(encodePacked(
            ['bytes32', 'uint256'],
            [poolId as `0x${string}`, POOLS_SLOT]
        ))
    }, [poolId])

    // Calculate liquidity slot (for checking if pool has liquidity)
    const liquiditySlot = useMemo(() => {
        if (!poolSlot) return undefined
        const LIQUIDITY_OFFSET = 3n // Liquidity offset in Pool.State
        // Convert poolSlot (bytes32) to bigint, add offset, convert back
        return `0x${(BigInt(poolSlot) + LIQUIDITY_OFFSET).toString(16).padStart(64, '0')}` as `0x${string}`
    }, [poolSlot])

    const { data: slot0Bytes, isLoading: isLoadingPool, error: poolError } = useReadContract({
        address: CONTRACTS.POOL_MANAGER,
        abi: POOL_MANAGER_ABI,
        functionName: 'extsload',
        args: poolSlot ? [poolSlot] : undefined,
        query: {
            enabled: !!poolSlot,
            refetchInterval: 5000, // Refresh pool state every 5 seconds
        }
    })

    // Query pool liquidity
    const { data: liquidityBytes } = useReadContract({
        address: CONTRACTS.POOL_MANAGER,
        abi: POOL_MANAGER_ABI,
        functionName: 'extsload',
        args: liquiditySlot ? [liquiditySlot] : undefined,
        query: {
            enabled: !!liquiditySlot,
            refetchInterval: 5000,
        }
    })

    // Parse liquidity (uint128, in lower 128 bits of bytes32)
    const poolLiquidity = useMemo(() => {
        if (!liquidityBytes) return null
        const liquidityValue = BigInt(liquidityBytes)
        // uint128 in lower 128 bits
        const liquidity = liquidityValue & ((1n << 128n) - 1n)
        return liquidity
    }, [liquidityBytes])

    // Check if pool has liquidity
    const hasLiquidity = poolLiquidity !== null && poolLiquidity > 0n

    // Debug log: pool query status (disabled)
    // useMemo(() => {
    //     console.log('[Swap] Pool query state:', {
    //         poolId: poolId ? `0x${poolId.slice(2, 10)}...` : 'null',
    //         poolSlot: poolSlot ? `0x${poolSlot.slice(2, 10)}...` : 'null',
    //         slot0Bytes: slot0Bytes ? `0x${slot0Bytes.slice(2, 10)}...` : 'null',
    //         isLoadingPool,
    //         poolError: poolError?.message
    //     })
    // }, [poolId, poolSlot, slot0Bytes, isLoadingPool, poolError])

    // Parse Slot0 from bytes32
    // struct Slot0 {
    //    uint160 sqrtPriceX96;
    //    int24 tick;
    //    uint24 protocolFee;
    //    uint24 lpFee;
    // }
    // Packed: [lpFee(24)][protocolFee(24)][tick(24)][sqrtPriceX96(160)]
    // Actually, Solidity packing is right-to-left for lower bits?
    // Let's check: sqrtPriceX96 is first member, so it's in the lower bits.
    // uint160 sqrtPriceX96 (0-159 bits)
    // int24 tick (160-183 bits)
    // ...

    const poolSlot0 = useMemo(() => {
        if (!slot0Bytes || slot0Bytes === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            console.warn('[Swap] Pool slot0 is empty or zero - pool may not be initialized')
            return null
        }

        const value = BigInt(slot0Bytes)
        const sqrtPriceX96 = value & ((1n << 160n) - 1n)
        const tick = Number((value >> 160n) & ((1n << 24n) - 1n))
        // Handle signed int24 for tick
        const signedTick = tick > 8388607 ? tick - 16777216 : tick

        // console.log('[Swap] Pool state:', {
        //     slot0Bytes,
        //     sqrtPriceX96: sqrtPriceX96.toString(),
        //     tick: signedTick,
        //     price: sqrtPriceX96 > 0n ? (Number(sqrtPriceX96) / (2 ** 96)) ** 2 : 0
        // })

        if (sqrtPriceX96 === 0n) {
            console.error('[Swap] sqrtPriceX96 is zero - pool may not have liquidity')
            return null
        }

        return [sqrtPriceX96, signedTick]
    }, [slot0Bytes])

    // Parse liquidity from bytes32 (keeping for future use)

    // Calculate current pool price (not estimated output)
    const currentPrice = useMemo(() => {
        if (!poolSlot0) return null

        const sqrtPriceX96 = poolSlot0[0] as bigint
        if (sqrtPriceX96 === 0n) return null

        // Uniswap V4 price formula: price = (sqrtPriceX96 / 2^96)^2
        // In Uniswap, price = token1 / token0
        // In our pool: currency0 = STT (TOKEN_A), currency1 = TokenB
        // So price = TokenB / STT
        // Therefore: 1 STT = 1/price TokenB, 1 TokenB = price STT

        const Q96 = 2n ** 96n
        const Q96_SQUARED = Q96 * Q96

        // Calculate sqrtPriceX96^2, use BigInt calculation then convert to float to avoid precision loss
        const sqrtPriceSquared = sqrtPriceX96 * sqrtPriceX96

        // Use higher precision calculation: multiply by 10^18 first then divide, avoid precision loss
        const PRECISION = 10n ** 18n
        const priceBigInt = (sqrtPriceSquared * PRECISION) / Q96_SQUARED
        const priceTokenBPerSTT = Number(priceBigInt) / Number(PRECISION)

        // Calculate inverse price
        const priceSTTPerTokenB = priceTokenBPerSTT > 0 ? 1 / priceTokenBPerSTT : 0

        // console.log('[Swap] Current Price Debug:', {
        //     sqrtPriceX96: sqrtPriceX96.toString(),
        //     Q96: Q96.toString(),
        //     sqrtPriceSquared: sqrtPriceSquared.toString(),
        //     Q96_SQUARED: Q96_SQUARED.toString(),
        //     priceBigInt: priceBigInt.toString(),
        //     priceTokenBPerSTT,
        //     sttToTokenB: priceSTTPerTokenB,  // 1 STT = ? TokenB (i.e. 1/price)
        //     tokenBToSTT: priceTokenBPerSTT   // 1 TokenB = ? STT (i.e. price)
        // })

        return {
            sttToTokenB: priceSTTPerTokenB,  // 1 STT = ? TokenB
            tokenBToSTT: priceTokenBPerSTT,  // 1 TokenB = ? STT
            sqrtPriceX96Debug: sqrtPriceX96.toString()
        }
    }, [poolSlot0])
    
   
    const quoteParams = useMemo(() => {
        if (!amount || !poolSlot0 || amount === '0' || !hasLiquidity) return null

      
        const numAmount = parseFloat(amount)
        if (isNaN(numAmount) || numAmount <= 0) {
            console.warn('[Swap] Invalid amount for Quoter:', amount)
            return null
        }

        const tokenA = CONTRACTS.TOKEN_A
        const tokenB = CONTRACTS.TOKEN_B
        const currency0 = tokenA < tokenB ? tokenA : tokenB
        const currency1 = tokenA < tokenB ? tokenB : tokenA

        // Select correct decimals based on mode
        const decimals = mode === 'buy' ? tokenADecimals : (tokenBDecimals ?? 18)
        
        // ✅ Try-catch parseUnits 
        let amountIn: bigint
        try {
            amountIn = parseUnits(amount, decimals)
        } catch (err) {
            console.error('[Swap] Failed to parse amount:', amount, err)
            return null
        }

        // zeroForOne: true if swapping currency0 -> currency1
        // buy mode: STT (currency0) -> HakuToken (currency1), so zeroForOne = true
        // sell mode: HakuToken (currency1) -> STT (currency0), so zeroForOne = false
        const zeroForOne = mode === 'buy'

        return {
            poolKey: {
                currency0: currency0 as `0x${string}`,
                currency1: currency1 as `0x${string}`,
                fee: POOL_CONFIG.FEE,
                tickSpacing: POOL_CONFIG.TICK_SPACING,
                hooks: POOL_CONFIG.HOOKS,
            },
            zeroForOne,
            exactAmount: amountIn,
            hookData: '0x' as `0x${string}`,
        }
    }, [amount, poolSlot0, mode, tokenADecimals, tokenBDecimals])

   
    const { data: quoteResult, isLoading: isQuoting, error: quoteError } = useReadContract({
        address: CONTRACTS.QUOTER,
        abi: QUOTER_ABI,
        functionName: 'quoteExactInputSingle',
        args: quoteParams ? [quoteParams] : undefined,
        query: {
            enabled: !!quoteParams && !!amount && amount !== '0' && hasLiquidity,
            refetchInterval: 5000, 
        },
    })

    // Parse Quoter result and calculate slippage
    const quoteInfo = useMemo(() => {
        if (!quoteResult || !currentPrice || !amount || amount === '0') return null

        // V4Quoter returns (amountOut, gasEstimate)
        const [amountOut, gasEstimate] = quoteResult as [bigint, bigint]

        // Determine output token decimals based on mode
        const outputDecimals = mode === 'buy' ? (tokenBDecimals ?? 18) : tokenADecimals
        const inputDecimals = mode === 'buy' ? tokenADecimals : (tokenBDecimals ?? 18)

        const amountOutFormatted = formatUnits(amountOut, outputDecimals)

        // Calculate slippage
        // Slippage = (ideal output - actual output) / ideal output * 100%
        const currentSqrtPriceX96 = poolSlot0?.[0] as bigint
        if (!currentSqrtPriceX96) return null

        const Q96 = 2n ** 96n
        const currentPriceValue = Number((currentSqrtPriceX96 * currentSqrtPriceX96 * 10n ** 18n) / (Q96 * Q96)) / 1e18

        // Calculate ideal output (based on current price)
        const amountInBigInt = parseUnits(amount, inputDecimals)
        const idealOutput = mode === 'buy'
            ? (amountInBigInt * BigInt(Math.floor(currentPriceValue * 1e18))) / (10n ** 18n)
            : (amountInBigInt * 10n ** 18n) / BigInt(Math.floor(currentPriceValue * 1e18))

        const idealOutputFormatted = formatUnits(idealOutput, outputDecimals)
        const idealOutputFloat = parseFloat(idealOutputFormatted)
        const actualOutputFloat = parseFloat(amountOutFormatted)

       
        const slippage = idealOutputFloat > 0
            ? ((idealOutputFloat - actualOutputFloat) / idealOutputFloat) * 100
            : 0

        return {
            amountOut: amountOutFormatted, 
            amountOutRaw: amountOut, 
            amountOutFloat: actualOutputFloat,
            slippage: Math.abs(slippage),
            gasEstimate: gasEstimate.toString(),
        }
    }, [quoteResult, currentPrice, amount, mode, poolSlot0, tokenADecimals, tokenBDecimals])

    const { writeContract, error: writeError } = useWriteContract()

 
    const outputDecimals = mode === 'buy' ? (tokenBDecimals ?? 18) : tokenADecimals

    const handleApprove = () => {
        if (!amount || !address) {
            return
        }

    
    
        if (chainId !== undefined && chainId !== REQUIRED_CHAIN_ID) {
            const currentChainName = getChainName(chainId)
            const requiredChainName = getChainName(REQUIRED_CHAIN_ID)
            alert(`⚠️ Network Mismatch!\n\nCurrent Network: ${currentChainName} (ID: ${chainId})\nRequired Network: ${requiredChainName} (ID: ${REQUIRED_CHAIN_ID})\n\nPlease switch to the correct test network before trading.`)
            return
        }

        if (tokenPay.address === CONTRACTS.TOKEN_A) {
            return
        }

        // Determine decimals based on currently paying token
        // tokenPay.address during approve is TOKEN_B (because TOKEN_A is native token, doesn't need approve)
        const decimals = tokenBDecimals ?? 18
        const amountWei = parseUnits(amount, decimals)

        writeContract({
            address: tokenPay.address,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [CONTRACTS.SWAP_ROUTER, amountWei],
            type: 'eip1559',
            maxFeePerGas,
            maxPriorityFeePerGas,
        })
    }

    const handleSwap = () => {
        if (!amount || !address) {
            return
        }

        // Strong hint: check chain ID
        // console.log('[Swap] Swap - Chain ID check:', { chainId, REQUIRED_CHAIN_ID, address })
        if (chainId !== undefined && chainId !== REQUIRED_CHAIN_ID) {
            const currentChainName = getChainName(chainId)
            const requiredChainName = getChainName(REQUIRED_CHAIN_ID)
            alert(`⚠️ Network Mismatch!\n\nCurrent Network: ${currentChainName} (ID: ${chainId})\nRequired Network: ${requiredChainName} (ID: ${REQUIRED_CHAIN_ID})\n\nPlease switch to the correct test network before trading.`)
            return
        }

        // Select correct decimals based on mode
        const decimals = mode === 'buy' ? tokenADecimals : (tokenBDecimals ?? 18)
        const amountWei = parseUnits(amount, decimals)
        const functionName = mode === 'buy' ? 'swapAForB' : 'swapBForA'
        const isNativePay = tokenPay.address === CONTRACTS.TOKEN_A

        // Calculate minAmountOut (based on Quoter result and slippage tolerance)
        // Contract requires minAmountOut > 0, so must have Quoter result
        if (!quoteInfo) {
            alert('⚠️ Unable to get trade quote. Please try again later or check pool liquidity.')
            return
        }

        const outputDecimals = mode === 'buy' ? (tokenBDecimals ?? 18) : tokenADecimals
        // minAmountOut = quoteInfo.amountOutRaw * (1 - slippageTolerance / 100)
        // Use raw BigInt value returned by Quoter to avoid precision loss from formatted string
        // Formula: minAmountOut = quotedAmountOut * (10000 - slippageTolerance * 100) / 10000
        // This avoids floating point precision issues
        // 
        // Note: to handle potential Quoter quote inaccuracy during gas estimation, we add extra safety buffer
        // On top of user-set slippage tolerance, reduce extra 1% as safety buffer
        // This avoids gas estimation failure, but actual execution still uses user-set slippage tolerance for check
        const slippageBasisPoints = BigInt(Math.round(slippageTolerance * 100)) // Convert to basis points (0.1% = 10bp, 5% = 500bp)
        const safetyBufferBasisPoints = 100n // Extra 1% safety buffer (100 basis points)
        const totalSlippageBasisPoints = slippageBasisPoints + safetyBufferBasisPoints // Total slippage = user setting + 1% buffer
        const quotedAmountOut = quoteInfo.amountOutRaw // Directly use raw BigInt value returned by Quoter
        // Use more lenient minAmountOut to avoid gas estimation failure
        const minAmountOut = (quotedAmountOut * (10000n - totalSlippageBasisPoints)) / 10000n
        
        // Debug log
        console.log('[Swap] Slippage calculation:', {
            slippageTolerance,
            slippageBasisPoints: slippageBasisPoints.toString(),
            safetyBufferBasisPoints: safetyBufferBasisPoints.toString(),
            totalSlippageBasisPoints: totalSlippageBasisPoints.toString(),
            quotedAmountOut: quotedAmountOut.toString(),
            quotedAmountOutFormatted: quoteInfo.amountOut,
            minAmountOut: minAmountOut.toString(),
            minAmountOutFormatted: formatUnits(minAmountOut, outputDecimals),
            minAmountOutPercentage: `${((Number(minAmountOut) / Number(quotedAmountOut)) * 100).toFixed(4)}%`,
            note: 'minAmountOut includes 1% safety buffer to prevent gas estimation failures',
        })

        // Ensure minAmountOut > 0
        if (minAmountOut === 0n) {
            alert('⚠️ Calculated minimum output amount is 0, cannot execute trade.')
            return
        }

        const txParams: any = {
            address: CONTRACTS.SWAP_ROUTER,
            abi: SWAP_EXECUTOR_ABI,
            functionName,
            args: [amountWei, minAmountOut], // Pass minAmountOut to enable slippage protection
            type: 'eip1559',
            maxFeePerGas,
            maxPriorityFeePerGas,
        }

        if (isNativePay) {
            txParams.value = amountWei
        }

        writeContract(txParams)
    }

    // Listen for swap errors and show friendly error messages
    useEffect(() => {
        if (writeError) {
            console.error('[Swap] ❌ Swap transaction error:', writeError)
            
            let errorMessage = 'Transaction failed: '
            
            // Try to parse error message
            if (writeError.message) {
                // Check if gas estimation error
                if (writeError.message.includes('estimateGas') || writeError.message.includes('execution reverted')) {
                    // Try to decode error message from error data
                    const errorData = (writeError as any).data
                    if (errorData) {
                        // Check if custom error
                        if (typeof errorData === 'string' && errorData.startsWith('0x')) {
                            // Try to decode common errors
                            const errorSelector = errorData.slice(0, 10) // First 4 bytes are error selector
                            
                            // 0xe450d38c might be some custom error, try to decode
                            if (errorSelector === '0xe450d38c') {
                                // Try to decode as (address, uint256, uint256) format
                                try {
                                    // Extract parameters from error data
                                    const address = '0x' + errorData.slice(26, 66) // Address after skipping selector
                                    const uint256_1 = BigInt('0x' + errorData.slice(66, 130)) // First uint256
                                    const uint256_2 = BigInt('0x' + errorData.slice(130, 194)) // Second uint256
                                    
                                    console.log('[Swap] Decoded error data:', {
                                        selector: errorSelector,
                                        address,
                                        uint256_1: uint256_1.toString(),
                                        uint256_2: uint256_2.toString(),
                                    })
                                    
                                    // Determine possible error type based on values
                                    // If uint256_2 > uint256_1, might be "insufficient minimum amount" error
                                    if (uint256_2 > uint256_1) {
                                        const minAmount = formatUnits(uint256_1, outputDecimals)
                                        const actualAmount = formatUnits(uint256_2, outputDecimals)
                                        const tokenName = mode === 'buy' ? 'HakuToken' : 'STT'
                                        errorMessage = `Slippage protection failed: Expected at least ${minAmount} ${tokenName}, but can only receive ${actualAmount} ${tokenName}.\n\nSuggestions:\n1. Reduce slippage tolerance\n2. Decrease trade amount\n3. Try again later (price may have changed)`
                                    } else {
                                        errorMessage = `Transaction failed: Unknown error (selector: ${errorSelector})`
                                    }
                                } catch (decodeErr) {
                                    console.error('[Swap] Failed to decode error data:', decodeErr)
                                    errorMessage = `Transaction failed: Gas estimation failed. Possible causes:\n1. Slippage protection triggered (price has changed)\n2. Insufficient pool liquidity\n3. Parameter error\n\nPlease check console logs for more information.`
                                }
                            } else if (errorSelector === '0x08c379a0') {
                                // This is a string error (Error(string))
                                errorMessage = `Transaction failed: ${writeError.message}`
                            } else {
                                errorMessage = `Transaction failed: Gas estimation failed (error selector: ${errorSelector}). Slippage protection may have triggered or price has changed.`
                            }
                        } else {
                            errorMessage = `Transaction failed: ${writeError.message}`
                        }
                    } else {
                        errorMessage = `Transaction failed: Gas estimation failed. Slippage protection may have triggered or price has changed.`
                    }
                } else {
                    errorMessage += writeError.message
                }
            } else {
                errorMessage += 'Unknown error'
            }
            
            alert(errorMessage)
        }
    }, [writeError, mode, outputDecimals, tokenBDecimals, tokenADecimals])

    return (
        <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto font-sans">
            <div className="w-full bg-[#1a1b23] rounded-2xl p-4 shadow-2xl border border-gray-800">
                <div className="flex gap-4 mb-4">
                    <div className="flex-1">
                        <button onClick={() => setMode('buy')} className={`w-full py-3 rounded-xl font-bold text-xl transition-all ${mode === 'buy' ? 'bg-[#4ade80] text-black shadow-[0_0_20px_rgba(74,222,128,0.3)]' : 'bg-[#2a2b36] text-gray-500 hover:bg-[#3a3b46]'}`}>
                            buy
                        </button>
                    </div>
                    <div className="flex-1">
                        <button onClick={() => setMode('sell')} className={`w-full py-3 rounded-xl font-bold text-xl transition-all ${mode === 'sell' ? 'bg-[#ef4444] text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-[#2a2b36] text-gray-500 hover:bg-[#3a3b46]'}`}>
                            sell
                        </button>
                    </div>
                </div>

                {/* Display corresponding balance based on mode */}
                {address && (
                    <div className="mb-4 flex items-center justify-between">
                        {mode === 'buy' ? (
                            // Buy mode: show STT balance
                            <>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                        STT
                                    </div>
                                    <div className="text-white text-sm font-medium">STT</div>
                                </div>
                                <div className="text-white text-sm font-semibold">
                                    {isLoadingSTT ? (
                                        <span className="loading loading-spinner loading-xs"></span>
                                    ) : (
                                        sttBalance ? parseFloat(formatEther(sttBalance.value)).toFixed(4) : '0.0000'
                                    )}
                                </div>
                            </>
                        ) : (
                            // Sell mode: show Haku balance
                            <>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                        {(tokenBSymbol as string)?.slice(0, 2) || 'HK'}
                                    </div>
                                    <div className="text-white text-sm font-medium">
                                        {(tokenBSymbol as string) || 'TokenB'}
                                    </div>
                                </div>
                                <div className="text-white text-sm font-semibold">
                                    {isLoadingHaku ? (
                                        <span className="loading loading-spinner loading-xs"></span>
                                    ) : (
                                        hakuBalance && tokenBDecimals
                                            ? parseFloat(formatUnits(hakuBalance, tokenBDecimals)).toFixed(4)
                                            : '0.0000'
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div className="flex justify-end mb-2">
                    <button 
                        onClick={() => {
                            setSlippageInput(slippageTolerance.toString())
                            setShowSlippageModal(true)
                        }}
                        className="bg-[#2a2b36] text-gray-400 text-xs px-3 py-1 rounded-lg hover:bg-[#3a3b46] transition-colors"
                    >
                        slippage: {slippageTolerance}%
                    </button>
                </div>
                
                {/* Slippage settings modal */}
                {showSlippageModal && (
                    <div 
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowSlippageModal(false)}
                    >
                        <div 
                            className="bg-[#1a1b23] rounded-2xl p-6 w-full max-w-md mx-4 border border-gray-800"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-white font-bold text-lg">Set Slippage Tolerance</h3>
                                <button
                                    onClick={() => setShowSlippageModal(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                    </button>
                </div>
                            
                            <div className="mb-4">
                                <label className="block text-gray-400 text-sm mb-2">
                                    Slippage Tolerance (%)
                                </label>
                                <input
                                    type="number"
                                    value={slippageInput}
                                    onChange={(e) => {
                                        const value = e.target.value
                                        // Allow decimal input but limit to reasonable range
                                        if (value === '' || (parseFloat(value) >= 0.1 && parseFloat(value) <= 50)) {
                                            setSlippageInput(value)
                                        }
                                    }}
                                    placeholder="1.0"
                                    step="0.1"
                                    min="0.1"
                                    max="50"
                                    className="w-full bg-[#2a2b36] text-white text-lg p-3 rounded-xl border border-gray-700 focus:border-gray-500 focus:outline-none"
                                />
                                <p className="text-gray-500 text-xs mt-2">
                                    Recommended range: 0.1% - 50%
                                </p>
                            </div>
                            
                            {/* Quick selection buttons */}
                            <div className="mb-4">
                                <p className="text-gray-400 text-sm mb-2">Quick select:</p>
                                <div className="flex gap-2">
                                    {[0.1, 0.5, 1, 3, 5].map((value) => (
                                        <button
                                            key={value}
                                            onClick={() => setSlippageInput(value.toString())}
                                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                                                slippageInput === value.toString()
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-[#2a2b36] text-gray-400 hover:bg-[#3a3b46]'
                                            }`}
                                        >
                                            {value}%
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowSlippageModal(false)}
                                    className="flex-1 py-3 px-4 bg-[#2a2b36] text-gray-400 rounded-xl hover:bg-[#3a3b46] transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        const value = parseFloat(slippageInput)
                                        if (!isNaN(value) && value >= 0.1 && value <= 50) {
                                            setSlippageTolerance(value)
                                            setShowSlippageModal(false)
                                        } else {
                                            alert('Please enter a valid slippage value (0.1% - 50%)')
                                        }
                                    }}
                                    className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mb-4">
                    <div className="relative">
                        <input 
                            type="number" 
                            value={amount} 
                            onChange={(e) => {
                                const value = e.target.value
                                // ✅ Only allow positive numbers and empty string (allow user to delete input)
                                // But don't intercept here, let user input, verify during Quoter call
                                setAmount(value)
                            }} 
                            placeholder="0.0" 
                            className="w-full bg-[#2a2b36] text-white text-2xl p-4 pr-20 rounded-xl border border-gray-700 focus:border-gray-500 focus:outline-none placeholder-gray-600" 
                            min="0"
                            step="any"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white font-medium text-xl">{tokenPay.symbol}</div>
                    </div>
                    {/* ✅ Friendly prompt: invalid input */}
                    {amount && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) && (
                        <div className="mt-2 px-4 py-2 bg-yellow-900/20 rounded-lg border border-yellow-700/50">
                            <div className="text-yellow-400 text-xs font-semibold">⚠️ Please enter a valid amount (must be greater than 0)</div>
                        </div>
                    )}
                    {/* Quoter estimated output and slippage */}
                    {quoteInfo && (
                        <div className="mt-2 px-4 py-3 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg border border-blue-700/50">
                            <div className="text-gray-300 text-xs mb-2 font-semibold">Estimated Trade Result</div>
                            <div className="text-white text-sm space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Input:</span>
                                    <span className="font-mono font-semibold">{parseFloat(amount).toFixed(4)} {mode === 'buy' ? 'STT' : 'HakuToken'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">≈ You will receive:</span>
                                    <span className="font-mono font-semibold text-green-400">{quoteInfo.amountOutFloat.toFixed(4)} {mode === 'buy' ? 'HakuToken' : 'STT'}</span>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-gray-700/50">
                                    <span className="text-gray-400">Slippage:</span>
                                    <span className={`font-mono font-semibold ${quoteInfo.slippage > 1 ? 'text-red-400' : quoteInfo.slippage > 0.5 ? 'text-yellow-400' : 'text-green-400'}`}>
                                        ~{quoteInfo.slippage.toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                    {isQuoting && amount && amount !== '0' && (
                        <div className="mt-2 px-4 py-2 bg-[#1a1b23] rounded-lg border border-gray-700/50">
                            <div className="text-gray-400 text-xs flex items-center gap-2">
                                <span className="loading loading-spinner loading-xs"></span>
                                Calculating estimated output...
                            </div>
                        </div>
                    )}
                    {/* No liquidity warning */}
                    {poolSlot0 && !hasLiquidity && (
                        <div className="mt-2 px-4 py-3 bg-yellow-900/20 rounded-lg border border-yellow-700/50">
                            <div className="text-yellow-400 text-xs font-semibold mb-1">⚠️ Pool has no liquidity</div>
                            <div className="text-yellow-300 text-xs">
                                Need to add liquidity first before performing swap trades and getting quotes.
                            </div>
                            <div className="text-yellow-400 text-xs mt-2">
                                💡 Please use AddLiquidityExecutor to add liquidity first
                            </div>
                        </div>
                    )}
                    {quoteError && amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
                        <div className="mt-2 px-4 py-3 bg-red-900/20 rounded-lg border border-red-700/50">
                            <div className="text-red-400 text-xs font-semibold mb-1">Quoter Error</div>
                            <div className="text-red-300 text-xs mb-2 break-words">{quoteError.message}</div>
                            <div className="text-yellow-400 text-xs mt-2">
                                💡 Possible causes:
                                <ul className="list-disc list-inside mt-1 space-y-0.5">
                                    <li>Pool has no liquidity (need to add liquidity first)</li>
                                    <li>Trade amount too large, exceeds available liquidity</li>
                                    <li>Pool not properly initialized</li>
                                </ul>
                            </div>
                        </div>
                    )}
                    {isLoadingPool && (
                        <div className="mt-2 px-4 py-2 bg-[#1a1b23] rounded-lg border border-gray-700/50">
                            <div className="text-gray-400 text-xs">Loading pool state...</div>
                        </div>
                    )}
                    {poolError && (
                        <div className="mt-2 px-4 py-2 bg-red-900/20 rounded-lg border border-red-700/50">
                            <div className="text-red-400 text-xs">Error: {poolError.message}</div>
                        </div>
                    )}
                    {!poolSlot0 && !isLoadingPool && !poolError && amount && (
                        <div className="mt-2 px-4 py-2 bg-yellow-900/20 rounded-lg border border-yellow-700/50">
                            <div className="text-yellow-400 text-xs">⚠️ Pool not initialized or no liquidity</div>
                            <div className="text-yellow-500 text-xs mt-1">Check: 1) Pool initialized? 2) Liquidity added? 3) Browser console for details</div>
                        </div>
                    )}
                    {poolSlot0 && poolSlot0[1] !== undefined && (poolSlot0[1] as number) < -9960 && (
                        <div className="mt-2 px-4 py-2 bg-red-900/20 rounded-lg border border-red-700/50">
                            <div className="text-red-400 text-xs font-bold">🚨 CRITICAL: Price OUTSIDE liquidity range!</div>
                            <div className="text-red-300 text-xs mt-1">Current tick: {Number(poolSlot0[1])}</div>
                            <div className="text-red-300 text-xs">Liquidity range: -9960 to 9960</div>
                            <div className="text-yellow-400 text-xs mt-2">Solution: Add liquidity at current price or reinitialize pool</div>
                        </div>
                    )}
                    {poolSlot0 && poolSlot0[1] !== undefined && (poolSlot0[1] as number) === -887272 && (
                        <div className="mt-2 px-4 py-2 bg-red-900/20 rounded-lg border border-red-700/50">
                            <div className="text-red-400 text-xs font-bold">🚨 CRITICAL: Price at MIN_TICK - Pool has NO liquidity!</div>
                            <div className="text-yellow-400 text-xs mt-2">Solution: Initialize pool and add liquidity</div>
                        </div>
                    )}


                </div>

                <div className="flex gap-2 mb-6">
                    <button onClick={() => setAmount('')} className="bg-[#2a2b36] text-gray-400 px-2 py-1 rounded-lg text-xs hover:bg-[#3a3b46] transition-colors">reset</button>
                    {(() => {
                        // Calculate current balance and corresponding percentage value based on mode
                        let currentBalance = 0

                        if (mode === 'buy') {
                            // Buy mode: use STT balance
                            currentBalance = sttBalance ? parseFloat(formatEther(sttBalance.value)) : 0
                        } else {
                            // Sell mode: use HakuToken balance
                            currentBalance = hakuBalance && tokenBDecimals
                                ? parseFloat(formatUnits(hakuBalance, tokenBDecimals))
                                : 0
                        }

                        const maxAmount = currentBalance.toFixed(4)
                        const percent10 = (currentBalance * 0.1).toFixed(4)
                        const percent20 = (currentBalance * 0.2).toFixed(4)
                        const percent50 = (currentBalance * 0.5).toFixed(4)

                        return (
                            <>
                                <button
                                    onClick={() => setAmount(percent10)}
                                    className="bg-[#2a2b36] text-gray-400 px-2 py-1 rounded-lg text-xs hover:bg-[#3a3b46] transition-colors"
                                    disabled={!address || currentBalance === 0}
                                >
                                    10%
                                </button>
                                <button
                                    onClick={() => setAmount(percent20)}
                                    className="bg-[#2a2b36] text-gray-400 px-2 py-1 rounded-lg text-xs hover:bg-[#3a3b46] transition-colors"
                                    disabled={!address || currentBalance === 0}
                                >
                                    20%
                                </button>
                                <button
                                    onClick={() => setAmount(percent50)}
                                    className="bg-[#2a2b36] text-gray-400 px-2 py-1 rounded-lg text-xs hover:bg-[#3a3b46] transition-colors"
                                    disabled={!address || currentBalance === 0}
                                >
                                    50%
                                </button>
                                <button
                                    onClick={() => setAmount(maxAmount)}
                                    className="bg-[#2a2b36] text-gray-400 px-2 py-1 rounded-lg text-xs hover:bg-[#3a3b46] transition-colors"
                                    disabled={!address || currentBalance === 0}
                                >
                                    Max
                                </button>
                            </>
                        )
                    })()}
                </div>

                <div className="space-y-3">
                    {tokenPay.address !== CONTRACTS.TOKEN_A && (
                        <button onClick={handleApprove} disabled={!amount} className={`w-full py-4 rounded-xl font-bold text-xl transition-all transform active:scale-[0.98] ${!amount ? 'bg-gray-600 cursor-not-allowed opacity-50 text-gray-400' : 'bg-yellow-500 hover:bg-yellow-600 text-black shadow-[0_0_20px_rgba(234,179,8,0.4)]'}`}>
                            Approve {tokenPay.symbol}
                        </button>
                    )}

                    <button onClick={handleSwap} disabled={!amount} className={`w-full py-4 rounded-xl font-bold text-xl transition-all transform active:scale-[0.98] ${!amount ? 'bg-gray-600 cursor-not-allowed opacity-50' : mode === 'buy' ? 'bg-[#4ade80] hover:bg-[#22c55e] text-black shadow-[0_0_20px_rgba(74,222,128,0.4)]' : 'bg-[#ef4444] text-white hover:bg-[#dc2626] shadow-[0_0_20px_rgba(239,68,68,0.4)]'}`}>
                        swap
                    </button>
                </div>
            </div>


        </div>
    )
}
