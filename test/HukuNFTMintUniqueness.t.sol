// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {HukuNFT} from "../src/HukuNFT.sol";
import {PoolConfig} from "../src/PoolConfig.sol";

contract HukuNFTMintUniquenessTest is Test {
    HukuNFT internal nft;
    address internal minter = address(0xA11CE);
    uint256 internal mintPrice = 10_000 ether;

    function setUp() public {
        HukuNFT implementation = new HukuNFT();
        bytes memory initData = abi.encodeCall(
            HukuNFT.initialize,
            ("HukuNFT", "HUKU", "test-cid", address(this), mintPrice)
        );
        nft = HukuNFT(address(new ERC1967Proxy(address(implementation), initData)));
    }

    function testSafeMintRevertsForLiveOfflineId() public {
        _mockMintPayment();
        vm.prank(minter);
        nft.safeMint(minter, "offline-1422", 1422);

        _mockMintPayment();
        vm.expectRevert("Offline ID already used");
        vm.prank(minter);
        nft.safeMint(minter, "offline-1422", 1422);
    }

    function testSafeMintAllowsOfflineIdAfterBurn() public {
        _mockMintPayment();
        vm.prank(minter);
        uint256 firstTokenId = nft.safeMint(minter, "offline-1422", 1422);

        _mockBurnRefund();
        vm.prank(minter);
        nft.userBurn(firstTokenId);

        _mockMintPayment();
        vm.prank(minter);
        uint256 secondTokenId = nft.safeMint(minter, "offline-1422", 1422);

        assertEq(secondTokenId, firstTokenId + 1);
        assertEq(nft.offlineIdToTokenId("offline-1422"), secondTokenId);
    }

    function _mockMintPayment() internal {
        vm.mockCall(
            PoolConfig.TOKEN_B,
            abi.encodeWithSelector(
                IERC20.transferFrom.selector,
                minter,
                address(nft),
                mintPrice
            ),
            abi.encode(true)
        );
    }

    function _mockBurnRefund() internal {
        vm.mockCall(
            PoolConfig.TOKEN_B,
            abi.encodeWithSelector(IERC20.balanceOf.selector, address(nft)),
            abi.encode(mintPrice)
        );
        vm.mockCall(
            PoolConfig.TOKEN_B,
            abi.encodeWithSelector(IERC20.transfer.selector, minter, mintPrice),
            abi.encode(true)
        );
    }
}
