#!/bin/bash

# 检查 Position 详细信息
# 从 PoolConfig.sol 读取配置

set -e

# Load configuration from PoolConfig.sol
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load_pool_config.sh"

# Use configuration from PoolConfig.sol
ADD_LIQUIDITY_EXECUTOR="0xB93Fcd0919b8cB83abEb417060D9120Db8Bc90B0"
POOL_MANAGER="$POOL_CONFIG_POOL_MANAGER"
RPC_URL="https://dream-rpc.somnia.network"

# Pool parameters from PoolConfig.sol
CURRENCY0="$POOL_CONFIG_TOKEN_A"
CURRENCY1="$POOL_CONFIG_TOKEN_B"
FEE="$POOL_CONFIG_FEE"
TICK_SPACING="$POOL_CONFIG_TICK_SPACING"
HOOKS="$POOL_CONFIG_HOOKS"
TICK_LOWER="$POOL_CONFIG_TICK_LOWER"
TICK_UPPER="$POOL_CONFIG_TICK_UPPER"
SALT="$POOL_CONFIG_SALT"

# 计算 PoolId
POOL_ID=$(cast keccak "$(cast abi-encode "f(address,address,uint24,int24,address)" "$CURRENCY0" "$CURRENCY1" "$FEE" "$TICK_SPACING" "$HOOKS")")

echo "========================================================================"
echo "🔍 检查 Position 详细信息"
echo "========================================================================"
echo ""
echo "PoolId: $POOL_ID"
echo "Position Owner: $ADD_LIQUIDITY_EXECUTOR"
echo "tickLower: $TICK_LOWER"
echo "tickUpper: $TICK_UPPER"
echo "salt: $SALT"
echo ""

# 1. 查询流动性
echo "1. 查询流动性数量..."
LIQUIDITY=$(cast call "$ADD_LIQUIDITY_EXECUTOR" \
  "getPositionLiquidity(bytes32,address,int24,int24,bytes32)(uint128)" \
  "$POOL_ID" \
  "$ADD_LIQUIDITY_EXECUTOR" \
  "$TICK_LOWER" \
  "$TICK_UPPER" \
  "$SALT" \
  --rpc-url "$RPC_URL" 2>&1 | awk '{print $1}')

echo "流动性: $LIQUIDITY"
echo ""

# 2. 检查池子 slot0（当前价格和 tick）
echo "2. 检查池子当前状态..."
SLOT0=$(cast call "$POOL_MANAGER" \
  "getSlot0(bytes32)(uint160,int24,uint24,uint24,uint24,uint8,bool)" \
  "$POOL_ID" \
  --rpc-url "$RPC_URL" 2>&1)

echo "Slot0: $SLOT0"
echo ""

# 3. 尝试使用 trace 模式查看详细错误
echo "3. 尝试模拟交易（使用 trace 模式）..."
echo "   这将显示详细的 revert 原因"
echo ""

# 4. 建议
echo "========================================================================"
echo "💡 可能的原因和解决方案"
echo "========================================================================"
echo ""
echo "如果流动性数量 > 0 但仍然 revert，可能的原因："
echo ""
echo "1. ✅ 流动性数量正确，但 tickLower/tickUpper 不匹配"
echo "   → 检查添加流动性时使用的实际 tick 值"
echo ""
echo "2. ✅ Position 的所有者不是 AddLiquidityExecutor"
echo "   → 检查添加流动性时 position 的所有者地址"
echo ""
echo "3. ✅ salt 值不匹配"
echo "   → 检查添加流动性时使用的 salt 值"
echo ""
echo "4. ✅ 池子当前价格超出 tickLower/tickUpper 范围"
echo "   → 检查 slot0 中的当前 tick 是否在范围内"
echo ""
echo "建议："
echo "- 查看添加流动性时的交易日志，确认实际使用的参数"
echo "- 尝试使用 --trace 或 --debug 模式获取详细错误信息"
echo ""

