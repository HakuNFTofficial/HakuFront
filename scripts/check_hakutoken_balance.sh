#!/bin/bash

# ============================================================
# 查询 HukuNFT 合约的 HakuToken 余额
# ============================================================

HUKU_NFT="0x8557aFC94164F53a0828EB4ca16afE7dE280BE34"
HAKU_TOKEN="0x41166CCe5C4C6673e7eF4c59169896d7e29c89f3"
RPC_URL="https://dream-rpc.somnia.network"

echo "============================================================"
echo "💰 查询 HukuNFT 合约的 HakuToken 余额"
echo "============================================================"
echo ""

# 方法 1：使用 getHakuTokenBalance() 函数
echo "方法 1: 使用 getHakuTokenBalance() 函数"
BALANCE=$(cast call "$HUKU_NFT" \
  "getHakuTokenBalance()(uint256)" \
  --rpc-url "$RPC_URL")

if [ $? -eq 0 ]; then
    # 格式化显示（假设 18 decimals）
    BALANCE_FORMATTED=$(echo "scale=4; $BALANCE / 1000000000000000000" | bc)
    echo "  余额 (wei): $BALANCE"
    echo "  余额 (HakuToken): $BALANCE_FORMATTED"
else
    echo "  ❌ 查询失败"
fi

echo ""

# 方法 2：直接查询 HakuToken 的 balanceOf
echo "方法 2: 直接查询 HakuToken.balanceOf(HukuNFT)"
BALANCE2=$(cast call "$HAKU_TOKEN" \
  "balanceOf(address)(uint256)" \
  "$HUKU_NFT" \
  --rpc-url "$RPC_URL")

if [ $? -eq 0 ]; then
    BALANCE2_FORMATTED=$(echo "scale=4; $BALANCE2 / 1000000000000000000" | bc)
    echo "  余额 (wei): $BALANCE2"
    echo "  余额 (HakuToken): $BALANCE2_FORMATTED"
    
    # 验证两个方法的结果是否一致
    if [ "$BALANCE" = "$BALANCE2" ]; then
        echo "  ✅ 两种方法结果一致"
    else
        echo "  ⚠️  警告: 两种方法结果不一致"
    fi
else
    echo "  ❌ 查询失败"
fi

echo ""
echo "============================================================"

