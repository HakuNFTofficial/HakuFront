#!/bin/bash

# 检查 PoolManager 的锁定状态

set -e

# 配置
RPC_URL="${RPC_URL:-https://dream-rpc.somnia.network}"
POOL_MANAGER="${POOL_MANAGER:-0xaD05f7c50825374aE2dE3F29d36346FB98512182}"

echo "========================================================================
检查 PoolManager 锁定状态
========================================================================
"

# 检查 PoolManager 是否已解锁
# 注意：PoolManager 可能没有直接的 isUnlocked 函数，需要检查其他方法

echo "检查 PoolManager 合约..."
echo "PoolManager 地址: $POOL_MANAGER"
echo ""

# 尝试调用一个需要解锁的函数来测试状态
echo "尝试查询池子状态（这不需要解锁）..."
POOL_ID="0x8ec3af76f7e5a35a7a6c0d9d4a92ec59b98912daf7669b320c10ed749b51bc2e"

# 尝试调用 getSlot0（如果存在）
SLOT0=$(cast call "$POOL_MANAGER" \
  "getSlot0(bytes32)(uint160,int24,uint24,uint24,uint24,uint8,bool)" \
  "$POOL_ID" \
  --rpc-url "$RPC_URL" 2>&1 || echo "查询失败")

echo "Slot0 查询结果: $SLOT0"
echo ""

echo "💡 提示:"
echo "   如果 PoolManager 已锁定，unlock 调用会失败"
echo "   如果 PoolManager 已解锁，unlock 调用会 revert AlreadyUnlocked"
echo "   错误数据 '0x' 可能意味着："
echo "   1. abi.decode 失败（data 格式不匹配）"
echo "   2. 某个 require 失败但没有错误消息"
echo "   3. PoolManager 状态检查失败"
echo ""

