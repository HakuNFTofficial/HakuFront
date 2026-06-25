// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolConfig} from "../src/PoolConfig.sol";

/**
 * @title InitializePool
 * @notice 初始化 Pool 的脚本
 * @dev 使用 PoolConfig.sol 中的配置参数
 */
contract InitializePool is Script {
    function run() external {
        vm.startBroadcast();

        // 使用 PoolConfig 中的合约地址
        PoolManager poolManager = PoolManager(PoolConfig.POOL_MANAGER);

        // 构造 PoolKey（使用 PoolConfig 中的配置）
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(PoolConfig.TOKEN_A),
            currency1: Currency.wrap(PoolConfig.TOKEN_B),
            fee: PoolConfig.FEE,
            tickSpacing: PoolConfig.TICK_SPACING,
            hooks: IHooks(PoolConfig.HOOKS)
        });

        // 使用 PoolConfig 中的初始价格初始化池子
        int24 tick = poolManager.initialize(key, PoolConfig.SQRT_PRICE_X96);
        
        console.log("Pool initialized successfully!");
        console.log("Pool initialized at tick:", tick);
        console.log("Fee:", PoolConfig.FEE);
        console.log("Tick Spacing:", PoolConfig.TICK_SPACING);
        console.log("Sqrt Price X96:", PoolConfig.SQRT_PRICE_X96);

        vm.stopBroadcast();
    }
}

