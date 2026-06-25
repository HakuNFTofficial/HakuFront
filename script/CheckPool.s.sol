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

contract CheckPool is Script {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for PoolManager;

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
        
        // 验证计算的 PoolId 是否与配置一致
        console.log("Calculated Pool ID:");
        console.logBytes32(PoolId.unwrap(id));
        console.log("Expected Pool ID from PoolConfig:");
        console.logBytes32(PoolConfig.POOL_ID);
        
        if (PoolId.unwrap(id) == PoolConfig.POOL_ID) {
            console.log("[OK] Pool ID matches PoolConfig");
        } else {
            console.log("[WARNING] Pool ID mismatch!");
        }
        
        (
            uint160 sqrtPriceX96,
            int24 tick,
            uint24 protocolFee,
            uint24 lpFee
        ) = manager.getSlot0(id);

        console.log("\n=== Pool Status ===");
        console.log("SqrtPriceX96:", sqrtPriceX96);
        console.log("Tick:", tick);
        console.log("Protocol Fee:", protocolFee);
        console.log("LP Fee:", lpFee);

        if (sqrtPriceX96 == 0) {
            console.log("\n[ERROR] Pool NOT initialized");
        } else {
            console.log("\n[OK] Pool initialized");
            uint128 liquidity = manager.getLiquidity(id);
            console.log("Liquidity:", liquidity);
            
            // 验证初始价格
            if (sqrtPriceX96 == PoolConfig.SQRT_PRICE_X96) {
                console.log("[OK] Initial price matches PoolConfig");
            } else {
                console.log("[WARNING] Price has changed from initial:", PoolConfig.SQRT_PRICE_X96);
            }
        }
    }
}
