// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {FeeGrowthHook} from "../src/FeeGrowthHook.sol";
import {MineFeeGrowthHook} from "../script/MineFeeGrowthHook.s.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import "forge-std/console.sol";

contract MineHookTest is Test {
    address constant POOL_MANAGER = 0xaD05f7c50825374aE2dE3F29d36346FB98512182;
    address constant CUSTOM_CREATE2_FACTORY =
        0x81B857dEECdE0ac3dA83544bBAfCc5955dE24595;

    function testMineScriptFlagsMatchFeeGrowthHookPermissions() public {
        MineFeeGrowthHook mineScript = new MineFeeGrowthHook();
        uint160 expectedFlags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );

        assertEq(mineScript.hookFlags(), expectedFlags);
    }

    function testMine() public {
        MineFeeGrowthHook mineScript = new MineFeeGrowthHook();
        uint160 flags = mineScript.hookFlags();

        address deployer = CUSTOM_CREATE2_FACTORY;
        bytes memory constructorArgs = abi.encode(IPoolManager(POOL_MANAGER));

        (address hookAddress, bytes32 salt) = HookMiner.find(
            deployer,
            flags,
            type(FeeGrowthHook).creationCode,
            constructorArgs
        );

        console.log("SALT_HEX:", vm.toString(salt));
        console.log("ADDRESS:", hookAddress);
    }
}
