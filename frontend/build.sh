#!/bin/bash

# 前端项目打包脚本
# 使用方法: ./build.sh

set -e

echo "🚀 开始构建前端项目..."

# 检查是否在frontend目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在frontend目录下运行此脚本"
    exit 1
fi

# 检查node_modules是否存在
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 清理旧的构建文件
if [ -d "dist" ]; then
    echo "🧹 清理旧的构建文件..."
    rm -rf dist
fi

# 构建项目
echo "🔨 构建生产版本..."
npm run build

# 检查构建结果
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo "✅ 构建成功！"
    echo "📁 构建文件位于: $(pwd)/dist"
    echo ""
    echo "📋 下一步:"
    echo "1. 将 dist 目录下的所有文件上传到服务器"
    echo "2. 配置nginx（参考 DEPLOYMENT_GUIDE.md）"
    echo "3. 确保后端服务在8686端口运行"
else
    echo "❌ 构建失败: dist目录或index.html不存在"
    exit 1
fi

