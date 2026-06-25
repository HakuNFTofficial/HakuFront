// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {TestHook} from "../src/TestHook.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Create2Factory} from "../src/Create2Factory.sol";
import "forge-std/console.sol";

contract DeployTestHook is Script {
    address constant POOL_MANAGER = 0xaD05f7c50825374aE2dE3F29d36346FB98512182;
    address constant CUSTOM_CREATE2_FACTORY =
        0x81B857dEECdE0ac3dA83544bBAfCc5955dE24595;

    function run() external {
        string memory rpcUrl = vm.envString("ETH_RPC_URL");
        vm.createSelectFork(rpcUrl);

        uint160 flags = uint160(Hooks.AFTER_SWAP_FLAG);

        address deployer = CUSTOM_CREATE2_FACTORY;

        bytes memory constructorArgs = abi.encode(IPoolManager(POOL_MANAGER));

        (address hookAddress, bytes32 salt) = HookMiner.find(
            deployer,
            flags,
            type(TestHook).creationCode,
            constructorArgs
        );

        console.log("Mined salt:", uint256(salt));
        console.log("Predicted address:", hookAddress);

        vm.startBroadcast();
        Create2Factory(CUSTOM_CREATE2_FACTORY).deploy(
            uint256(salt),
            abi.encodePacked(type(TestHook).creationCode, constructorArgs)
        );
        vm.stopBroadcast();
    }
}
