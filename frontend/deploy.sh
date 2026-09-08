#!/bin/bash

echo "=========================================="
echo "🚀 Deploy frontend to a local server"
echo "=========================================="
echo ""

# Ensure the build output exists
if [ ! -d "dist" ]; then
    echo "❌ The dist directory is missing. Run npm run build first."
    exit 1
fi

echo "✅ Found the dist directory"
echo ""

# Option 1: start a simple HTTP server with serve
echo "📦 Option 1: Start with serve (recommended for testing)"
echo "---"

# Check whether serve is installed
if command -v serve &> /dev/null; then
    echo "✅ serve is installed"
    echo ""
    echo "Starting the server at http://localhost:3000"
    echo "Press Ctrl+C to stop the server"
    echo ""
    cd dist && serve -s . -p 3000
else
    echo "⚠️  serve is not installed"
    echo ""
    echo "Install it with:"
    echo "  npm install -g serve"
    echo ""
    echo "Alternatively, start a server with Python:"
    echo "  cd dist && python3 -m http.server 3000"
    echo ""
    
    # Option 2: start a Python HTTP server
    echo "📦 Option 2: Start a Python HTTP server"
    echo "---"
    if command -v python3 &> /dev/null; then
        echo "✅ Python 3 is installed"
        echo ""
        echo "Starting the server at http://localhost:3000"
        echo "Press Ctrl+C to stop the server"
        echo ""
        cd dist && python3 -m http.server 3000
    else
        echo "❌ Python 3 is not installed"
        echo ""
        echo "Deploy the dist directory to your web server manually"
    fi
fi

echo ""
echo "=========================================="
