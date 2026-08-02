// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {HukuNFT} from "../src/HukuNFT.sol";
import {HukuNFTV1StorageFixture} from "./fixtures/HukuNFTV1StorageFixture.sol";

contract HukuNFTMetadataUpgradeTest is Test {
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

    string internal constant BASE_CID = "QmeqYrSGKCaKzcLGuJT3N12HFH4ws47Lqbs18hSiuGEZGn";
    string internal constant HTTPS_BASE = "https://www.hakupump.club/nft-metadata/v2/";
    address internal constant USER = address(0x2FBF4aD90BfE460A0eD12ac8ebF969a1c9462E8c);
    address internal constant HAKU_TOKEN = address(0x19c02CC2118Afe3CB59bb2f777d1a1124c7A6C12);
    uint256 internal constant REFUND = 10_000 ether;

    HukuNFTV1StorageFixture internal v1;
    HukuNFT internal v2Implementation;

    function setUp() public {
        HukuNFTV1StorageFixture implementation = new HukuNFTV1StorageFixture();
        bytes memory initData = abi.encodeCall(
            HukuNFTV1StorageFixture.initialize,
            ("HukuNFT", "HUKU", BASE_CID, address(this), HAKU_TOKEN, REFUND)
        );
        v1 = HukuNFTV1StorageFixture(address(new ERC1967Proxy(address(implementation), initData)));
        v1.seedToken(38, USER, "1551", 740, REFUND);
        v2Implementation = new HukuNFT();
    }

    function testUpgradePreservesStateAndUsesHttpsMetadata() public {
        vm.expectEmit(false, false, false, true, address(v1));
        emit BatchMetadataUpdate(1, 38);
        v1.upgradeToAndCall(
            address(v2Implementation),
            abi.encodeCall(HukuNFT.initializeV2, (HTTPS_BASE))
        );

        HukuNFT upgraded = HukuNFT(address(v1));
        _assertV1State(upgraded);
        assertEq(upgraded.metadataBaseURI(), HTTPS_BASE);
        assertEq(upgraded.tokenURI(38), string.concat(HTTPS_BASE, "740.json"));
        assertTrue(upgraded.supportsInterface(0x49064906));
    }

    function testNonOwnerCannotUpgradeOrInitializeV2() public {
        address attacker = address(0xBAD);
        vm.prank(attacker);
        vm.expectRevert();
        v1.upgradeToAndCall(address(v2Implementation), "");

        v1.upgradeToAndCall(address(v2Implementation), "");
        vm.prank(attacker);
        vm.expectRevert();
        HukuNFT(address(v1)).initializeV2(HTTPS_BASE);
    }

    function testInitializeV2CannotRunTwiceOrOnImplementation() public {
        v1.upgradeToAndCall(
            address(v2Implementation),
            abi.encodeCall(HukuNFT.initializeV2, (HTTPS_BASE))
        );
        vm.expectRevert();
        HukuNFT(address(v1)).initializeV2(HTTPS_BASE);

        vm.expectRevert();
        v2Implementation.initializeV2(HTTPS_BASE);
    }

    function testNonEmptyMetadataBaseMustEndWithSlash() public {
        v1.upgradeToAndCall(address(v2Implementation), "");
        HukuNFT upgraded = HukuNFT(address(v1));

        vm.expectRevert();
        upgraded.initializeV2("https://www.hakupump.club/nft-metadata/v2");

        upgraded.initializeV2(HTTPS_BASE);
        vm.expectRevert();
        upgraded.setMetadataBaseURI("https://www.hakupump.club/nft-metadata/v3");
    }

    function testEmptyMetadataBaseRestoresIpfsFallback() public {
        HukuNFT upgraded = _upgrade();
        upgraded.setMetadataBaseURI("");
        assertEq(
            upgraded.tokenURI(38),
            string.concat("ipfs://", BASE_CID, "/740.json")
        );
    }

    function testCanRollbackToV1AndPreserveV1VisibleState() public {
        HukuNFT upgraded = _upgrade();
        HukuNFTV1StorageFixture rollbackImplementation = new HukuNFTV1StorageFixture();
        upgraded.upgradeToAndCall(address(rollbackImplementation), "");

        HukuNFTV1StorageFixture rolledBack = HukuNFTV1StorageFixture(address(v1));
        assertEq(rolledBack.owner(), address(this));
        assertEq(rolledBack.nextTokenId(), 39);
        assertEq(rolledBack.baseCID(), BASE_CID);
        assertEq(rolledBack.ownerOf(38), USER);
        assertEq(rolledBack.mintUser(38), USER);
        assertEq(rolledBack.offlineIdToTokenId("1551"), 38);
        assertEq(rolledBack.tokenIdToOfflineId(38), "1551");
        assertEq(rolledBack.tokenRefundAmount(38), REFUND);
        assertEq(rolledBack.tokenURI(38), string.concat("ipfs://", BASE_CID, "/740.json"));
    }

    function _upgrade() internal returns (HukuNFT upgraded) {
        v1.upgradeToAndCall(
            address(v2Implementation),
            abi.encodeCall(HukuNFT.initializeV2, (HTTPS_BASE))
        );
        upgraded = HukuNFT(address(v1));
    }

    function _assertV1State(HukuNFT upgraded) internal view {
        assertEq(upgraded.owner(), address(this));
        assertEq(upgraded.nextTokenId(), 39);
        assertEq(upgraded.baseCID(), BASE_CID);
        assertEq(upgraded.ownerOf(38), USER);
        assertEq(upgraded.mintUser(38), USER);
        assertEq(upgraded.offlineIdToTokenId("1551"), 38);
        assertEq(upgraded.tokenIdToOfflineId(38), "1551");
        assertEq(upgraded.tokenRefundAmount(38), REFUND);
    }
}
