#!/bin/bash

# ============================================================
# 查询 HakuToken 余额脚本（通用）
# ============================================================
# 用途：查询任意地址的 HakuToken 余额
# ============================================================

HAKU_TOKEN="0x41166CCe5C4C6673e7eF4c59169896d7e29c89f3"
RPC_URL="https://dream-rpc.somnia.network"

# 检查参数
if [ -z "$1" ]; then
    echo "用法: $0 <地址>"
    echo ""
    echo "示例："
    echo "  $0 0x8557aFC94164F53a0828EB4ca16afE7dE280BE34  # HukuNFT 合约"
    echo "  $0 0xD693a84A55fd1CbA3e1B5d82571b4Cfe1aF14510  # 用户地址"
    echo ""
    exit 1
fi

ADDRESS="$1"

echo "============================================================"
echo "💰 查询 HakuToken 余额"
echo "============================================================"
echo ""
echo "HakuToken 合约: $HAKU_TOKEN"
echo "查询地址: $ADDRESS"
echo ""

# 查询余额
BALANCE=$(cast call "$HAKU_TOKEN" \
  "balanceOf(address)(uint256)" \
  "$ADDRESS" \
  --rpc-url "$RPC_URL")

if [ $? -eq 0 ]; then
    # 格式化显示（假设 18 decimals）
    BALANCE_FORMATTED=$(echo "scale=4; $BALANCE / 1000000000000000000" | bc 2>/dev/null)
    
    echo "余额 (wei): $BALANCE"
    if [ -n "$BALANCE_FORMATTED" ]; then
        echo "余额 (HakuToken): $BALANCE_FORMATTED"
    else
        echo "余额 (HakuToken): 无法格式化（请确保已安装 bc 工具）"
    fi
else
    echo "❌ 查询失败"
    exit 1
fi

echo ""
echo "============================================================"

