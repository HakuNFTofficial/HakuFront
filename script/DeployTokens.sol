// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/TestToken.sol";

contract DeployTokens is Script {
    function run() external {
        vm.startBroadcast();

        TestToken tokenA = new TestToken("TokenA", "A", 18);
        TestToken tokenB = new TestToken("TokenB", "B", 18);

        console.log("TokenA:", address(tokenA));
        console.log("TokenB:", address(tokenB));

        vm.stopBroadcast();
    }
}
