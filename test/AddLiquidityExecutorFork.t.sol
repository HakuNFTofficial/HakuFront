// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {AddLiquidityExecutor} from "../src/AddLiquidityExecutor.sol";

interface IBudgetedLiquidityExecutor {
    function addLiquidity(
        uint256 amount0Max,
        uint256 amount1Max,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 deadline
    ) external payable;
}

contract AddLiquidityExecutorForkTest is Test {
    error DeadlineExpired(uint256 deadline, uint256 currentTimestamp);
    error InvalidMinimumAmount(uint8 currency, uint256 minimum, uint256 maximum);
    error OwnableUnauthorizedAccount(address account);

    uint256 internal constant FORK_BLOCK = 59_904_994;
    address internal constant POOL_MANAGER = 0x447032aAa569105437516dA21792862Bf05422C6;
    address internal constant HAKU = 0x19c02CC2118Afe3CB59bb2f777d1a1124c7A6C12;
    address internal constant HAKU_WHALE = 0xD693a84A55fd1CbA3e1B5d82571b4Cfe1aF14510;
    bytes32 internal constant POOL_ID = 0x12512a4efd2e73344522fd8f20520575d943f6127fde7a0b6c8d70f41cfe8f5c;
    int24 internal constant TICK_LOWER = -887220;
    int24 internal constant TICK_UPPER = 887220;
    bytes32 internal constant POSITION_SALT = bytes32(0);

    uint256 internal constant AMOUNT0_MAX = 25_000 ether;
    uint256 internal constant AMOUNT1_MAX = 50_000_000 ether;
    uint256 internal constant AMOUNT0_MIN = (AMOUNT0_MAX * 9_950) / 10_000;
    uint256 internal constant AMOUNT1_MIN = (AMOUNT1_MAX * 9_950) / 10_000;

    bool internal forkEnabled;
    AddLiquidityExecutor internal executor;
    IBudgetedLiquidityExecutor internal budgetedExecutor;
    IERC20 internal haku;

    function setUp() public {
        string memory rpcUrl = vm.envOr("ARC_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) return;

        vm.createSelectFork(rpcUrl, FORK_BLOCK);
        forkEnabled = true;

        AddLiquidityExecutor implementation = new AddLiquidityExecutor();
        bytes memory initData = abi.encodeCall(AddLiquidityExecutor.initialize, (POOL_MANAGER));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        executor = AddLiquidityExecutor(payable(address(proxy)));
        budgetedExecutor = IBudgetedLiquidityExecutor(address(proxy));
        haku = IERC20(HAKU);

        vm.prank(HAKU_WHALE);
        assertTrue(haku.transfer(address(this), AMOUNT1_MAX));
        haku.approve(address(executor), AMOUNT1_MAX);
        vm.deal(address(this), AMOUNT0_MAX + 1 ether);
    }

    function testAddsLiquidityFromBothBudgetsAndRefundsRemainders() public {
        if (!forkEnabled) return;

        uint256 nativeBefore = address(this).balance;
        uint256 hakuBefore = haku.balanceOf(address(this));

        budgetedExecutor.addLiquidity{value: AMOUNT0_MAX}(
            AMOUNT0_MAX, AMOUNT1_MAX, AMOUNT0_MIN, AMOUNT1_MIN, block.timestamp + 300
        );

        uint256 nativeUsed = nativeBefore - address(this).balance;
        uint256 hakuUsed = hakuBefore - haku.balanceOf(address(this));
        assertGe(nativeUsed, AMOUNT0_MIN);
        assertLe(nativeUsed, AMOUNT0_MAX);
        assertGe(hakuUsed, AMOUNT1_MIN);
        assertLe(hakuUsed, AMOUNT1_MAX);
        assertEq(address(executor).balance, 0);
        assertEq(haku.balanceOf(address(executor)), 0);

        uint128 liquidity =
            executor.getPositionLiquidity(POOL_ID, address(executor), TICK_LOWER, TICK_UPPER, POSITION_SALT);
        assertGt(liquidity, AMOUNT0_MAX);
    }

    function testRejectsExpiredDeadline() public {
        if (!forkEnabled) return;

        uint256 deadline = block.timestamp - 1;
        vm.expectRevert(abi.encodeWithSelector(DeadlineExpired.selector, deadline, block.timestamp));
        budgetedExecutor.addLiquidity{value: AMOUNT0_MAX}(AMOUNT0_MAX, AMOUNT1_MAX, AMOUNT0_MIN, AMOUNT1_MIN, deadline);
    }

    function testRejectsMinimumAboveMaximum() public {
        if (!forkEnabled) return;

        vm.expectRevert(abi.encodeWithSelector(InvalidMinimumAmount.selector, uint8(0), AMOUNT0_MAX + 1, AMOUNT0_MAX));
        budgetedExecutor.addLiquidity{value: AMOUNT0_MAX}(
            AMOUNT0_MAX, AMOUNT1_MAX, AMOUNT0_MAX + 1, AMOUNT1_MIN, block.timestamp + 300
        );
    }

    function testOnlyOwnerCanAddLiquidity() public {
        if (!forkEnabled) return;

        address attacker = address(0xBAD);
        vm.deal(attacker, AMOUNT0_MAX);
        vm.expectRevert(abi.encodeWithSelector(OwnableUnauthorizedAccount.selector, attacker));
        vm.prank(attacker);
        budgetedExecutor.addLiquidity{value: AMOUNT0_MAX}(
            AMOUNT0_MAX, AMOUNT1_MAX, AMOUNT0_MIN, AMOUNT1_MIN, block.timestamp + 300
        );
    }

    receive() external payable {}
}
