// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IV4Quoter} from "v4-periphery/src/interfaces/IV4Quoter.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {V4Quoter} from "v4-periphery/src/lens/V4Quoter.sol";
import {PoolConfig} from "../src/PoolConfig.sol";
import "forge-std/console.sol";

contract DeployQuoter is Script {
    function run() external returns (address) {
        vm.startBroadcast();

        // 部署 V4Quoter 合约
        V4Quoter quoter = new V4Quoter(IPoolManager(PoolConfig.POOL_MANAGER));
        address quoterAddress = address(quoter);

        console.log("========================================");
        console.log("V4Quoter deployed successfully!");
        console.log("========================================");
        console.log("Quoter address:", quoterAddress);
        console.log("PoolManager:", address(quoter.poolManager()));
        console.log("========================================");

        vm.stopBroadcast();
        return quoterAddress;
    }
}
