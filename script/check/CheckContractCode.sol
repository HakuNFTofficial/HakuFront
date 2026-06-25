// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import "forge-std/Script.sol";

contract CheckContractCode is Script {
    function run() external {
        //0x000000000022D473030F116dDEE9F6B43aC78BA3
        vm.startBroadcast(); // 开始真实 RPC 调用

        address permit2 = 0xaD05f7c50825374aE2dE3F29d36346FB98512182;
        bytes memory code = address(permit2).code;
        if (code.length == 0) {
            console.log("No contract found at Permit2 address");
        } else {
            console.log(
                "Contract exists at Permit2 address, code size:",
                code.length
            );
            console.logBytes(code);
        }
        vm.stopBroadcast();
    }
}
