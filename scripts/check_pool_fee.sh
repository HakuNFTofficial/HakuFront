#!/bin/bash

# 检查池子的实际 fee

RPC_URL="https://dream-rpc.somnia.network"

# 配置文件中的 POOL_ID
CONFIG_POOL_ID="0xf02384225932f5e3a3bdd468bd3136a10f9c3bf617af245ca43e982b8b843b03"

# 脚本计算的旧池子 PoolId (fee=2999)
OLD_POOL_ID_2999="0x4169231e7a0fa94449c471ca364a94b165b9a5eb011bd3a261a3e094e135bf1b"

# 计算 fee=3001 的 PoolId
echo "计算 fee=3001 的 PoolId:"
POOL_ID_3001=$(cast keccak "$(cast abi-encode "f(address,address,uint24,int24,address)" \
  "0x0000000000000000000000000000000000000000" \
  "0x41166CCe5C4C6673e7eF4c59169896d7e29c89f3" \
  "3001" \
  "60" \
  "0x0000000000000000000000000000000000000000")")
echo "  $POOL_ID_3001"
echo ""

echo "计算 fee=2999 的 PoolId:"
POOL_ID_2999=$(cast keccak "$(cast abi-encode "f(address,address,uint24,int24,address)" \
  "0x0000000000000000000000000000000000000000" \
  "0x41166CCe5C4C6673e7eF4c59169896d7e29c89f3" \
  "2999" \
  "60" \
  "0x0000000000000000000000000000000000000000")")
echo "  $POOL_ID_2999"
echo ""

echo "配置文件中的 POOL_ID:"
echo "  $CONFIG_POOL_ID"
echo ""

echo "对比结果:"
if [ "$CONFIG_POOL_ID" == "$POOL_ID_3001" ]; then
    echo "  ✅ 配置文件 POOL_ID 匹配 fee=3001"
    echo "  → 如果这是新池子，旧池子可能是 fee=2999"
elif [ "$CONFIG_POOL_ID" == "$POOL_ID_2999" ]; then
    echo "  ✅ 配置文件 POOL_ID 匹配 fee=2999"
    echo "  → 当前池子就是 fee=2999，没有旧池子"
else
    echo "  ⚠️  配置文件 POOL_ID 不匹配任何计算的 PoolId"
fi
echo ""

echo "脚本查询到的流动性 PoolId (fee=2999):"
echo "  $OLD_POOL_ID_2999"
echo ""

if [ "$OLD_POOL_ID_2999" == "$POOL_ID_2999" ]; then
    echo "  ✅ 脚本计算的 PoolId 正确（fee=2999）"
else
    echo "  ❌ 脚本计算的 PoolId 不匹配"
fi

