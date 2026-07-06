// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {HukuNFT} from "../src/HukuNFT.sol";
import {PoolConfig} from "../src/PoolConfig.sol";

contract HukuNFTTest is Test {
    HukuNFT internal nft;

    address internal minter = address(0xA11CE);
    address internal recipient = address(0xB0B);
    uint256 internal mintPrice = 10_000 ether;

    function setUp() public {
        HukuNFT implementation = new HukuNFT();
        bytes memory initData = abi.encodeCall(
            HukuNFT.initialize,
            ("HukuNFT", "HUKU", "test-cid", address(this), mintPrice)
        );

        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        nft = HukuNFT(address(proxy));
    }

    function testBurnRefundsCurrentOwnerAfterTransfer() public {
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

        vm.prank(minter);
        uint256 tokenId = nft.safeMint(minter, "offline-1422", 1422);

        vm.prank(minter);
        nft.transferFrom(minter, recipient, tokenId);

        vm.mockCall(
            PoolConfig.TOKEN_B,
            abi.encodeWithSelector(IERC20.balanceOf.selector, address(nft)),
            abi.encode(mintPrice)
        );
        vm.mockCall(
            PoolConfig.TOKEN_B,
            abi.encodeWithSelector(
                IERC20.transfer.selector,
                recipient,
                mintPrice
            ),
            abi.encode(true)
        );

        vm.expectCall(
            PoolConfig.TOKEN_B,
            abi.encodeWithSelector(
                IERC20.transfer.selector,
                recipient,
                mintPrice
            )
        );

        vm.prank(recipient);
        nft.userBurn(tokenId);
    }
}
