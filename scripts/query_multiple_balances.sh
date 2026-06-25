#!/bin/bash

# ============================================================
# 批量查询 HakuToken 余额脚本
# ============================================================
# 用途：一次性查询多个地址的 HakuToken 余额
# ============================================================

HAKU_TOKEN="0x41166CCe5C4C6673e7eF4c59169896d7e29c89f3"
HUKU_NFT="0x8557aFC94164F53a0828EB4ca16afE7dE280BE34"
RPC_URL="https://dream-rpc.somnia.network"

echo "============================================================"
echo "💰 批量查询 HakuToken 余额"
echo "============================================================"
echo ""
echo "HakuToken 合约: $HAKU_TOKEN"
echo ""

# 查询 HukuNFT 合约余额
echo "1. HukuNFT 合约余额："
echo "   地址: $HUKU_NFT"
BALANCE_NFT=$(cast call "$HAKU_TOKEN" \
  "balanceOf(address)(uint256)" \
  "$HUKU_NFT" \
  --rpc-url "$RPC_URL")
BALANCE_NFT_FORMATTED=$(echo "scale=4; $BALANCE_NFT / 1000000000000000000" | bc 2>/dev/null)
echo "   余额: $BALANCE_NFT wei ($BALANCE_NFT_FORMATTED HakuToken)"
echo ""

# 如果提供了用户地址作为参数
if [ -n "$1" ]; then
    USER_ADDRESS="$1"
    echo "2. 用户地址余额："
    echo "   地址: $USER_ADDRESS"
    BALANCE_USER=$(cast call "$HAKU_TOKEN" \
      "balanceOf(address)(uint256)" \
      "$USER_ADDRESS" \
      --rpc-url "$RPC_URL")
    BALANCE_USER_FORMATTED=$(echo "scale=4; $BALANCE_USER / 1000000000000000000" | bc 2>/dev/null)
    echo "   余额: $BALANCE_USER wei ($BALANCE_USER_FORMATTED HakuToken)"
    echo ""
fi

# 查询 HakuToken 总供应量
echo "3. HakuToken 总供应量："
TOTAL_SUPPLY=$(cast call "$HAKU_TOKEN" \
  "totalSupply()(uint256)" \
  --rpc-url "$RPC_URL")
TOTAL_SUPPLY_FORMATTED=$(echo "scale=4; $TOTAL_SUPPLY / 1000000000000000000" | bc 2>/dev/null)
echo "   总供应量: $TOTAL_SUPPLY wei ($TOTAL_SUPPLY_FORMATTED HakuToken)"
echo ""

echo "============================================================"

