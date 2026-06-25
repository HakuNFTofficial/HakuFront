#!/bin/bash

# 修复 Swap 使用错误池子的问题

set -e

RPC_URL="https://dream-rpc.somnia.network"
SWAP_EXECUTOR="0x39B499c55eAF4d6c2dE66943b4d21e4dbE54170A"
ADD_LIQUIDITY_EXECUTOR="0xB93Fcd0919b8cB83abEb417060D9120Db8Bc90B0"
NEW_POOL_ID="0xf02384225932f5e3a3bdd468bd3136a10f9c3bf617af245ca43e982b8b843b03"

echo "========================================================================"
echo "🔍 诊断 Swap 池子问题"
echo "========================================================================"
echo ""

# 步骤1: 检查新池子流动性
echo "步骤1: 检查新池子 (fee=3001) 的流动性"
echo "----------------------------------------"

LIQUIDITY=$(cast call "$ADD_LIQUIDITY_EXECUTOR" \
  "getPositionLiquidity(bytes32,address,int24,int24,bytes32)(uint128)" \
  "$NEW_POOL_ID" \
  "$ADD_LIQUIDITY_EXECUTOR" \
  "-887220" \
  "887220" \
  "0x0000000000000000000000000000000000000000000000000000000000000000" \
  --rpc-url "$RPC_URL" 2>/dev/null || echo "0")

echo "新池子流动性: $LIQUIDITY"
echo ""

if [ "$LIQUIDITY" == "0" ] || [ -z "$LIQUIDITY" ]; then
    echo "❌ 新池子没有流动性！"
    echo ""
    echo "解决方案:"
    echo "  1. 执行: ./scripts/add_liquidity_to_new_pool.sh"
    echo "  2. 添加流动性后，Swap 才能使用新池子"
    echo ""
    exit 1
else
    echo "✅ 新池子有流动性"
    echo ""
fi

# 步骤2: 检查 SwapExecutor 使用的 tokenA 和 tokenB
echo "步骤2: 检查 SwapExecutor 的代币配置"
echo "----------------------------------------"

TOKEN_A=$(cast call "$SWAP_EXECUTOR" "tokenA()(address)" --rpc-url "$RPC_URL" 2>/dev/null || echo "")
TOKEN_B=$(cast call "$SWAP_EXECUTOR" "tokenB()(address)" --rpc-url "$RPC_URL" 2>/dev/null || echo "")

echo "SwapExecutor tokenA: $TOKEN_A"
echo "SwapExecutor tokenB: $TOKEN_B"
echo ""
echo "PoolConfig TOKEN_A: 0x0000000000000000000000000000000000000000 (STT)"
echo "PoolConfig TOKEN_B: 0x41166CCe5C4C6673e7eF4c59169896d7e29c89f3"
echo ""

if [ "$TOKEN_B" != "0x41166CCe5C4C6673e7eF4c59169896d7e29c89f3" ]; then
    echo "⚠️  SwapExecutor 的 tokenB 不匹配！"
    echo ""
fi

echo "========================================================================"
echo "💡 问题分析"
echo "========================================================================"
echo ""
echo "如果 Swap 得到 100 HakuToken 而不是 1:"
echo ""
echo "原因:"
echo "  - SwapExecutor 可能在使用旧池子 (fee=2999, 1:100价格)"
echo "  - 或者新池子确实是 1:100 初始化的"
echo ""
echo "解决方案:"
echo "  1. 确保新池子有流动性 ✅"
echo "  2. 升级 SwapExecutor（如果需要）"
echo "  3. 更新前端配置"
echo ""
echo "========================================================================"
echo "🔧 下一步操作"
echo "========================================================================"
echo ""
echo "选择一个:"
echo ""
echo "选项1: 添加流动性到新池子 (1:1)"
echo "  ./scripts/add_liquidity_to_new_pool.sh"
echo ""
echo "选项2: 重新初始化池子为 1:100"
echo "  修改 PoolConfig.SQRT_PRICE_X96 = 792281625142643375935439503360"
echo "  修改 PoolConfig.LIQUIDITY_RATIO = 100"
echo "  然后重新初始化"
echo ""
echo "选项3: 接受当前 1:100 的价格"
echo "  不需要修改，这是设计如此"
echo ""
echo "========================================================================"

