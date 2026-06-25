// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {FeeGrowthHook} from "../src/FeeGrowthHook.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import "forge-std/console.sol";

contract MineFeeGrowthHook is Script {
    function hookFlags() public pure returns (uint160) {
        // NOTE: Update these flags if you change the permissions in FeeGrowthHook.sol
        return uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
    }

    function run() external view {
        address poolManager = vm.envAddress("POOL_MANAGER");
        address deployer = vm.envAddress("CREATE2_FACTORY");

        bytes memory constructorArgs = abi.encode(IPoolManager(poolManager));

        (address hookAddress, bytes32 salt) = HookMiner.find(
            deployer,
            hookFlags(),
            type(FeeGrowthHook).creationCode,
            constructorArgs
        );

        bytes memory initCode = abi.encodePacked(
            type(FeeGrowthHook).creationCode,
            constructorArgs
        );

        console.log("PoolManager:");
        console.log(poolManager);
        console.log("Create2 deployer:");
        console.log(deployer);
        console.log("Salt:");
        console.logBytes32(salt);
        console.log("Address:");
        console.log(hookAddress);
        console.log("InitCode:");
        console.logBytes(initCode);
    }
}
