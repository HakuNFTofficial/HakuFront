#!/bin/bash

echo "=========================================="
echo "🚀 部署前端到本地服务器"
echo "=========================================="
echo ""

# 检查 dist 目录是否存在
if [ ! -d "dist" ]; then
    echo "❌ dist 目录不存在，请先运行 npm run build"
    exit 1
fi

echo "✅ 找到 dist 目录"
echo ""

# 选项1: 使用 serve 启动简单的 HTTP 服务器
echo "📦 选项1: 使用 serve 启动（推荐用于测试）"
echo "---"

# 检查是否安装了 serve
if command -v serve &> /dev/null; then
    echo "✅ serve 已安装"
    echo ""
    echo "启动服务器在 http://localhost:3000"
    echo "按 Ctrl+C 停止服务器"
    echo ""
    cd dist && serve -s . -p 3000
else
    echo "⚠️  serve 未安装"
    echo ""
    echo "安装方法："
    echo "  npm install -g serve"
    echo ""
    echo "或者使用 Python 启动服务器:"
    echo "  cd dist && python3 -m http.server 3000"
    echo ""
    
    # 选项2: 使用 Python 启动
    echo "📦 选项2: 使用 Python HTTP 服务器"
    echo "---"
    if command -v python3 &> /dev/null; then
        echo "✅ Python3 已安装"
        echo ""
        echo "启动服务器在 http://localhost:3000"
        echo "按 Ctrl+C 停止服务器"
        echo ""
        cd dist && python3 -m http.server 3000
    else
        echo "❌ Python3 未安装"
        echo ""
        echo "请手动将 dist/ 目录部署到你的 web 服务器"
    fi
fi

echo ""
echo "=========================================="
