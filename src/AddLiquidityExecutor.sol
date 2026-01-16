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
import {PoolId} from "../lib/v4-core/src/types/PoolId.sol";
import {Position} from "../lib/v4-core/src/libraries/Position.sol";

contract AddLiquidityExecutor is
    IUnlockCallback,
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    using CurrencyLibrary for Currency;

    IPoolManager public poolManager;
    address public tokenA;
    address public tokenB;
    constructor() {
        _disableInitializers();
    }
    function initialize(address _poolManager) public initializer {
        __Ownable_init(msg.sender);
        // 如果传入 address(0)，则使用 PoolConfig 中的默认值
        poolManager = IPoolManager(
            _poolManager != address(0) ? _poolManager : PoolConfig.POOL_MANAGER
        );
        // 直接使用 PoolConfig 中定义的代币地址
        tokenA = PoolConfig.TOKEN_A;
        tokenB = PoolConfig.TOKEN_B;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

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

        (bool success, ) = payable(owner()).call{value: withdrawAmount}("");
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

        require(
            tokenContract.transfer(owner(), withdrawAmount),
            "Transfer failed"
        );
    }

    /// @notice 提取所有余额（原生币 + 指定代币）
    /// @param tokens 要提取的代币地址列表（空数组表示只提取原生币）
    function withdrawAll(address[] calldata tokens) external onlyOwner {
        // 提取原生币
        uint256 nativeBalance = address(this).balance;
        if (nativeBalance > 0) {
            (bool success, ) = payable(owner()).call{value: nativeBalance}("");
            require(success, "Native withdraw failed");
        }

        // 提取 ERC20 代币
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (token != address(0)) {
                IERC20 tokenContract = IERC20(token);
                uint256 balance = tokenContract.balanceOf(address(this));
                if (balance > 0) {
                    require(
                        tokenContract.transfer(owner(), balance),
                        "Token transfer failed"
                    );
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
        require(
            liquidityAmount <= uint256(type(int256).max),
            "Liquidity amount too large"
        );
        // -------- 1. 组装参数并编码 --------
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(currency0),
            currency1: Currency.wrap(currency1),
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(hooks)
        });

        IPoolManager.ModifyLiquidityParams memory params = IPoolManager
            .ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                // forge-lint: disable-next-line(unsafe-typecast)
                liquidityDelta: -int256(liquidityAmount), // 负数表示移除
                salt: salt
            });

        // -------- 2. 编码参数传递给 callback（使用特殊标识符 0xFFFFFFFFFFFFFFFF） --------
        // 使用一个特殊的 uint256 作为标识符来区分 remove 和 add
        bytes memory callbackData = abi.encode(
            uint256(
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
            ),
            key,
            params
        );

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
    function getPositionLiquidity(
        bytes32 poolIdBytes32,
        address owner,
        int24 tickLower,
        int24 tickUpper,
        bytes32 salt
    ) external view returns (uint128 liquidity) {
        PoolId poolId = PoolId.wrap(poolIdBytes32);

        // 计算 positionId
        bytes32 positionId = Position.calculatePositionKey(
            owner,
            tickLower,
            tickUpper,
            salt
        );

        // 计算 position 的 storage slot
        // Pool.State.positions[positionId] = pools[poolId].positions[positionId]
        // pools mapping slot = 6
        bytes32 poolsSlot = bytes32(uint256(6));
        bytes32 poolStateSlot = keccak256(abi.encode(poolId, poolsSlot));

        // positions mapping offset = 6 (POSITIONS_OFFSET)
        bytes32 positionsMappingSlot = bytes32(uint256(poolStateSlot) + 6);
        bytes32 positionSlot = keccak256(
            abi.encode(positionId, positionsMappingSlot)
        );

        // Position.State.liquidity 是第一个字段（offset 0）
        bytes32 liquiditySlot = positionSlot;

        // 使用 extsload 查询
        liquidity = uint128(uint256(poolManager.extsload(liquiditySlot)));  
    }

    /// @notice 添加流动性（可多次调用）
    /// @param amountA Amount of tokenA (STT) to add
    /// @dev amountB will be calculated based on PoolConfig.LIQUIDITY_RATIO
    ///      User should provide amountB = amountA * LIQUIDITY_RATIO
    function addLiquidity(uint256 amountA) external payable {
        // -------- 1. Pull tokens from user --------
        // 根据配置的比例计算需要的 tokenB 数量
        // 比例从 PoolConfig.LIQUIDITY_RATIO 读取
        uint256 amountB = amountA * PoolConfig.LIQUIDITY_RATIO;

        // Pull tokens from user to this contract
        // User must have approved this contract
        // tokenA is always address(0) (STT native currency) from PoolConfig
        require(msg.value == amountA, "Incorrect STT amount");
        require(
            IERC20(tokenB).transferFrom(msg.sender, address(this), amountB),
            "TransferFrom failed"
        );

        // -------- 2. unlock --------
        // Pass amounts to callback
        poolManager.unlock(abi.encode(msg.sender, amountA, amountB));
    }

    function unlockCallback(
        bytes calldata data
    ) external override returns (bytes memory) {
        require(msg.sender == address(poolManager), "Only poolManager");

        // -------- 检查操作类型 --------
        // 检查第一个 uint256 是否是标识符 0xFFFFFFFFFFFFFFFF...
        // 如果是，说明是移除流动性；否则是添加流动性
        uint256 firstWord;
        assembly {
            firstWord := calldataload(data.offset)
        }

        if (
            firstWord ==
            uint256(
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
            )
        ) {
           
            (
                ,
                PoolKey memory key,
                IPoolManager.ModifyLiquidityParams memory params
            ) = abi.decode(
                    data,
                    (uint256, PoolKey, IPoolManager.ModifyLiquidityParams)
                );

           
            (BalanceDelta delta, ) = poolManager.modifyLiquidity(
                key,
                params,
                ""
            );

            //  BalanceDelta（
            if (delta.amount0() > 0) {
                poolManager.take(
                    key.currency0,
                    address(this),
                    uint256(int256(delta.amount0()))
                );
            }
            if (delta.amount1() > 0) {
                poolManager.take(
                    key.currency1,
                    address(this),
                    uint256(int256(delta.amount1()))
                );
            }

            return "";
        } else {
            // 
            // Decode amounts
            (, uint256 _amountA, uint256 _amountB) = abi.decode(
                data,
                (address, uint256, uint256)
            );

            // 
            PoolKey memory key = PoolKey({
                currency0: Currency.wrap(tokenA),
                currency1: Currency.wrap(tokenB),
                fee: PoolConfig.FEE,
                tickSpacing: PoolConfig.TICK_SPACING,
                hooks: IHooks(PoolConfig.HOOKS)
            });

            
            PoolId expectedPoolId = PoolId.wrap(PoolConfig.POOL_ID);
            PoolId actualPoolId = key.toId();
            require(
                PoolId.unwrap(actualPoolId) == PoolId.unwrap(expectedPoolId),
                "PoolId mismatch: PoolKey does not match configured POOL_ID"
            );

            // -------- 4. 组装参数 --------
            // 使用接近全范围的流动性（-887220 到 887220）
            // 这样可以覆盖 MIN_TICK 到 MAX_TICK，避免价格超出范围
            // tick 必须与 tickSpacing (60) 对齐
            // MIN_TICK = -887272, MAX_TICK = 887272
            // -887272 / 60 = -14787.87 → -14787 * 60 = -887220
            // 887272 / 60 = 14787.87 → 14787 * 60 = 887220
            //
            // 注意：modifyLiquidity 会根据当前价格和流动性范围自动计算需要的代币数量
            // 如果当前价格是 1:100，系统会按照这个比例使用代币
            // 多余的代币会被退回（通过 BalanceDelta）
            //
            // 使用 amountA 作为流动性基准（简化实现）
            // 实际系统会根据价格计算需要的代币数量
            require(_amountA <= uint256(type(int256).max), "AmountA too large");
            IPoolManager.ModifyLiquidityParams memory params = IPoolManager
                .ModifyLiquidityParams({
                    tickLower: -887220, // 接近 MIN_TICK，对齐到 tickSpacing
                    tickUpper: 887220, // 接近 MAX_TICK，对齐到 tickSpacing
                    // forge-lint: disable-next-line(unsafe-typecast)
                    liquidityDelta: int256(_amountA), // 使用 amountA 作为流动性基准
                    salt: 0
                });

            // -------- 5. modifyLiquidity --------
            (BalanceDelta delta, ) = poolManager.modifyLiquidity(
                key,
                params,
                ""
            );

            // -------- 6. Settle / Take --------
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

            if (delta.amount0() > 0) {
                poolManager.take(
                    key.currency0,
                    address(this),
                    uint256(int256(delta.amount0()))
                );
            }
            if (delta.amount1() > 0) {
                poolManager.take(
                    key.currency1,
                    address(this),
                    uint256(int256(delta.amount1()))
                );
            }

            return "";
        }
    }
}
