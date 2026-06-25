#!/bin/bash

# 执行 syncTokensFromConfig() 函数
# 用途：同步代理合约中的 tokenA 和 tokenB 与 PoolConfig 一致

# ============ 配置 ============
# 代理合约地址（AddLiquidityExecutor Proxy）
PROXY_ADDRESS="0xB93Fcd0919b8cB83abEb417060D9120Db8Bc90B0"

# RPC URL
RPC_URL="https://dream-rpc.somnia.network"

# 您的私钥（请替换为实际的 owner 私钥）
# ⚠️ 警告：请确保私钥安全，不要提交到版本控制系统
PRIVATE_KEY="${PRIVATE_KEY:-YOUR_PRIVATE_KEY}"

# ============ 执行 ============
echo "=========================================="
echo "🔄 同步代币地址到 PoolConfig"
echo "=========================================="
echo "代理地址: $PROXY_ADDRESS"
echo "RPC URL: $RPC_URL"
echo ""

# 检查私钥是否设置
if [ "$PRIVATE_KEY" = "YOUR_PRIVATE_KEY" ]; then
    echo "❌ 错误: 请设置 PRIVATE_KEY 环境变量"
    echo "使用方法: PRIVATE_KEY=your_private_key ./scripts/sync_tokens.sh"
    exit 1
fi

# 调用 syncTokensFromConfig()
echo "📤 正在调用 syncTokensFromConfig()..."
cast send $PROXY_ADDRESS \
  "syncTokensFromConfig()" \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY

echo ""
echo "✅ 完成！代币地址已同步到 PoolConfig 中的值"

