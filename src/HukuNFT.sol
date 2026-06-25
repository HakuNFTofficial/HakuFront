// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {
    Initializable
} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {
    UUPSUpgradeable
} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {
    OwnableUpgradeable
} from "openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";

import {
    ERC721Upgradeable
} from "openzeppelin-contracts-upgradeable/contracts/token/ERC721/ERC721Upgradeable.sol";
import {
    ERC721URIStorageUpgradeable
} from "openzeppelin-contracts-upgradeable/contracts/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import {
    ERC721BurnableUpgradeable
} from "openzeppelin-contracts-upgradeable/contracts/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {PoolConfig} from "./PoolConfig.sol";

contract HukuNFT is
    Initializable,
    ERC721URIStorageUpgradeable,
    ERC721BurnableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    /// @notice Emitted when a token is minted for a user
    event UserMint(
        uint256 indexed tokenId,
        address indexed user,
        string remark,
        string token_url
    );

    /// @notice Emitted when HakuToken is transferred during minting (包含业务备注)
    /// @dev 业务合约发出的事件，包含转账备注信息
    /// @dev 链下服务可以通过交易哈希或参数匹配关联 Transfer 事件
    /// @param from 发送方地址（用户地址）
    /// @param to 接收方地址（HukuNFT 合约地址）
    /// @param value 转账金额（mintPrice）
    /// @param tokenId 关联的 NFT tokenId
    /// @param remark 业务备注
    event HakuNFTMint(
        address indexed from,
        address indexed to,
        uint256 value,
        uint256 indexed tokenId,
        string remark
    );

    /// @notice Emitted when owner withdraws HakuToken from contract
    event HakuTokenWithdrawn(address indexed to, uint256 amount);

    /// @notice Emitted when mint price is updated
    event MintPriceUpdated(uint256 newPrice);

    /// @notice Emitted when a token is burned and HakuToken is refunded
    /// @dev This event is emitted when both NFT burn and ERC20 refund succeed together (atomic operation)
    /// @param tokenId The token ID that was burned
    /// @param owner The owner address who burned the token
    /// @param refundTo The address that received the HakuToken refund (same as mintUser)
    /// @param refundAmount The amount of HakuToken refunded (0 if mintPrice was 0 or no refund occurred)
    event TokenBurned(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed refundTo,
        uint256 refundAmount
    );

    /// @notice Emitted when a token is transferred between users
    /// @dev This event is emitted when a token is transferred (not minted or burned)
    /// @param tokenId The token ID that was transferred
    /// @param from The address that transferred the token (previous owner)
    /// @param to The address that received the token (new owner)
    /// @param blockNumber The block number when the transfer occurred
    event NFT721TokenTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 blockNumber
    );

    uint256 public nextTokenId;
    mapping(uint256 => address) public mintUser;

    // mapping from offline ID (remark) to tokenId
    mapping(string => uint256) public offlineIdToTokenId;
    // mapping from tokenId to offline ID
    mapping(uint256 => string) public tokenIdToOfflineId;

    // base content identifier (e.g. IPFS CID) used by _baseURI
    string public baseCID;

    // HakuToken payment configuration
    IERC20 public hakuToken; // HakuToken 地址
    uint256 public mintPrice; // 每个 NFT 的价格（以 HakuToken 计价，单位：wei）

    /// @dev Reserve storage gap for future upgrades
    uint256[48] private __gap; // 减少 2 个 slot，为 hakuToken 和 mintPrice 留出空间

    constructor() {
        _disableInitializers();
    }
    /// @notice initialize function for proxy
    /// @param name_ token name
    /// @param symbol_ token symbol
    /// @param cid_ initial baseCID (no trailing slash)
    /// @param _admin owner/admin address
    /// @param _mintPrice mint price in HakuToken (in wei, e.g., 100 * 10^18 for 100 tokens)
    function initialize(
        string memory name_,
        string memory symbol_,
        string memory cid_,
        address _admin,
        uint256 _mintPrice
    ) public initializer {
        __ERC721_init(name_, symbol_);
        __ERC721Burnable_init();
        __Ownable_init(_admin);

        // set owner to admin if provided and different from msg.sender
        if (_admin != address(0) && _admin != msg.sender) {
            transferOwnership(_admin);
        }
        // init fields
        baseCID = cid_;
        nextTokenId = 1;

        // Initialize HakuToken payment configuration
        hakuToken = IERC20(PoolConfig.TOKEN_B); // 从 PoolConfig 读取 HakuToken 地址
        mintPrice = _mintPrice; // 设置 mint 价格
        // UUPS has no separate init in OZ vX; nothing else needed
    }

    /// @notice required by UUPS to authorize upgrades
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /// @notice override base URI used by tokenURI()
    /// @dev Returns ipfs://{baseCID}/
    function _baseURI() internal view override returns (string memory) {
        return string(abi.encodePacked("ipfs://", baseCID, "/"));
    }

    /// @notice Returns the token URI with .json suffix
    /// @dev Returns _baseURI() + tokenURL + ".json"
    /// @param tokenId the token ID to query
    /// @return the token URI string (e.g., ipfs://QmUdbbsh.../123.json)
    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        string memory uri = super.tokenURI(tokenId);
        // Append .json suffix to the URI
        return string(abi.encodePacked(uri, ".json"));
    }

    /// @notice Override supportsInterface to handle multiple inheritance
    /// @dev Required because both ERC721Upgradeable and ERC721URIStorageUpgradeable define this function
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

    /// @notice mint a token for `to`
    /// @dev public mint function - anyone can mint for themselves after eligibility verification
    /// @dev User must have approved HakuToken to this contract before minting
    /// @param to address to mint the token to
    /// @param remark additional information for server interaction (offline ID)
    /// @param tokenURL the numeric part of the token URI (e.g., 123 for ipfs://.../123)
    function safeMint(
        address to,
        string calldata remark,
        uint256 tokenURL
    ) external returns (uint256) {
        require(bytes(remark).length > 0, "Remark cannot be empty");
        //require(offlineIdToTokenId[remark] == 0, "Offline ID already used");

        // 1. 扣除 HakuToken 并转到合约本身（如果 mintPrice > 0）
        uint256 tokenId = 0; // 提前声明，用于事件
        if (mintPrice > 0) {
            // 先计算 tokenId（在转账前，确保事件中的 tokenId 正确）
            tokenId = nextTokenId;

            require(
                hakuToken.transferFrom(msg.sender, address(this), mintPrice),
                "HakuToken transfer failed"
            );

            // 发出包含备注的转账事件（与 Transfer 事件在同一个交易中
            // 链下服务可以通过交易哈希关联这两个事件
            string memory mintRemark = string(
                abi.encodePacked(
                    "MintNFT#",
                    remark,
                    ":",
                    Strings.toString(tokenURL)
                )
            );
            emit HakuNFTMint(
                msg.sender, // from
                address(this), // to
                mintPrice, // value
                tokenId, // tokenId（虽然还未 mint，但值已确定）
                mintRemark // 业务备注
            );
        }

        // 2. Mint NFT
        if (tokenId == 0) {
            tokenId = nextTokenId;
        }
        nextTokenId = tokenId + 1;

        _safeMint(to, tokenId);

        // Set custom token URI using the specified tokenURL number
        string memory tokenURIString = Strings.toString(tokenURL);
        _setTokenURI(tokenId, tokenURIString);

        mintUser[tokenId] = to;

        // Record the relationship between offline ID and tokenId
        offlineIdToTokenId[remark] = tokenId;
        tokenIdToOfflineId[tokenId] = remark;

        emit UserMint(tokenId, to, remark, tokenURIString);
        return tokenId;
    }

    /// @notice Query tokenId by offline ID (remark)
    /// @param remark the offline ID to query
    /// @return tokenId the corresponding token ID (returns 0 if not found)
    function getTokenIdByRemark(
        string calldata remark
    ) external view returns (uint256) {
        return offlineIdToTokenId[remark];
    }

    /// @notice owner can update baseCID (e.g. to migrate metadata)
    function setBaseCID(string calldata cid_) external onlyOwner {
        baseCID = cid_;
    }

    /// @notice Initialize mint price configuration (migration function for existing proxy)
    /// @dev This function allows setting mintPrice after contract upgrade
    /// @dev Can only be called once when hakuToken is not initialized
    /// @param _mintPrice mint price in HakuToken (in wei, e.g., 100 * 10^18 for 100 tokens)
    function setMintPrice(uint256 _mintPrice) external onlyOwner {
        require(
            address(hakuToken) == address(0),
            "hakuToken already initialized"
        );
        hakuToken = IERC20(PoolConfig.TOKEN_B);
        mintPrice = _mintPrice;
    }

    /// @notice Update mint price (can be called multiple times)
    /// @dev This function allows owner to update mintPrice after initialization
    /// @dev Can only be called after setMintPrice() has been called
    /// @param _mintPrice new mint price in HakuToken (in wei)
    function updateMintPrice(uint256 _mintPrice) external onlyOwner {
        require(
            address(hakuToken) != address(0),
            "hakuToken not initialized. Call setMintPrice() first"
        );
        mintPrice = _mintPrice;
        emit MintPriceUpdated(_mintPrice);
    }

    /// @notice Owner can withdraw HakuToken from contract
    /// @dev Transfers all HakuToken balance to owner
    function withdrawHakuToken() external onlyOwner {
        uint256 balance = hakuToken.balanceOf(address(this));
        require(balance > 0, "No HakuToken to withdraw");
        require(
            hakuToken.transfer(owner(), balance),
            "HakuToken transfer failed"
        );
        emit HakuTokenWithdrawn(owner(), balance);
    }

    /// @notice Owner can withdraw specific amount of HakuToken from contract
    /// @param amount amount of HakuToken to withdraw (in wei)
    function withdrawHakuToken(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        uint256 balance = hakuToken.balanceOf(address(this));
        require(balance >= amount, "Insufficient HakuToken balance");
        require(
            hakuToken.transfer(owner(), amount),
            "HakuToken transfer failed"
        );
        emit HakuTokenWithdrawn(owner(), amount);
    }

    /// @notice Get current HakuToken balance of this contract
    /// @return balance current balance in wei
    function getHakuTokenBalance() external view returns (uint256) {
        return hakuToken.balanceOf(address(this));
    }

    /// @notice Override _update to clean up custom storage and refund HakuToken when token is burned
    /// @dev When token is burned (to == address(0)), we need to:
    ///      - Clean up custom storage (Token URI, mintUser, offline ID mappings)
    ///      - Automatically refund HakuToken to mintUser (if mintPrice > 0)
    /// @dev When token is transferred (to != address(0) and previousOwner != address(0)), emit NFT721TokenTransferred event
    /// @param to The address to transfer the token to (address(0) for burn)
    /// @param tokenId The token ID
    /// @param auth The address authorized to perform the operation
    /// @return previousOwner The previous owner of the token
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override(ERC721Upgradeable) returns (address) {
        address previousOwner = super._update(to, tokenId, auth);

        // If token is being transferred (not minted or burned), emit transfer event
        if (to != address(0) && previousOwner != address(0)) {
            // This is a transfer between users (not a mint)
            emit NFT721TokenTransferred(
                tokenId,
                previousOwner,
                to,
                block.number
            );
        }

        // If token is being burned (to == address(0)), clean up custom storage and refund
        if (to == address(0)) {
            // ✅ 在删除 mintUser 之前，先保存用户地址用于退款
            address mintUserAddress = mintUser[tokenId];

            // Clean up token URI storage
            // Note: ERC721URIStorageUpgradeable doesn't automatically clean up _tokenURIs
            // We need to access the storage and delete it manually
            // However, since _tokenURIs is private in ERC721URIStorageUpgradeable,
            // we can't directly delete it. The storage will remain but won't be accessible
            // after the token is burned (tokenURI will revert).

            // Clean up mintUser mapping
            delete mintUser[tokenId];

            // Clean up offline ID mappings
            string memory remark = tokenIdToOfflineId[tokenId];
            if (bytes(remark).length > 0) {
                delete offlineIdToTokenId[remark];
                delete tokenIdToOfflineId[tokenId];
            }

            // ✅ 自动退款：如果 mintPrice > 0 且 mintUser 存在，则退款
            // 设计原则：NFT burn 和 ERC20 退款必须一起成功或一起失败（原子操作）
            uint256 refundAmount = 0;
            if (mintPrice > 0 && mintUserAddress != address(0)) {
                // 检查合约余额是否足够
                uint256 contractBalance = hakuToken.balanceOf(address(this));
                require(
                    contractBalance >= mintPrice,
                    "Insufficient contract balance for refund"
                );

                // 执行退款转账（如果失败会 revert，确保原子性）
                require(
                    hakuToken.transfer(mintUserAddress, mintPrice),
                    "HakuToken refund transfer failed"
                );

                refundAmount = mintPrice;
            }

            // ✅ 发出合并的事件（包含退款信息）
            emit TokenBurned(
                tokenId,
                previousOwner,
                mintUserAddress,
                refundAmount
            );
        }

        return previousOwner;
    }

    /// @notice User can burn their own NFT and get HakuToken refund
    /// @dev This function wraps the standard ERC721 burn function with business logic
    /// @dev The refund is handled automatically in _update function
    /// @param tokenId The token ID to burn
    function userBurn(uint256 tokenId) external {
        // ERC721Burnable 的 burn 函数会检查 msg.sender 是否是 owner 或 approved
        // 然后调用 _update(to=address(0), tokenId, auth=msg.sender)
        // _update 会自动处理退款逻辑
        burn(tokenId);
    }
}
