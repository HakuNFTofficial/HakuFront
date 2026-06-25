// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "lib/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "lib/v4-core/src/types/PoolKey.sol";
import {Currency} from "lib/v4-core/src/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "lib/v4-core/src/types/PoolId.sol";
import {IHooks} from "lib/v4-core/src/interfaces/IHooks.sol";
import {StateLibrary} from "lib/v4-core/src/libraries/StateLibrary.sol";

contract CheckPoolState is Script {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    address tokenA = 0xa92D7f077A2f362E2c8A74F0eE723B4dbd9BFAE3;
    address tokenB = 0xD6Ef0332332c0f561Ba3192C9DdBb3E4CAabE953;
    address poolManagerAddr = 0xaD05f7c50825374aE2dE3F29d36346FB98512182;

    function run() external view {
        IPoolManager poolManager = IPoolManager(poolManagerAddr);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(tokenA),
            currency1: Currency.wrap(tokenB),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        PoolId id = key.toId();
        (
            uint160 sqrtPriceX96,
            int24 tick,
            uint24 protocolFee,
            uint24 lpFee
        ) = poolManager.getSlot0(id);

        console.log("Pool ID:");
        console.logBytes32(PoolId.unwrap(id));
        console.log("SqrtPriceX96:", sqrtPriceX96);
        console.log("Tick:", tick);
    }
}
