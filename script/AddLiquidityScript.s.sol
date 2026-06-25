// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

import "forge-std/Script.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {PoolManager} from "../lib/v4-core/src/PoolManager.sol";
import {Currency, CurrencyLibrary} from "../lib/v4-core/src/types/Currency.sol";
import {PoolKey} from "../lib/v4-core/src/types/PoolKey.sol";
import {IHooks} from "../lib/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "../lib/v4-core/src/interfaces/IPoolManager.sol";
import {BalanceDelta} from "../lib/v4-core/src/types/BalanceDelta.sol";

contract AddLiquidityScript is Script {
    address tokenA = 0x678Ce690A3a2bD72CC5BCDEACE594f6278E0622d;
    address tokenB = 0xaB25a7cA13C21d67fEf0fc055A4f5295dB3e524D;

    // 已部署的 PoolManager 地址
    address poolManagerAddr = 0x282A7B4Fe74a97ccAd14f962A2eBFC98C7a8D7F6;
    BalanceDelta callerDelta;
    BalanceDelta feesAccrued;
    function run() external {
        vm.startBroadcast();

        IPoolManager poolManager = IPoolManager(poolManagerAddr);

        // 先 approve token 给 PoolManager
        uint256 amount = 1e18; // 添加流动性数量对应的 token 数量，视你的比例
        IERC20(tokenA).approve(poolManagerAddr, amount);
        IERC20(tokenB).approve(poolManagerAddr, amount);

        // 使用已存在池子的 PoolKey
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(tokenA),
            currency1: Currency.wrap(tokenB),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0)) // V4 可以传 0
        });

        // 添加流动性参数
        IPoolManager.ModifyLiquidityParams memory params = IPoolManager
            .ModifyLiquidityParams({
                tickLower: -120, // 下限 tick
                tickUpper: 120, // 上限 tick
                liquidityDelta: 1e18, // 流动性数量
                salt: 0 // 可选随机值
            });

        // 给池子添加流动性
        (callerDelta, feesAccrued) = poolManager.modifyLiquidity(
            key,
            params,
            ""
        );

        console.log("add liquidity success");
        console.log("user balance: delta token0:", callerDelta.amount0());
        console.log("user balance: delta token1:", callerDelta.amount1());

        vm.stopBroadcast();
    }
}
