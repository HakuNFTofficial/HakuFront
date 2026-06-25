// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IProtocolFees} from "@uniswap/v4-core/src/interfaces/IProtocolFees.sol";

contract FindSelector is Script {
    function run() external pure {
        // IPoolManager errors
        // (Add some common ones to test)
        // Actually let's just use cast sig manually if we can't find it here.
    }
}
