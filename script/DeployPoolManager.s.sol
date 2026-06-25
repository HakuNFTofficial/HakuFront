// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";

contract DeployPoolManager is Script {
    function run() external returns (PoolManager poolManager) {
        // 开始广播交易到链上
        vm.startBroadcast();

        // 部署 PoolManager
        poolManager = new PoolManager(msg.sender);
        console2.log("PoolManager deployed at:", address(poolManager));

        vm.stopBroadcast();
    }
}
