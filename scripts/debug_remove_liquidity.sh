#!/bin/bash

# 详细调试移除流动性问题

set -e

ADD_LIQUIDITY_EXECUTOR="0xB93Fcd0919b8cB83abEb417060D9120Db8Bc90B0"
POOL_MANAGER="0xaD05f7c50825374aE2dE3F29d36346FB98512182"
RPC_URL="https://dream-rpc.somnia.network"

# 池子参数 (fee=3001)
CURRENCY0="0x0000000000000000000000000000000000000000"
CURRENCY1="0x41166CCe5C4C6673e7eF4c59169896d7e29c89f3"
FEE="3001"
TICK_SPACING="60"
HOOKS="0x0000000000000000000000000000000000000000"
TICK_LOWER="-887220"
TICK_UPPER="887220"
SALT="0x0000000000000000000000000000000000000000000000000000000000000000"

# 计算 PoolId
POOL_ID=$(cast keccak "$(cast abi-encode "f(address,address,uint24,int24,address)" "$CURRENCY0" "$CURRENCY1" "$FEE" "$TICK_SPACING" "$HOOKS")")

echo "========================================================================"
echo "🔍 详细调试移除流动性"
echo "========================================================================"
echo ""
echo "PoolId: $POOL_ID"
echo ""

# 1. 查询流动性
echo "1. 查询流动性数量..."
LIQUIDITY_RAW=$(cast call "$ADD_LIQUIDITY_EXECUTOR" \
  "getPositionLiquidity(bytes32,address,int24,int24,bytes32)(uint128)" \
  "$POOL_ID" \
  "$ADD_LIQUIDITY_EXECUTOR" \
  "$TICK_LOWER" \
  "$TICK_UPPER" \
  "$SALT" \
  --rpc-url "$RPC_URL" 2>&1)

LIQUIDITY=$(echo "$LIQUIDITY_RAW" | awk '{print $1}')
echo "流动性: $LIQUIDITY"
echo ""

# 2. 检查 owner
echo "2. 检查合约 owner..."
OWNER=$(cast call "$ADD_LIQUIDITY_EXECUTOR" \
  "owner()(address)" \
  --rpc-url "$RPC_URL" 2>&1 | awk '{print $1}')
echo "Owner: $OWNER"
echo ""

# 3. 尝试模拟交易（dry-run）
echo "3. 尝试模拟移除流动性（使用较小的数量测试）..."
TEST_LIQUIDITY="100000000000000000000"  # 只移除 1/10

echo "测试流动性数量: $TEST_LIQUIDITY"
echo ""

# 4. 检查池子是否存在
echo "4. 检查池子 slot0..."
SLOT0=$(cast call "$POOL_MANAGER" \
  "getSlot0(bytes32)(uint160,int24,uint24,uint24,uint24,uint8,bool)" \
  "$POOL_ID" \
  --rpc-url "$RPC_URL" 2>&1)

echo "Slot0: $SLOT0"
echo ""

# 5. 建议
echo "========================================================================"
echo "💡 建议"
echo "========================================================================"
echo ""
echo "如果流动性数量正确但仍然失败，可能的原因："
echo "1. Position 的所有者不是 AddLiquidityExecutor 合约"
echo "2. tickLower/tickUpper/salt 参数不匹配"
echo "3. 池子状态异常"
echo ""
echo "可以尝试："
echo "- 先移除一小部分流动性测试: $TEST_LIQUIDITY"
echo "- 检查 Position 的实际参数（可能需要查看添加流动性时的交易日志）"
echo ""

