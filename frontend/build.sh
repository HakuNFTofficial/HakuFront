#!/bin/bash

# Frontend build script
# Usage: ./build.sh

set -e

echo "🚀 Starting frontend build..."

# Ensure the script runs from the frontend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: run this script from the frontend directory"
    exit 1
fi

# Install dependencies when needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Remove previous build output
if [ -d "dist" ]; then
    echo "🧹 Removing previous build output..."
    rm -rf dist
fi

# Build the production bundle
echo "🔨 Building the production bundle..."
npm run build

# Validate the build output
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo "✅ Build completed successfully."
    echo "📁 Build output: $(pwd)/dist"
    echo ""
    echo "📋 Next steps:"
    echo "1. Upload every file in dist to the server"
    echo "2. Configure nginx (see DEPLOYMENT_GUIDE.md)"
    echo "3. Ensure the backend service is listening on port 8686"
else
    echo "❌ Build failed: the dist directory or index.html is missing"
    exit 1
fi
