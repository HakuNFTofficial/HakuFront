// Contract addresses for Arc Mainnet (chain ID 5042)
export const CONTRACTS = {
    POOL_MANAGER: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
    POSITION_MANAGER: '0x6049c9a0e26405C0985f9E3685C87d0aE917f82B',
    TOKEN_A: '0x0000000000000000000000000000000000000000', // Arc native USDC
    TOKEN_B: '0x4CB940e83b3D404e19ec004468c74f58488447f0', // HakuToken Proxy
    SWAP_ROUTER: '0x30487552012df20a97df8C1d93c68921Feb8246d', // SwapExecutor Proxy
    ADD_LIQUIDITY_EXECUTOR: '0x8D99071E498240Ee3750dd7B96297eEae5B556E7', // AddLiquidityExecutor Proxy
    // V4Quoter contract address (must match QUOTER in PoolConfig.sol)
    QUOTER: '0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94', // V4Quoter contract
    // HukuNFT contract address
    HUKU_NFT: '0x0000000000000000000000000000000000000000', // Set after mainnet deployment
} as const

/**
 * Dynamic Fee Flag (from LPFeeLibrary)
 * This flag indicates that the pool uses dynamic fees set by the hook
 */
export const DYNAMIC_FEE_FLAG = 0x800000 // LPFeeLibrary.DYNAMIC_FEE_FLAG

/**
 * Pool Configuration
 * Update these parameters when reinitializing the pool
 */
export const POOL_CONFIG = {
    // currency0 and currency1 are sorted automatically (smaller address is currency0)
    // But for clarity, we specify them explicitly
    CURRENCY0: CONTRACTS.TOKEN_A, // Arc native USDC, address 0x0
    CURRENCY1: CONTRACTS.TOKEN_B, // HakuToken Proxy

    // Pool Parameters
    FEE: DYNAMIC_FEE_FLAG,  // Dynamic fee flag (0x800000) - actual fee set by hook
    HOOK_FEE: 3000,         // Actual fee rate set by hook: 0.3% (3000 basis points)
    TICK_SPACING: 60,       // Tick spacing
    HOOKS: '0x3504A8f7012262D6f7aDba974074a07cd0Cd0080' as `0x${string}`, // FeeGrowthHook
    SQRT_PRICE_X96: '35431911422859142059220343232145', // 1 native USDC = 200,000 HAKU
    POOL_ID: '0x97599ed312513acfed3833173452d6bcf330c1bf368945b84d0619d54bef52d7' as `0x${string}`,

    // Other contract addresses (must match PoolConfig.sol)
    QUOTER: CONTRACTS.QUOTER, // V4Quoter contract address
} as const

/**
 * Trading Pair Configuration
 * Used by K-line chart and other trading-related components
 */
export const TRADING_PAIR_CONFIG = {
    // Token symbols for display
    BASE_TOKEN_SYMBOL: 'USDC',     // Base token symbol
    QUOTE_TOKEN_SYMBOL: 'HakuToken', // Quote token symbol
    PAIR_NAME: 'USDC/HakuToken',   // Trading pair name (for display)

    // API related configuration
    PAIR_ID: 1,                    // Backend API pair_id
} as const

/**
 * Swap Configuration
 * Configuration for Swap component
 */
export const SWAP_CONFIG = {
    // Default slippage tolerance (%)
    DEFAULT_SLIPPAGE_TOLERANCE: 1, // Default 1% slippage tolerance
} as const

// ERC20 ABI (minimal)
export const ERC20_ABI = [
    {
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        name: 'allowance',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        name: 'approve',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'name',
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'symbol',
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        name: 'mint',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    // ERC20 Transfer event (for listening to user transfers)
    {
        type: 'event',
        name: 'Transfer',
        inputs: [
            { name: 'from', type: 'address', indexed: true },
            { name: 'to', type: 'address', indexed: true },
            { name: 'value', type: 'uint256', indexed: false },
        ],
    },
] as const

export const SWAP_EXECUTOR_ABI = [
    {
        inputs: [
            { name: 'amountIn', type: 'uint256' },
            { name: 'minAmountOut', type: 'uint256' },
        ],
        name: 'swapAForB',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { name: 'amountIn', type: 'uint256' },
            { name: 'minAmountOut', type: 'uint256' },
        ],
        name: 'swapBForA',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const

export const POOL_MANAGER_ABI = [
    {
        inputs: [{ name: 'slot', type: 'bytes32' }],
        name: 'extsload',
        outputs: [{ name: 'value', type: 'bytes32' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const

import PositionManagerABI from '../abis/PositionManager.json'
export const POSITION_MANAGER_ABI = PositionManagerABI

// V4Quoter ABI
export const QUOTER_ABI = [
    {
        inputs: [
            {
                components: [
                    {
                        components: [
                            { name: 'currency0', type: 'address' },
                            { name: 'currency1', type: 'address' },
                            { name: 'fee', type: 'uint24' },
                            { name: 'tickSpacing', type: 'int24' },
                            { name: 'hooks', type: 'address' },
                        ],
                        name: 'poolKey',
                        type: 'tuple',
                    },
                    { name: 'zeroForOne', type: 'bool' },
                    { name: 'exactAmount', type: 'uint128' },
                    { name: 'hookData', type: 'bytes' },
                ],
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'quoteExactInputSingle',
        outputs: [
            { name: 'amountOut', type: 'uint256' },
            { name: 'gasEstimate', type: 'uint256' },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const

// HukuNFT ABI
export const HUKU_NFT_ABI = [
    {
        type: 'function',
        name: 'safeMint',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'remark', type: 'string' },
            { name: 'tokenURL', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
    },
    {
        type: 'event',
        name: 'HakuNFTMint',
        inputs: [
            { name: 'from', type: 'address', indexed: true },
            { name: 'to', type: 'address', indexed: true },
            { name: 'value', type: 'uint256', indexed: false },
            { name: 'tokenId', type: 'uint256', indexed: true },
            { name: 'remark', type: 'string', indexed: false },
        ],
    },
    {
        type: 'function',
        name: 'mintPrice',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'hakuToken',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getHakuTokenBalance',
        inputs: [],
        outputs: [{ name: 'balance', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'owner',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'withdrawHakuToken',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'withdrawHakuToken',
        inputs: [{ name: 'amount', type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'setMintPrice',
        inputs: [{ name: '_mintPrice', type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'updateMintPrice',
        inputs: [{ name: '_mintPrice', type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'setBaseCID',
        inputs: [{ name: 'cid_', type: 'string' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'userBurn',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'ownerOf',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
    },
    {
        type: 'event',
        name: 'TokenBurned',
        inputs: [
            { name: 'tokenId', type: 'uint256', indexed: true },
            { name: 'owner', type: 'address', indexed: true },
            { name: 'refundTo', type: 'address', indexed: true },
            { name: 'refundAmount', type: 'uint256', indexed: false },
        ],
    },
] as const
