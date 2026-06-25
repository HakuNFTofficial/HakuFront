// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {
    BeforeSwapDelta,
    toBeforeSwapDelta
} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolConfig} from "./PoolConfig.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";

// V4 core/periphery sometimes uses a dedicated PoolOperation for params
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @title FeeGrowthHook
/// @notice V3-equivalent concentrated liquidity LP fee model using V4 donate() function
/// @dev This hook captures fees from the input amount and donates them to active LPs.
contract FeeGrowthHook is BaseHook {
    uint24 public constant LPFEE_FOR_NO_CORE_FEE =
        LPFeeLibrary.OVERRIDE_FEE_FLAG; // 0x400000

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    function getHookPermissions()
        public
        pure
        override
        returns (Hooks.Permissions memory)
    {
        return
            Hooks.Permissions({
                beforeInitialize: false,
                afterInitialize: false,
                beforeAddLiquidity: false,
                afterAddLiquidity: false,
                beforeRemoveLiquidity: false,
                afterRemoveLiquidity: false,
                beforeSwap: true,
                afterSwap: false,
                beforeDonate: false,
                afterDonate: false,
                beforeSwapReturnDelta: true,
                afterSwapReturnDelta: false,
                afterAddLiquidityReturnDelta: false,
                afterRemoveLiquidityReturnDelta: false
            });
    }

    /// @notice Implements V3-style pre-calculated fees
    /// @dev Calculates fee from input, takes it from PoolManager, and donates it to distribution.
    function _beforeSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        // Only handle Exact Input (V3 fee-on-input style)
        if (params.amountSpecified >= 0) {
            return (BaseHook.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
        }
        uint256 feeAmount = (uint256(-params.amountSpecified) *
            PoolConfig.HOOK_FEE) / 1e6;
        if (feeAmount == 0) {
            return (BaseHook.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
        }
        // Determine input currency
        Currency inputCurrency = params.zeroForOne
            ? key.currency0
            : key.currency1;
        // 1. Donate fee (distributes to active LPs via feeGrowthGlobal)
        // This creates a negative delta for the hook, which is balanced by the positive hookDelta we return.
        if (params.zeroForOne) {
            poolManager.donate(key, feeAmount, 0, "");
        } else {
            poolManager.donate(key, 0, feeAmount, "");
        }
        // 2. Return delta to PoolManager
        // A positive specified delta means the hook is taking some of the input.
        // This reduces the amount that actually goes through the swap core.
        // Ensure feeAmount fits in int128 (which is smaller than uint128, so checking against int128.max is safer for the next cast)
        require(feeAmount <= uint128(type(int128).max), "Fee too large");

        BeforeSwapDelta hookDelta = toBeforeSwapDelta(
            int128(uint128(feeAmount)),
            0
        );

        return (BaseHook.beforeSwap.selector, hookDelta, LPFEE_FOR_NO_CORE_FEE);
    }
    /// @notice Simple afterSwap hook (no-op, for logging or extension)
    /// @dev Currently does nothing and returns the selector
    /*  function _afterSwap(
        address,
        PoolKey calldata,
        SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        // No post-swap logic for now
        return (BaseHook.afterSwap.selector, 0);
    } */
}
