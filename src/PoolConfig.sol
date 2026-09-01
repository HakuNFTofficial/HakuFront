// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";

/**
 * @title PoolConfig
 * @notice Arc Testnet pool configuration parameters and contract addresses.
 * @dev ARC_DEPLOY_UPDATE: replace zero placeholders after each Arc deployment step.
 */
library PoolConfig {
    // ============ 合约地址 ============
    address public constant POOL_MANAGER = 0x447032aAa569105437516dA21792862Bf05422C6;
    address public constant TOKEN_A = 0x0000000000000000000000000000000000000000; // Arc native USDC
    address public constant TOKEN_B = 0x19c02CC2118Afe3CB59bb2f777d1a1124c7A6C12; // HakuToken Proxy
    address public constant SWAP_EXECUTOR = 0x100e99CB47c737Db4f3399a0b6195276cF9f77a9; // SwapExecutor Proxy
    address public constant QUOTER = 0xda497413594473EC8dDDeC7711595D75239A47E1; // V4Quoter address

    // ============ Pool 参数 ============
    // 使用动态费率旗标，以便在 Hook 中通过 LPFEE_FOR_NO_CORE_FEE 覆盖核心合约费率
    uint24 public constant FEE = LPFeeLibrary.DYNAMIC_FEE_FLAG; // 0x800000 (Dynamic Fee)
    uint24 public constant HOOK_FEE = 3000; // Hook 实际收取的费率 (0.3%)
    int24 public constant TICK_SPACING = 60; // tick spacing
    address public constant HOOKS = 0xb7812d8F30e1e0a0434AC917b868AAeccaBF4088;

    // ============ 初始价格 ============
    // sqrtPriceX96 格式
    // 1:1 价格 = 2^96 = 79228162514264337593543950336
    // 1:100 价格 = 10 * 2^96 = 792281625142643375935439503360 (1 native USDC = 100 HakuToken)
    uint160 public constant SQRT_PRICE_X96 = 3543191142285914205922034323214; // 1 native USDC = 2000 HakuToken

    // ============ 显示用价格比例 ============
    // addLiquidity 不使用这个常量计算 L；它按链上实时价格和两边最大预算计算。
    // LIQUIDITY_RATIO = 1 表示 1:1 (1 native USDC = 1 HakuToken)
    // LIQUIDITY_RATIO = 100 表示 1:100 (1 native USDC = 100 HakuToken)
    uint256 public constant LIQUIDITY_RATIO = 2000;

    // ============ Position 参数 ============
    // Position 的价格区间（tick 范围）
    // 必须与 TICK_SPACING 对齐：tick % TICK_SPACING == 0
    // 当前使用最大范围以覆盖所有可能的价格
    int24 public constant TICK_LOWER = -887220; // floor(-887272 / 60) * 60，与 tickSpacing=60 对齐
    int24 public constant TICK_UPPER = 887220; // floor(887272 / 60) * 60，与 tickSpacing=60 对齐
    bytes32 public constant SALT = 0x0000000000000000000000000000000000000000000000000000000000000000;

    // ============ PoolId ============
    // PoolId (从初始化交易日志中获取，用于快速查询池子状态)
    // PoolId = keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks))
    // currency0 = TOKEN_A (0x0000000000000000000000000000000000000000, Arc native USDC)
    // currency1 = TOKEN_B (HakuToken)
    // fee = FEE, tickSpacing = TICK_SPACING, hooks = HOOKS
    // 注意：重新初始化池子后，需要从初始化池子后, 交易日志中的获取新的logs[0].topics[1] POOL_ID 并更新此处
    bytes32 public constant POOL_ID = 0x12512a4efd2e73344522fd8f20520575d943f6127fde7a0b6c8d70f41cfe8f5c;
}
