#!/bin/bash
# Nginx configuration diagnostic and repair script
# Resolves cases where nginx serves its default page instead of the frontend

set -e

echo "=========================================="
echo "🔍 Nginx Configuration Diagnostic"
echo "=========================================="
echo ""

# 1. Check whether nginx is running
echo "1️⃣ Checking nginx status..."
if systemctl is-active --quiet nginx; then
    echo "   ✅ nginx is running"
else
    echo "   ❌ nginx is not running; starting it..."
    sudo systemctl start nginx
fi

# 2. Inspect enabled site configurations
echo ""
echo "2️⃣ Inspecting enabled site configurations..."
echo "   sites-enabled directory:"
if [ -d /etc/nginx/sites-enabled ]; then
    ls -la /etc/nginx/sites-enabled/ | grep -v "^total" | grep -v "^d"
    
    # Check for a default site
    if ls /etc/nginx/sites-enabled/ | grep -q "default"; then
        echo ""
        echo "   ⚠️  Found a default site configuration!"
        echo "   Matching files:"
        ls /etc/nginx/sites-enabled/ | grep "default"
        echo ""
        read -p "   Remove the default site configuration? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo rm -f /etc/nginx/sites-enabled/default
            sudo rm -f /etc/nginx/sites-enabled/000-default
            sudo rm -f /etc/nginx/sites-enabled/000-default.conf
            echo "   ✅ Removed the default site configuration"
        fi
    else
        echo "   ✅ No default site configuration found"
    fi
else
    echo "   ⚠️  sites-enabled does not exist; this system may use conf.d"
fi

# 3. Inspect the conf.d directory
echo ""
echo "3️⃣ Inspecting the conf.d directory..."
if [ -d /etc/nginx/conf.d ]; then
    echo "   conf.d contents:"
    ls -la /etc/nginx/conf.d/ | grep -v "^total" | grep -v "^d"
    
    if [ -f /etc/nginx/conf.d/default.conf ]; then
        echo ""
        echo "   ⚠️  Found default configuration: default.conf"
        read -p "   Back up and remove it? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak
            echo "   ✅ Backed up as default.conf.bak"
        fi
    fi
fi

# 4. Inspect the frontend configuration
echo ""
echo "4️⃣ Inspecting the frontend configuration..."
CONFIG_AVAILABLE="/etc/nginx/sites-available/uniswap-v4-frontend.conf"
CONFIG_ENABLED="/etc/nginx/sites-enabled/uniswap-v4-frontend.conf"
CONFIG_CONFD="/etc/nginx/conf.d/uniswap-v4-frontend.conf"

FOUND_CONFIG=""

if [ -f "$CONFIG_AVAILABLE" ]; then
    echo "   ✅ Found configuration: $CONFIG_AVAILABLE"
    FOUND_CONFIG="$CONFIG_AVAILABLE"
    
    # Check whether it is enabled
    if [ -L "$CONFIG_ENABLED" ] || [ -f "$CONFIG_ENABLED" ]; then
        echo "   ✅ Configuration is enabled"
    else
        echo "   ⚠️  Configuration is not enabled; creating a symbolic link..."
        sudo ln -sf "$CONFIG_AVAILABLE" "$CONFIG_ENABLED"
        echo "   ✅ Configuration enabled"
    fi
elif [ -f "$CONFIG_CONFD" ]; then
    echo "   ✅ Found configuration: $CONFIG_CONFD"
    FOUND_CONFIG="$CONFIG_CONFD"
else
    echo "   ❌ Configuration file not found!"
    echo ""
    echo "   Create a configuration file:"
    echo "   sudo nano $CONFIG_AVAILABLE"
    echo "   or"
    echo "   sudo nano $CONFIG_CONFD"
    echo ""
    echo "   Then copy the contents of nginx.conf.example"
    exit 1
fi

