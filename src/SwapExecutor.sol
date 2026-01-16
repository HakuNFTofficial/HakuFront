// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IPoolManager} from "../lib/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "../lib/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "../lib/v4-core/src/types/Currency.sol";
import {IHooks} from "../lib/v4-core/src/interfaces/IHooks.sol";
import {BalanceDelta} from "../lib/v4-core/src/types/BalanceDelta.sol";
import {
    IUnlockCallback
} from "../lib/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {
    Initializable
} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {
    UUPSUpgradeable
} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {
    OwnableUpgradeable
} from "openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {PoolConfig} from "./PoolConfig.sol";
import {TickMath} from "../lib/v4-core/src/libraries/TickMath.sol";

contract SwapExecutor is
    IUnlockCallback,
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    using CurrencyLibrary for Currency;

    IPoolManager public poolManager;
    address public tokenA;
    address public tokenB;

    event SwapExecuted(
        address indexed user,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );

    constructor() {
        _disableInitializers();
    }
    function initialize(
        address _poolManager,
        address _admin
    ) public initializer {
        __Ownable_init(_admin); // 设置 owner 为 _admin
        // 如果传入 address(0)，则使用 PoolConfig 中的默认值
        poolManager = IPoolManager(
            _poolManager != address(0) ? _poolManager : PoolConfig.POOL_MANAGER
        );
        // 初始化时自动设置默认代币地址
        tokenA = PoolConfig.TOKEN_A;
        tokenB = PoolConfig.TOKEN_B;
    }

    function setTokenA(address _tokenA) external onlyOwner {
        // 如果传入 address(0)，则使用 PoolConfig 中的默认值
        tokenA = _tokenA != address(0) ? _tokenA : PoolConfig.TOKEN_A;
    }

    function setTokenB(address _tokenB) external onlyOwner {
        // 如果传入 address(0)，则使用 PoolConfig 中的默认值
        tokenB = _tokenB != address(0) ? _tokenB : PoolConfig.TOKEN_B;
    }
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    receive() external payable {}

    /// @notice Swap tokenA for tokenB with slippage protection (ExactInput)
    /// @param amountIn Amount of tokenA to swap
    /// @param minAmountOut Minimum amount of tokenB to receive (slippage protection)
    function swapAForB(
        uint256 amountIn,
        uint256 minAmountOut
    ) external payable {
        // Pull tokens from user
        if (tokenA == address(0)) {
            require(msg.value == amountIn, "Incorrect ETH amount");
        } else {
            require(
                IERC20(tokenA).transferFrom(
                    msg.sender,
                    address(this),
                    amountIn
                ),
                "transferFromAForB failed"
            );
        }

        bool zeroForOne = tokenA < tokenB;

        poolManager.unlock(
            abi.encode(zeroForOne, amountIn, minAmountOut, msg.sender)
        );
    }

    /// @notice Swap tokenB for tokenA with slippage protection (ExactInput)
    /// @param amountIn Amount of tokenB to swap
    /// @param minAmountOut Minimum amount of tokenA to receive (slippage protection)
    function swapBForA(uint256 amountIn, uint256 minAmountOut) external {
        require(
            IERC20(tokenB).transferFrom(msg.sender, address(this), amountIn),
            "transferFromBForA failed"
        );

        bool zeroForOne = tokenB < tokenA;

        poolManager.unlock(
            abi.encode(zeroForOne, amountIn, minAmountOut, msg.sender)
        );
    }

    function unlockCallback(
        bytes calldata data
    ) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "Only poolManager");

        // 解码参数：(bool zeroForOne, uint256 amountIn, uint256 minAmountOut, address user)
        (
            bool zeroForOne,
            uint256 amountIn,
            uint256 minAmountOut,
            address user
        ) = abi.decode(data, (bool, uint256, uint256, address));

        require(amountIn > 0, "INVALID_AMOUNT_IN");
        require(minAmountOut > 0, "INVALID_MIN_AMOUNT_OUT");
        // Ensure amountIn fits in int256
        require(amountIn <= uint256(type(int256).max), "AmountIn too large");

        // Construct PoolKey
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(tokenA < tokenB ? tokenA : tokenB),
            currency1: Currency.wrap(tokenA < tokenB ? tokenB : tokenA),
            fee: PoolConfig.FEE,
            tickSpacing: PoolConfig.TICK_SPACING,
            hooks: IHooks(PoolConfig.HOOKS)
        });

        // Construct swap params
        // Use Uniswap V4's global MIN/MAX sqrt price limits
        // This allows price to move within the full range (±887272 ticks)
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: zeroForOne,
            // negative = exact input
            // forge-lint: disable-next-line(unsafe-typecast)
            amountSpecified: -int256(amountIn),
            sqrtPriceLimitX96: zeroForOne
                ? TickMath.MIN_SQRT_PRICE + 1
                : TickMath.MAX_SQRT_PRICE - 1
        });

        // Execute swap
        BalanceDelta delta = poolManager.swap(key, params, "");

        // Settle input token
        if (zeroForOne) {
            // Swapping currency0 -> currency1
            if (delta.amount0() < 0) {
                uint256 amount0 = uint256(int256(-delta.amount0()));
                poolManager.sync(key.currency0);
                if (key.currency0.isAddressZero()) {
                    poolManager.settle{value: amount0}();
                } else {
                    key.currency0.transfer(address(poolManager), amount0);
                    poolManager.settle();
                }
            }
            // Take output currency1
            if (delta.amount1() > 0) {
                poolManager.take(
                    key.currency1,
                    user,
                    uint256(int256(delta.amount1()))
                );
            }
        } else {
            // Swapping currency1 -> currency0
            if (delta.amount1() < 0) {
                uint256 amount1 = uint256(int256(-delta.amount1()));
                poolManager.sync(key.currency1);
                if (key.currency1.isAddressZero()) {
                    poolManager.settle{value: amount1}();
                } else {
                    key.currency1.transfer(address(poolManager), amount1);
                    poolManager.settle();
                }
            }
            // Take output currency0
            if (delta.amount0() > 0) {
                poolManager.take(
                    key.currency0,
                    user,
                    uint256(int256(delta.amount0()))
                );
            }
        }
        uint256 amountOut = zeroForOne
            ? uint256(int256(delta.amount1()))
            : uint256(int256(delta.amount0()));

        // Slippage protection: require minimum amount out
        require(amountOut >= minAmountOut, "SLIPPAGE_TOO_HIGH");

        emit SwapExecuted(
            user,
            zeroForOne,
            amountIn,
            amountOut,
            block.timestamp
        );
        return "";
    }
}
