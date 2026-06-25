// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolConfig} from "../src/PoolConfig.sol";

interface IAddLiquidityExecutor {
    function removeLiquidity(
        address currency0,
        address currency1,
        uint24 fee,
        int24 tickSpacing,
        address hooks,
        int24 tickLower,
        int24 tickUpper,
        uint256 liquidityAmount,
        bytes32 salt
    ) external;
}

contract CollectFees is Script {
    address constant EXECUTOR_PROXY =
        0xB93Fcd0919b8cB83abEb417060D9120Db8Bc90B0;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        IAddLiquidityExecutor executor = IAddLiquidityExecutor(EXECUTOR_PROXY);

        // 调用 removeLiquidity，但数量设为 0
        // 这会触发 PM 的结算逻辑，将手续费收益提取到 Executor 合约
        executor.removeLiquidity(
            PoolConfig.TOKEN_A,
            PoolConfig.TOKEN_B,
            PoolConfig.FEE,
            PoolConfig.TICK_SPACING,
            PoolConfig.HOOKS,
            PoolConfig.TICK_LOWER, // 从 PoolConfig 读取
            PoolConfig.TICK_UPPER, // 从 PoolConfig 读取
            0, // liquidityAmount = 0 (只取收益，不碰本金)
            PoolConfig.SALT // 从 PoolConfig 读取
        );

        vm.stopBroadcast();
        console.log("CollectFees call executed via Executor.");
        console.log(
            "Fees have been moved from PoolManager to Executor contract."
        );
    }
}