# 5. Inspect configuration content
echo ""
echo "5️⃣ Inspecting configuration content..."
if [ -n "$FOUND_CONFIG" ]; then
    # Check for default_server
    if grep -q "listen 80 default_server" "$FOUND_CONFIG"; then
        echo "   ✅ Configuration includes default_server"
    else
        echo "   ❌ Configuration is missing default_server!"
        echo "   Ensure the configuration includes: listen 80 default_server;"
        echo ""
        read -p "   Apply the fix automatically? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo sed -i 's/listen 80;/listen 80 default_server;/g' "$FOUND_CONFIG"
            echo "   ✅ Configuration fixed"
        fi
    fi
    
    # Inspect the root path
    ROOT_PATH=$(grep "^\s*root" "$FOUND_CONFIG" | head -1 | awk '{print $2}' | tr -d ';')
    if [ -n "$ROOT_PATH" ]; then
        echo "   📁 Root path: $ROOT_PATH"
        if [ -d "$ROOT_PATH" ]; then
            echo "   ✅ Path exists"
            if [ -f "$ROOT_PATH/index.html" ]; then
                echo "   ✅ index.html exists"
            else
                echo "   ❌ index.html is missing!"
                echo "   Check the file path or upload the frontend files"
            fi
        else
            echo "   ❌ Path does not exist!"
            echo "   Check the root path in the configuration"
        fi
    else
        echo "   ⚠️  Root directive not found"
    fi
fi

# 6. Inspect the configuration nginx actually loaded
echo ""
echo "6️⃣ Inspecting the configuration loaded by nginx..."
echo "   Configuration listening on port 80:"
sudo nginx -T 2>/dev/null | grep -A 5 "listen 80" | head -20

echo ""
echo "   default_server configuration:"
DEFAULT_SERVERS=$(sudo nginx -T 2>/dev/null | grep "default_server" | wc -l)
if [ "$DEFAULT_SERVERS" -gt 0 ]; then
    sudo nginx -T 2>/dev/null | grep -B 2 -A 5 "default_server" | head -20
    echo "   ✅ Found $DEFAULT_SERVERS default_server configuration(s)"
else
    echo "   ❌ No default_server configuration found!"
    echo "   This is the root cause of the issue."
fi

# 7. Test the configuration
echo ""
echo "7️⃣ Testing the nginx configuration..."
if sudo nginx -t 2>&1 | grep -q "test is successful"; then
    echo "   ✅ Configuration test passed"
    TEST_PASSED=true
else
    echo "   ❌ Configuration test failed!"
    echo "   Error details:"
    sudo nginx -t
    TEST_PASSED=false
fi

# 8. Reload nginx when the test passes
if [ "$TEST_PASSED" = true ]; then
    echo ""
    echo "8️⃣ Reloading nginx..."
    if sudo systemctl reload nginx; then
        echo "   ✅ nginx reloaded"
    else
        echo "   ⚠️  Reload failed; attempting a restart..."
        sudo systemctl restart nginx
        echo "   ✅ nginx restarted"
    fi
    
    # 9. Verify access
    echo ""
    echo "9️⃣ Verifying access..."
    sleep 1
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo "000")
    if [ "$RESPONSE" = "200" ]; then
        echo "   ✅ Local access succeeded (HTTP $RESPONSE)"
    else
        echo "   ⚠️  Local access returned HTTP $RESPONSE"
    fi
fi

# 10. Summary
echo ""
echo "=========================================="
echo "📋 Diagnostic Summary"
echo "=========================================="
echo ""
echo "If the issue persists, check:"
echo "1. Configuration file path: $FOUND_CONFIG"
echo "2. Root path: $ROOT_PATH"
echo "3. Frontend file: $ROOT_PATH/index.html"
echo "4. File permissions"
echo ""
echo "🔍 Debugging commands:"
echo "   sudo nginx -T | grep -A 10 'listen 80'"
echo "   curl -I http://localhost/"
echo "   sudo tail -f /var/log/nginx/error.log"
echo ""
