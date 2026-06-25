// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {TestToken} from "../src/TestToken.sol";
import {MyTestContract} from "../src/MyTestContract.sol";
import {WETH9} from "../src/WETH9.sol";
import {MyPositionDescriptor} from "../src/MyPositionDescriptor.sol";
import {
    IPositionDescriptor
} from "v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IWETH9} from "v4-periphery/src/interfaces/external/IWETH9.sol";

import {PositionManager} from "v4-periphery/src/PositionManager.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {
    IAllowanceTransfer
} from "permit2/src/interfaces/IAllowanceTransfer.sol";

contract DeployV4 is Script {
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    // IPermit2 public permit2 = IPermit2(PERMIT2);

    function run() external {
        vm.startBroadcast();

        // 部署两个测试代币
        TestToken tokenA = new TestToken("TokenA", "A", 18);
        TestToken tokenB = new TestToken("TokenB", "B", 18);
        console.log("TokenA:", address(tokenA));
        console.log("TokenB:", address(tokenB));

        // 部署 PoolManager (核心)
        PoolManager poolManager = new PoolManager(msg.sender);
        console.log("PoolManager:", address(poolManager));

        // 部署 PositionManager（Periphery）
        //IAllowanceTransfer allowanceTransfer = IAllowanceTransfer(permit2);

        uint256 unsubscribeGasLimit = 100000; // 你自己设置

        // PositionManager constructor: (IPoolManager _poolManager, IAllowanceTransfer _permit2, uint256 _unsubscribeGasLimit, IPositionDescriptor _tokenDescriptor, IWETH9 _weth9)
        // 部署 WETH9
        WETH9 weth = new WETH9();

        MyPositionDescriptor descriptor = new MyPositionDescriptor(
            address(poolManager)
        );
        // permit2 已经有 (we don't need a local variable)
        // 部署 PositionManager
        // cast descriptor address to the periphery interface type expected by PositionManager
        PositionManager posManager = new PositionManager(
            poolManager,
            IAllowanceTransfer(PERMIT2),
            unsubscribeGasLimit,
            IPositionDescriptor(address(descriptor)),
            /** cast weth address to expected IWETH9 type in constructor without importing it here */
            IWETH9(address(weth))
        );

        console.log("PositionManager:", address(posManager));
        // 部署你的测试合约
        MyTestContract my = new MyTestContract(
            address(poolManager),
            address(posManager)
        );
        console.log("MyTestContract:", address(my));

        vm.stopBroadcast();
    }
}
