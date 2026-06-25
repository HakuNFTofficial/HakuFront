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

contract SimpleAirdropTest is Test {
    SimpleAirdrop public implementation;
    ERC1967Proxy public proxy;
    SimpleAirdrop public airdrop;
    TestToken public token;
    address public admin;
    address public user1;
    address public user2;

    event Airdropped(
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );
    event MaxAirdropAmountUpdated(uint256 newMax);
    event MaxTotalPerAddressUpdated(uint256 newMax);
    event AirdropPaused();
    event AirdropResumed();
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    function setUp() public {
        admin = address(this);
        user1 = address(0x1);
        user2 = address(0x2);

        // Deploy Token
        token = new TestToken("Test", "TEST", 18);

        // Deploy Implementation
        implementation = new SimpleAirdrop();

        // Prepare Init Data
        bytes memory initData = abi.encodeCall(
            SimpleAirdrop.initialize,
            (address(token), admin)
        );

        // Deploy Proxy
        proxy = new ERC1967Proxy(address(implementation), initData);
        airdrop = SimpleAirdrop(address(proxy));

        // Fund Airdrop Contract
        token.transfer(address(airdrop), 100000 * 1e18);
    }

    function testInitialization() public {
        assertEq(address(airdrop.token()), address(token));
        assertEq(airdrop.admin(), admin);
        assertEq(airdrop.maxAirdropAmount(), 10000 * 1e18);
        assertEq(airdrop.maxTotalPerAddress(), 50000 * 1e18);
        assertEq(airdrop.airdropPaused(), false);
    }

    function testAirdrop() public {
        uint256 amount = 100 * 1e18;

        vm.expectEmit(true, false, false, true);
        emit Airdropped(user1, amount, block.timestamp);

        airdrop.airdrop(user1, amount);

        assertEq(token.balanceOf(user1), amount);
        assertEq(airdrop.totalAirdropped(user1), amount);
        assertEq(airdrop.totalAirdropCount(), 1);
        assertEq(airdrop.totalAirdropVolume(), amount);
    }

    function testAirdropLimits() public {
        // Test Max Amount Per Transaction
        uint256 maxAmount = airdrop.maxAirdropAmount();
        vm.expectRevert("Exceeds max airdrop amount");
        airdrop.airdrop(user1, maxAmount + 1);

        // Test Max Total Per Address
        uint256 maxTotal = airdrop.maxTotalPerAddress();

        // Fill up to maxTotal using multiple transactions
        uint256 chunkSize = airdrop.maxAirdropAmount();
        uint256 remaining = maxTotal;

        while (remaining > 0) {
            uint256 amount = remaining > chunkSize ? chunkSize : remaining;
            airdrop.airdrop(user1, amount);
            remaining -= amount;
        }

        // Next airdrop exceeding limit
        vm.expectRevert("Exceeds max total per address");
        airdrop.airdrop(user1, 1);
    }

    function testAirdropPaused() public {
        airdrop.pauseAirdrop();

        vm.expectRevert("Airdrop is paused");
        airdrop.airdrop(user1, 100 * 1e18);

        airdrop.resumeAirdrop();
        airdrop.airdrop(user1, 100 * 1e18);
        assertEq(token.balanceOf(user1), 100 * 1e18);
    }

    function testAdminFunctions() public {
        // Set Max Airdrop Amount
        uint256 newMaxAmount = 20000 * 1e18;
        vm.expectEmit(false, false, false, true);
        emit MaxAirdropAmountUpdated(newMaxAmount);
        airdrop.setMaxAirdropAmount(newMaxAmount);
        assertEq(airdrop.maxAirdropAmount(), newMaxAmount);

        // Set Max Total Per Address
        uint256 newMaxTotal = 60000 * 1e18;
        vm.expectEmit(false, false, false, true);
        emit MaxTotalPerAddressUpdated(newMaxTotal);
        airdrop.setMaxTotalPerAddress(newMaxTotal);
        assertEq(airdrop.maxTotalPerAddress(), newMaxTotal);

        // Pause/Resume
        vm.expectEmit(false, false, false, true);
        emit AirdropPaused();
        airdrop.pauseAirdrop();
        assertEq(airdrop.airdropPaused(), true);

        vm.expectEmit(false, false, false, true);
        emit AirdropResumed();
        airdrop.resumeAirdrop();
        assertEq(airdrop.airdropPaused(), false);

        // Change Admin
        address newAdmin = address(0x999);
        vm.expectEmit(true, true, false, false);
        emit AdminChanged(admin, newAdmin);
        airdrop.changeAdmin(newAdmin);
        assertEq(airdrop.admin(), newAdmin);

        // Verify old admin lost access
        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector,
                admin
            )
        );
        airdrop.pauseAirdrop();

        // Verify new admin has access
        vm.prank(newAdmin);
        airdrop.pauseAirdrop();
    }

    function testWithdrawTokens() public {
        uint256 balanceBefore = token.balanceOf(admin);
        uint256 withdrawAmount = 5000 * 1e18;

        airdrop.withdrawTokens(withdrawAmount);

        assertEq(token.balanceOf(admin), balanceBefore + withdrawAmount);
        assertEq(
            token.balanceOf(address(airdrop)),
            100000 * 1e18 - withdrawAmount
        );
    }

    function testAccessControl() public {
        vm.startPrank(user1);

        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector,
                user1
            )
        );
        airdrop.airdrop(user2, 100);

        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector,
                user1
            )
        );
        airdrop.setMaxAirdropAmount(100);

        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector,
                user1
            )
        );
        airdrop.setMaxTotalPerAddress(100);

        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector,
                user1
            )
        );
        airdrop.pauseAirdrop();

        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector,
                user1
            )
        );
        airdrop.resumeAirdrop();

        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector,
                user1
            )
        );
        airdrop.changeAdmin(user2);

        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector,
                user1
            )
        );
        airdrop.withdrawTokens(100);

        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector,
                user1
            )
        );
        airdrop.upgradeToAndCall(address(0), "");

        vm.stopPrank();
    }

    function testUpgrade() public {
        SimpleAirdropV2Mock implementationV2 = new SimpleAirdropV2Mock();

        airdrop.upgradeToAndCall(address(implementationV2), "");

        SimpleAirdropV2Mock airdropV2 = SimpleAirdropV2Mock(address(proxy));
        assertEq(airdropV2.version(), "v2");

        // State preserved
        assertEq(address(airdropV2.token()), address(token));
        assertEq(airdropV2.admin(), admin);
    }
}
