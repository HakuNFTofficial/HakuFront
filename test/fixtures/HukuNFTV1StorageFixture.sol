// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {OwnableUpgradeable} from "openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {ERC721Upgradeable} from "openzeppelin-contracts-upgradeable/contracts/token/ERC721/ERC721Upgradeable.sol";
import {ERC721BurnableUpgradeable} from "openzeppelin-contracts-upgradeable/contracts/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import {ERC721URIStorageUpgradeable} from "openzeppelin-contracts-upgradeable/contracts/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import {Initializable} from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";

contract HukuNFTV1StorageFixture is
    Initializable,
    ERC721URIStorageUpgradeable,
    ERC721BurnableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    uint256 public nextTokenId;
    mapping(uint256 => address) public mintUser;
    mapping(string => uint256) public offlineIdToTokenId;
    mapping(uint256 => string) public tokenIdToOfflineId;
    string public baseCID;
    IERC20 public hakuToken;
    uint256 public mintPrice;
    mapping(uint256 => uint256) public tokenRefundAmount;
    uint256[47] private __gap;

    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        string memory cid_,
        address admin_,
        address hakuToken_,
        uint256 mintPrice_
    ) public initializer {
        __ERC721_init(name_, symbol_);
        __ERC721Burnable_init();
        __Ownable_init(admin_);
        baseCID = cid_;
        nextTokenId = 1;
        hakuToken = IERC20(hakuToken_);
        mintPrice = mintPrice_;
    }

    function seedToken(
        uint256 tokenId,
        address user,
        string calldata offlineId,
        uint256 tokenUrl,
        uint256 refundAmount
    ) external onlyOwner {
        _safeMint(user, tokenId);
        _setTokenURI(tokenId, _toString(tokenUrl));
        mintUser[tokenId] = user;
        offlineIdToTokenId[offlineId] = tokenId;
        tokenIdToOfflineId[tokenId] = offlineId;
        tokenRefundAmount[tokenId] = refundAmount;
        nextTokenId = tokenId + 1;
    }

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return string(abi.encodePacked(super.tokenURI(tokenId), ".json"));
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _baseURI() internal view override returns (string memory) {
        return string(abi.encodePacked("ipfs://", baseCID, "/"));
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 digits;
        uint256 remaining = value;
        while (remaining != 0) {
            digits++;
            remaining /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
