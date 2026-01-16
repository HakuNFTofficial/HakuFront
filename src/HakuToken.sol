// SPDX-License-Identifier: UNLICENSED
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
    ERC20Upgradeable
} from "openzeppelin-contracts-upgradeable/contracts/token/ERC20/ERC20Upgradeable.sol";

contract HakuToken is 
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    uint8 private _decimals;

    /// @notice 自定义转账事件，包含扩展信息
    /// @param from 发送方地址
    /// @param to 接收方地址
    /// @param value 转账金额
    /// @param timestamp 交易时间戳
    /// @param blockNumber 区块号
    /// @param remark 业务备注
    event UserTransfer(
        address indexed from,
        address indexed to,
        uint256 value,
        uint256 timestamp,
        uint256 blockNumber,
        string remark
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize function for proxy
    /// @param name_ token name
    /// @param symbol_ token symbol
    /// @param decimals_ token decimals
    /// @param _admin owner/admin address
    function initialize(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address _admin
    ) public initializer {
        __ERC20_init(name_, symbol_);
        __Ownable_init(_admin);
        
        _decimals = decimals_;
        // mint 初始 100_000_000 个 token（对应 chips 数量：10000 × 10000），按 decimals 计算
        _mint(_admin, 100_000_000 * (10 ** uint256(_decimals)));
    }

    /// @notice required by UUPS to authorize upgrades
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /// @notice Mint tokens (only owner)
    /// @param to address to mint tokens to
    /// @param amount amount of tokens to mint
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice override decimals
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /// @notice 覆盖 _update 方法以发出自定义事件
    /// @dev 必须调用 super._update() 来保持 ERC20 标准功能
    /// @dev 备注功能已移除，业务合约应该直接发出自己的事件（不消耗额外 gas）
    /// @param from 发送方地址（address(0) 表示 mint）
    /// @param to 接收方地址（address(0) 表示 burn）
    /// @param value 转账金额
    function _update(address from, address to, uint256 value) internal virtual override {
        // 1️⃣ 必须调用父类逻辑（执行标准 ERC20 转账逻辑，包括余额更新和 Transfer 事件）
        super._update(from, to, value);

        // 2️⃣ 排除 mint 和 burn 操作，只监听用户之间的转账
        if (from != address(0) && to != address(0)) {
            // 3️⃣ 发出自定义事件（不包含备注，备注由业务合约自己发出）
            // 注意：如果不需要备注功能，可以完全移除 UserTransfer 事件
            // 业务合约可以在自己的函数中发出包含备注的事件
            emit UserTransfer(
                from,
                to,
                value,
                block.timestamp,      // 交易时间戳
                block.number,         // 区块号
                ""                    // 备注为空（由业务合约自己发出）
            );
        }
    }
}
