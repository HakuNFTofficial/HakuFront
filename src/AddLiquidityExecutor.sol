// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPoolManager} from "../lib/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "../lib/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "../lib/v4-core/src/types/Currency.sol";
import {IHooks} from "../lib/v4-core/src/interfaces/IHooks.sol";
import {BalanceDelta} from "../lib/v4-core/src/types/BalanceDelta.sol";
import {IUnlockCallback} from "../lib/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {PoolConfig} from "./PoolConfig.sol";
import {PoolId} from "../lib/v4-core/src/types/PoolId.sol";
import {Position} from "../lib/v4-core/src/libraries/Position.sol";
import {StateLibrary} from "../lib/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "../lib/v4-core/src/libraries/TickMath.sol";
import {LiquidityAmounts} from "../lib/v4-periphery/src/libraries/LiquidityAmounts.sol";

contract AddLiquidityExecutor is IUnlockCallback, Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using CurrencyLibrary for Currency;
    using SafeERC20 for IERC20;

    uint256 private constant ADD_LIQUIDITY_ACTION = 0;
    uint256 private constant REMOVE_LIQUIDITY_ACTION = type(uint256).max;

    error DeadlineExpired(uint256 deadline, uint256 currentTimestamp);
    error ZeroMaximumAmount(uint8 currency);
    error InvalidMinimumAmount(uint8 currency, uint256 minimum, uint256 maximum);
    error IncorrectNativeAmount(uint256 expected, uint256 actual);
    error PoolIdMismatch(bytes32 expected, bytes32 actual);
    error PoolNotInitialized(bytes32 poolId);
    error ZeroLiquidity();
    error UnexpectedPrincipalDelta(uint8 currency, int128 delta);
    error AmountExceedsMaximum(uint8 currency, uint256 actual, uint256 maximum);
    error AmountBelowMinimum(uint8 currency, uint256 actual, uint256 minimum);
    error NativeRefundFailed(address recipient, uint256 amount);
    error InvalidCallbackAction(uint256 action);

    event LiquidityAdded(
        bytes32 indexed poolId,
        address indexed owner,
        uint128 liquidity,
        uint256 amount0Used,
        uint256 amount1Used,
        uint256 amount0Returned,
        uint256 amount1Returned
    );

    struct AddLiquidityCallbackData {
        uint256 amount0Max;
        uint256 amount1Max;
        uint256 amount0Min;
        uint256 amount1Min;
    }

    struct AddLiquidityResult {
        uint128 liquidity;
        uint256 amount0Used;
        uint256 amount1Used;
        uint256 amount0Returned;
        uint256 amount1Returned;
    }

    IPoolManager public poolManager;
    address public tokenA;
    address public tokenB;

    constructor() {
        _disableInitializers();
    }

    function initialize(address _poolManager) public initializer {
        __Ownable_init(msg.sender);
        // 如果传入 address(0)，则使用 PoolConfig 中的默认值
        poolManager = IPoolManager(_poolManager != address(0) ? _poolManager : PoolConfig.POOL_MANAGER);
        // 直接使用 PoolConfig 中定义的代币地址
        tokenA = PoolConfig.TOKEN_A;
        tokenB = PoolConfig.TOKEN_B;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice 迁移函数：确保 tokenA 和 tokenB 与 PoolConfig 一致
    /// @dev 如果代理已经初始化但 tokenA/tokenB 与 PoolConfig 不一致，可以调用此函数更新
    function syncTokensFromConfig() external onlyOwner {
        tokenA = PoolConfig.TOKEN_A;
        tokenB = PoolConfig.TOKEN_B;
    }

    receive() external payable {}

    /// @notice 提取原生币（STT）到 owner
    /// @param amount 提取数量（如果为 0，则提取全部）
    function withdrawNative(uint256 amount) external onlyOwner {
        uint256 balance = address(this).balance;
        uint256 withdrawAmount = amount == 0 ? balance : amount;
        require(withdrawAmount > 0, "No balance to withdraw");
        require(withdrawAmount <= balance, "Insufficient balance");

        (bool success,) = payable(owner()).call{value: withdrawAmount}("");
        require(success, "Withdraw failed");
    }

    /// @notice 提取 ERC20 代币到 owner
    /// @param token 代币地址
    /// @param amount 提取数量（如果为 0，则提取全部）
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token address");

        IERC20 tokenContract = IERC20(token);
        uint256 balance = tokenContract.balanceOf(address(this));
        uint256 withdrawAmount = amount == 0 ? balance : amount;
        require(withdrawAmount > 0, "No balance to withdraw");
        require(withdrawAmount <= balance, "Insufficient balance");

        require(tokenContract.transfer(owner(), withdrawAmount), "Transfer failed");
    }

    /// @notice 提取所有余额（原生币 + 指定代币）
    /// @param tokens 要提取的代币地址列表（空数组表示只提取原生币）
    function withdrawAll(address[] calldata tokens) external onlyOwner {
        // 提取原生币
        uint256 nativeBalance = address(this).balance;
        if (nativeBalance > 0) {
            (bool success,) = payable(owner()).call{value: nativeBalance}("");
            require(success, "Native withdraw failed");
        }

        // 提取 ERC20 代币
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (token != address(0)) {
                IERC20 tokenContract = IERC20(token);
                uint256 balance = tokenContract.balanceOf(address(this));
                if (balance > 0) {
                    require(tokenContract.transfer(owner(), balance), "Token transfer failed");
                }
            }
        }
    }

    /// @notice 从指定池子移除流动性
    /// @dev 用于从旧池子取回流动性。移除后，代币会返回到本合约，然后可以使用 withdraw 函数提取
    /// @param currency0 池子的 currency0 地址（STT 使用 address(0)）
    /// @param currency1 池子的 currency1 地址（HakuToken 地址）
    /// @param fee 池子的手续费率（从 PoolConfig.FEE 读取，例如 3002 表示 0.3002%）
    /// @param tickSpacing tick spacing（如 60）
    /// @param hooks hooks 地址（无 hooks 使用 address(0)）
    /// @param tickLower position 的下边界 tick（如 -887220）
    /// @param tickUpper position 的上边界 tick（如 887220）
    /// @param liquidityAmount 要移除的流动性数量（正数，函数内部会转为负数）
    /// @param salt position 的 salt（通常是 0）
    function removeLiquidity(
        address currency0,
        address currency1,
        uint24 fee,
        int24 tickSpacing,
        address hooks,
        int24 tickLower,
        int24 tickUpper,
        uint256 liquidityAmount,
        bytes32 salt
    ) external onlyOwner {
        require(liquidityAmount <= uint256(type(int256).max), "Liquidity amount too large");
        // -------- 1. 组装参数并编码 --------
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(currency0),
            currency1: Currency.wrap(currency1),
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(hooks)
        });

        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            // forge-lint: disable-next-line(unsafe-typecast)
            liquidityDelta: -int256(liquidityAmount), // 负数表示移除
            salt: salt
        });

        // -------- 2. 编码参数传递给 callback（使用特殊标识符 0xFFFFFFFFFFFFFFFF） --------
        // 使用一个特殊的 uint256 作为标识符来区分 remove 和 add
        bytes memory callbackData = abi.encode(REMOVE_LIQUIDITY_ACTION, key, params);

        // -------- 3. unlock 并触发 callback --------
        poolManager.unlock(callbackData);
    }

    /// @notice 查询指定 position 的流动性数量
    /// @dev 使用 extsload 查询池子状态，不消耗 gas
    /// @param poolIdBytes32 PoolId 的 bytes32 格式
    /// @param owner position 的所有者地址（通常是 AddLiquidityExecutor 合约地址）
    /// @param tickLower position 的下边界 tick
    /// @param tickUpper position 的上边界 tick
    /// @param salt position 的 salt
    /// @return liquidity position 的流动性数量
    function getPositionLiquidity(bytes32 poolIdBytes32, address owner, int24 tickLower, int24 tickUpper, bytes32 salt)
        external
        view
        returns (uint128 liquidity)
    {
        PoolId poolId = PoolId.wrap(poolIdBytes32);

        // 计算 positionId
        bytes32 positionId = Position.calculatePositionKey(owner, tickLower, tickUpper, salt);

        // 计算 position 的 storage slot
        // Pool.State.positions[positionId] = pools[poolId].positions[positionId]
        // pools mapping slot = 6
        bytes32 poolsSlot = bytes32(uint256(6));
        bytes32 poolStateSlot = keccak256(abi.encode(poolId, poolsSlot));

        // positions mapping offset = 6 (POSITIONS_OFFSET)
        bytes32 positionsMappingSlot = bytes32(uint256(poolStateSlot) + 6);
        bytes32 positionSlot = keccak256(abi.encode(positionId, positionsMappingSlot));

        // Position.State.liquidity 是第一个字段（offset 0）
        bytes32 liquiditySlot = positionSlot;

        // 使用 extsload 查询
        liquidity = uint128(uint256(poolManager.extsload(liquiditySlot)));
    }

    /// @notice Add the maximum liquidity supported by explicit token budgets.
    /// @param amount0Max Maximum native USDC to use.
    /// @param amount1Max Maximum Haku to use.
    /// @param amount0Min Minimum native USDC principal that must be used.
    /// @param amount1Min Minimum Haku principal that must be used.
    /// @param deadline Latest timestamp at which the transaction may execute.
    function addLiquidity(
        uint256 amount0Max,
        uint256 amount1Max,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 deadline
    ) external payable onlyOwner {
        if (block.timestamp > deadline) {
            revert DeadlineExpired(deadline, block.timestamp);
        }
        if (amount0Max == 0) revert ZeroMaximumAmount(0);
        if (amount1Max == 0) revert ZeroMaximumAmount(1);
        if (amount0Min > amount0Max) {
            revert InvalidMinimumAmount(0, amount0Min, amount0Max);
        }
        if (amount1Min > amount1Max) {
            revert InvalidMinimumAmount(1, amount1Min, amount1Max);
        }
        if (msg.value != amount0Max) {
            revert IncorrectNativeAmount(amount0Max, msg.value);
        }

        PoolId poolId = _poolKey().toId();
        _validatePoolId(poolId);

        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amount1Max);

        AddLiquidityCallbackData memory callbackData = AddLiquidityCallbackData({
            amount0Max: amount0Max, amount1Max: amount1Max, amount0Min: amount0Min, amount1Min: amount1Min
        });
        bytes memory resultData = poolManager.unlock(abi.encode(ADD_LIQUIDITY_ACTION, callbackData));
        AddLiquidityResult memory result = abi.decode(resultData, (AddLiquidityResult));

        if (result.amount0Returned > 0) {
            (bool success,) = payable(msg.sender).call{value: result.amount0Returned}("");
            if (!success) {
                revert NativeRefundFailed(msg.sender, result.amount0Returned);
            }
        }
        if (result.amount1Returned > 0) {
            IERC20(tokenB).safeTransfer(msg.sender, result.amount1Returned);
        }

        emit LiquidityAdded(
            PoolId.unwrap(poolId),
            msg.sender,
            result.liquidity,
            result.amount0Used,
            result.amount1Used,
            result.amount0Returned,
            result.amount1Returned
        );
    }

    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        require(msg.sender == address(poolManager), "Only poolManager");

        uint256 action;
        assembly ("memory-safe") {
            action := calldataload(data.offset)
        }

        if (action == REMOVE_LIQUIDITY_ACTION) {
            return _removeLiquidityCallback(data);
        }
        if (action == ADD_LIQUIDITY_ACTION) {
            return _addLiquidityCallback(data);
        }
        revert InvalidCallbackAction(action);
    }

    function _removeLiquidityCallback(bytes calldata data) private returns (bytes memory) {
        (, PoolKey memory key, IPoolManager.ModifyLiquidityParams memory params) =
            abi.decode(data, (uint256, PoolKey, IPoolManager.ModifyLiquidityParams));

        (BalanceDelta delta,) = poolManager.modifyLiquidity(key, params, "");
        if (delta.amount0() > 0) {
            poolManager.take(key.currency0, address(this), uint256(int256(delta.amount0())));
        }
        if (delta.amount1() > 0) {
            poolManager.take(key.currency1, address(this), uint256(int256(delta.amount1())));
        }
        return "";
    }

    function _addLiquidityCallback(bytes calldata data) private returns (bytes memory) {
        (, AddLiquidityCallbackData memory request) = abi.decode(data, (uint256, AddLiquidityCallbackData));
        PoolKey memory key = _poolKey();
        PoolId poolId = key.toId();
        _validatePoolId(poolId);

        (uint160 sqrtPriceX96,,,) = StateLibrary.getSlot0(poolManager, poolId);
        if (sqrtPriceX96 == 0) {
            revert PoolNotInitialized(PoolId.unwrap(poolId));
        }

        uint160 sqrtPriceLowerX96 = TickMath.getSqrtPriceAtTick(PoolConfig.TICK_LOWER);
        uint160 sqrtPriceUpperX96 = TickMath.getSqrtPriceAtTick(PoolConfig.TICK_UPPER);
        AddLiquidityResult memory result;
        result.liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96, sqrtPriceLowerX96, sqrtPriceUpperX96, request.amount0Max, request.amount1Max
        );
        if (result.liquidity == 0) revert ZeroLiquidity();

        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: PoolConfig.TICK_LOWER,
            tickUpper: PoolConfig.TICK_UPPER,
            liquidityDelta: int256(uint256(result.liquidity)),
            salt: PoolConfig.SALT
        });
        (BalanceDelta callerDelta, BalanceDelta feesAccrued) = poolManager.modifyLiquidity(key, params, "");
        BalanceDelta principalDelta = callerDelta - feesAccrued;

        result.amount0Used = _principalAmount(principalDelta.amount0(), 0);
        result.amount1Used = _principalAmount(principalDelta.amount1(), 1);
        _validateUsage(0, result.amount0Used, request.amount0Min, request.amount0Max);
        _validateUsage(1, result.amount1Used, request.amount1Min, request.amount1Max);

        result.amount0Returned = _settleOrTake(key.currency0, callerDelta.amount0(), request.amount0Max, 0);
        result.amount1Returned = _settleOrTake(key.currency1, callerDelta.amount1(), request.amount1Max, 1);
        return abi.encode(result);
    }

    function _poolKey() private view returns (PoolKey memory key) {
        key = PoolKey({
            currency0: Currency.wrap(tokenA),
            currency1: Currency.wrap(tokenB),
            fee: PoolConfig.FEE,
            tickSpacing: PoolConfig.TICK_SPACING,
            hooks: IHooks(PoolConfig.HOOKS)
        });
    }

    function _validatePoolId(PoolId actualPoolId) private pure {
        bytes32 actual = PoolId.unwrap(actualPoolId);
        if (actual != PoolConfig.POOL_ID) {
            revert PoolIdMismatch(PoolConfig.POOL_ID, actual);
        }
    }

    function _principalAmount(int128 delta, uint8 currency) private pure returns (uint256) {
        if (delta > 0) revert UnexpectedPrincipalDelta(currency, delta);
        return delta == 0 ? 0 : uint256(-int256(delta));
    }

    function _validateUsage(uint8 currency, uint256 actual, uint256 minimum, uint256 maximum) private pure {
        if (actual > maximum) {
            revert AmountExceedsMaximum(currency, actual, maximum);
        }
        if (actual < minimum) {
            revert AmountBelowMinimum(currency, actual, minimum);
        }
    }

    function _settleOrTake(Currency currency, int128 delta, uint256 maximum, uint8 currencyId)
        private
        returns (uint256 amountReturned)
    {
        if (delta < 0) {
            uint256 amountPaid = uint256(-int256(delta));
            if (amountPaid > maximum) {
                revert AmountExceedsMaximum(currencyId, amountPaid, maximum);
            }
            poolManager.sync(currency);
            if (currency.isAddressZero()) {
                poolManager.settle{value: amountPaid}();
            } else {
                currency.transfer(address(poolManager), amountPaid);
                poolManager.settle();
            }
            return maximum - amountPaid;
        }
        if (delta > 0) {
            uint256 amountReceived = uint256(int256(delta));
            poolManager.take(currency, address(this), amountReceived);
            return maximum + amountReceived;
        }
        return maximum;
    }
}
