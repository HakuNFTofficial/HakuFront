// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolConfig} from "../src/PoolConfig.sol";
import {FixedPoint128} from "@uniswap/v4-core/src/libraries/FixedPoint128.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

contract CheckFees is Script {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for PoolManager;

    address constant EXECUTOR = 0xB93Fcd0919b8cB83abEb417060D9120Db8Bc90B0;

    function run() external view {
        PoolManager manager = PoolManager(PoolConfig.POOL_MANAGER);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(PoolConfig.TOKEN_A),
            currency1: Currency.wrap(PoolConfig.TOKEN_B),
            fee: PoolConfig.FEE,
            tickSpacing: PoolConfig.TICK_SPACING,
            hooks: IHooks(PoolConfig.HOOKS)
        });

        PoolId id = key.toId();

        (uint256 feeGrowthGlobal0, uint256 feeGrowthGlobal1) = manager
            .getFeeGrowthGlobals(id);
        (uint128 liquidity, uint256 fgl0Last, uint256 fgl1Last) = manager
            .getPositionInfo(id, EXECUTOR, PoolConfig.TICK_LOWER, PoolConfig.TICK_UPPER, PoolConfig.SALT);

        console.log("=== Fee Growth Status ===");
        console.log("Global FeeGrowth0:", feeGrowthGlobal0);
        console.log("Global FeeGrowth1:", feeGrowthGlobal1);
        console.log("\n=== Position Status ===");
        console.log("Liquidity:", liquidity);
        console.log("Last FeeGrowth0:", fgl0Last);
        console.log("Last FeeGrowth1:", fgl1Last);

        if (liquidity > 0) {
            uint256 pending0 = FullMath.mulDiv(
                feeGrowthGlobal0 - fgl0Last,
                liquidity,
                FixedPoint128.Q128
            );
            uint256 pending1 = FullMath.mulDiv(
                feeGrowthGlobal1 - fgl1Last,
                liquidity,
                FixedPoint128.Q128
            );

            console.log("\n=== Accrued Fees (Uncollected) ===");
            console.log("Token0 (STT):", pending0);
            console.log("Token1 (Haku):", pending1);
        } else {
            console.log("\n[WARNING] No liquidity found for this position.");
        }
    }
}
