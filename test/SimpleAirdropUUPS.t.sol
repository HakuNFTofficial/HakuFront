// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SimpleAirdrop.sol";
import {
    ERC1967Proxy
} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {TestToken} from "../src/TestToken.sol";

contract SimpleAirdropV2Mock is SimpleAirdrop {
    function version() external pure returns (string memory) {
        return "v2";
    }
}

contract SimpleAirdropUUPSTest is Test {
    SimpleAirdrop public implementation;
    ERC1967Proxy public proxy;
    SimpleAirdrop public airdrop; // This will be the proxy cast as SimpleAirdrop
    TestToken public token;
    address public admin;
    address public user;

    function setUp() public {
        admin = address(this);
        user = address(0x1);

        token = new TestToken("Test", "TEST", 18);
        implementation = new SimpleAirdrop();

        bytes memory initData = abi.encodeCall(
            SimpleAirdrop.initialize,
            (address(token), admin)
        );

        proxy = new ERC1967Proxy(address(implementation), initData);
        airdrop = SimpleAirdrop(address(proxy));
    }

    function testInitialization() public {
        assertEq(address(airdrop.token()), address(token));
        assertEq(airdrop.admin(), admin);
        assertEq(airdrop.maxAirdropAmount(), 10000 * 1e18);
    }

    function testUpgrade() public {
        // Deploy V2
        SimpleAirdropV2Mock implementationV2 = new SimpleAirdropV2Mock();

        // Upgrade
        airdrop.upgradeToAndCall(address(implementationV2), "");

        // Verify upgrade
        // Cast proxy to V2 to call new function
        SimpleAirdropV2Mock airdropV2 = SimpleAirdropV2Mock(address(proxy));
        assertEq(airdropV2.version(), "v2");

        // Verify state is preserved
        assertEq(address(airdropV2.token()), address(token));
        assertEq(airdropV2.admin(), admin);
    }

    function testUpgradeUnauthorized() public {
        SimpleAirdropV2Mock implementationV2 = new SimpleAirdropV2Mock();

        vm.prank(user); // Not admin
        vm.expectRevert("Only admin can call");
        airdrop.upgradeToAndCall(address(implementationV2), "");
    }
}
