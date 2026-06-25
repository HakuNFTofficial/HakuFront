#!/bin/bash
# 文件名：check_v4_pool_cast.sh
# 用途：在 Somnia 链上用 cast 验证 Uniswap v4 池子状态，并输出安全 swap 最大数量

set -e

# ===== 配置 =====
RPC_URL="https://dream-rpc.somnia.network"
POOL_MANAGER="0xaD05f7c50825374aE2dE3F29d36346FB98512182"
TOKEN_A="0x0000000000000000000000000000000000000000"   # STT
TOKEN_B="0x41166CCe5C4C6673e7eF4c59169896d7e29c89f3"  # HakuToken
FEE=3000
TICK_SPACING=60
EXECUTOR="0xB93Fcd0919b8cB83abEb417060D9120Db8Bc90B0"
POSITION_SALT="0x0000000000000000000000000000000000000000000000000000000000000000"

# ===== 1️⃣ 设置 Hooks 地址 =====
# macOS 兼容，直接在脚本里手动指定
HOOKS="0xd031510f65b732edaa9652a378de649c097340c8"
echo "使用 Hooks: $HOOKS"

# ===== 2️⃣ 确定 Currency0/1 并计算 PoolId =====
# Uniswap V4 要求 currency0 < currency1
if [ "$(printf "%s\n%s" "$TOKEN_A" "$TOKEN_B" | sort | head -n1)" == "$TOKEN_A" ]; then
    CURRENCY0=$TOKEN_A
    CURRENCY1=$TOKEN_B
else
    CURRENCY0=$TOKEN_B
    CURRENCY1=$TOKEN_A
fi

POOL_ID=$(cast keccak $(cast abi-encode "f(address,address,uint24,int24,address)" $CURRENCY0 $CURRENCY1 $FEE $TICK_SPACING $HOOKS))
echo "计算 PoolId: $POOL_ID"

# ===== 3️⃣ 查询 LP position 流动性 =====
POSITION_LIQ=$(cast call $EXECUTOR \
  "getPositionLiquidity(bytes32,address,int24,int24,bytes32)(uint128)" \
  $POOL_ID $EXECUTOR -887220 887220 $POSITION_SALT \
  --rpc-url $RPC_URL 2>/dev/null || echo "0")
echo "LP position 流动性: $POSITION_LIQ"
if [ "$POSITION_LIQ" = "0" ]; then
    echo "⚠️  该 PoolKey 还未初始化或流动性为 0，必须先 addLiquidity 创建池子"
    exit 1
fi

# ===== 4️⃣ 查询池子余额 =====
POOL_BALANCES=$(cast call $POOL_MANAGER \
  "getPoolBalances(address,address,uint24,int24,address)(uint256,uint256)" \
  $CURRENCY0 $CURRENCY1 $FEE $TICK_SPACING $HOOKS \
  --rpc-url $RPC_URL 2>/dev/null || echo "0,0")

BAL_A=$(echo $POOL_BALANCES | cut -d',' -f1 | tr -d '() ')
BAL_B=$(echo $POOL_BALANCES | cut -d',' -f2 | tr -d '() ')

echo "池子余额: TokenA=$BAL_A, TokenB=$BAL_B"

# ===== 5️⃣ 计算最大可 swap 数量 =====
MAX_ZERO_FOR_ONE=$BAL_B   # 卖 TokenA 买 TokenB
MAX_ONE_FOR_ZERO=$BAL_A   # 卖 TokenB 买 TokenA

echo "最大可 swap 数量:"
echo "  - zeroForOne (卖 TokenA 买 TokenB): $MAX_ZERO_FOR_ONE"
echo "  - oneForZero (卖 TokenB 买 TokenA): $MAX_ONE_FOR_ZERO"

echo "✅ cast-only Pool 状态验证完成"
