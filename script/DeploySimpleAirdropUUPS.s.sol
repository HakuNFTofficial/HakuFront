// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SimpleAirdrop.sol";
import {
    ERC1967Proxy
} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeploySimpleAirdropUUPS is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        // Default to TokenA address if not specified, but this is just for the script
        address tokenAddress = 0xa92D7f077A2f362E2c8A74F0eE723B4dbd9BFAE3;
        address admin = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Implementation
        SimpleAirdrop implementation = new SimpleAirdrop();

        // 2. Encode initialization data
        bytes memory initData = abi.encodeCall(
            SimpleAirdrop.initialize,
            (tokenAddress, admin)
        );

        // 3. Deploy Proxy
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );

        console.log(
            "SimpleAirdrop Implementation deployed at:",
            address(implementation)
        );
        console.log("SimpleAirdrop Proxy deployed at:", address(proxy));

        vm.stopBroadcast();
    }
}
