// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {
    Initializable
} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {
    UUPSUpgradeable
} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {
    OwnableUpgradeable
} from "openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";

/// @title SimpleAirdrop
/// @notice A simple airdrop contract for single-address airdrops (UUPS Upgradeable)
contract SimpleAirdrop is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    IERC20 public token;
    address public admin;
    bool public airdropPaused;

    // Limits
    uint256 public maxAirdropAmount;
    uint256 public maxTotalPerAddress;

    // Statistics
    mapping(address => uint256) public totalAirdropped;
    uint256 public totalAirdropCount;
    uint256 public totalAirdropVolume;

    // Events
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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _token, address _admin) public initializer {
        require(_token != address(0), "Invalid token address");
        require(_admin != address(0), "Invalid admin address");
        __Ownable_init(_admin); // 或 msg.sender

        token = IERC20(_token);
        admin = _admin;

        // Default limits
        maxAirdropAmount = 10000 * 1e18;
        maxTotalPerAddress = 50000 * 1e18;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /// @notice Airdrop tokens to a single address
    /// @param recipient Address to receive the airdrop
    /// @param amount Amount of tokens to airdrop
    function airdrop(address recipient, uint256 amount) external onlyOwner {
        require(!airdropPaused, "Airdrop is paused");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= maxAirdropAmount, "Exceeds max airdrop amount");
        require(
            totalAirdropped[recipient] + amount <= maxTotalPerAddress,
            "Exceeds max total per address"
        );

        // Transfer tokens
        // Transfer tokens with check
        require(token.transfer(recipient, amount), "Transfer failed");

        // Update statistics
        totalAirdropped[recipient] += amount;
        totalAirdropCount++;
        totalAirdropVolume += amount;

        emit Airdropped(recipient, amount, block.timestamp);
    }

    /// @notice Set maximum airdrop amount per transaction
    /// @param _maxAmount New maximum amount
    function setMaxAirdropAmount(uint256 _maxAmount) external onlyOwner {
        require(_maxAmount > 0, "Max amount must be > 0");
        maxAirdropAmount = _maxAmount;
        emit MaxAirdropAmountUpdated(_maxAmount);
    }

    /// @notice Set maximum total airdrop per address
    /// @param _maxTotal New maximum total
    function setMaxTotalPerAddress(uint256 _maxTotal) external onlyOwner {
        require(_maxTotal > 0, "Max total must be > 0");
        maxTotalPerAddress = _maxTotal;
        emit MaxTotalPerAddressUpdated(_maxTotal);
    }

    /// @notice Pause airdrops
    function pauseAirdrop() external onlyOwner {
        require(!airdropPaused, "Already paused");
        airdropPaused = true;
        emit AirdropPaused();
    }

    /// @notice Resume airdrops
    function resumeAirdrop() external onlyOwner {
        require(airdropPaused, "Not paused");
        airdropPaused = false;
        emit AirdropResumed();
    }

    /// @notice Change admin address
    /// @param newAdmin New admin address
    function changeAdmin(address newAdmin) external onlyOwner {
        require(newAdmin != address(0), "Invalid admin address");
        address oldAdmin = admin;
        admin = newAdmin;
        transferOwnership(newAdmin);
        emit AdminChanged(oldAdmin, newAdmin);
    }

    /// @notice Withdraw remaining tokens (emergency function)
    /// @param amount Amount to withdraw
    function withdrawTokens(uint256 amount) external onlyOwner {
        require(token.transfer(admin, amount), "Transfer failed");
    }

    /// @notice Get contract token balance
    /// @return Balance of tokens in the contract
    function getBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
