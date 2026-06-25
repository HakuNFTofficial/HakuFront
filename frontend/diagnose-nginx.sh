#!/bin/bash
# Nginx配置诊断和修复脚本
# 用于解决显示nginx默认页面而不是前端应用的问题

set -e

echo "=========================================="
echo "🔍 Nginx配置诊断工具"
echo "=========================================="
echo ""

# 1. 检查nginx是否运行
echo "1️⃣ 检查nginx状态..."
if systemctl is-active --quiet nginx; then
    echo "   ✅ nginx正在运行"
else
    echo "   ❌ nginx未运行，正在启动..."
    sudo systemctl start nginx
fi

# 2. 检查所有启用的站点配置
echo ""
echo "2️⃣ 检查启用的站点配置..."
echo "   sites-enabled目录:"
if [ -d /etc/nginx/sites-enabled ]; then
    ls -la /etc/nginx/sites-enabled/ | grep -v "^total" | grep -v "^d"
    
    # 检查默认站点
    if ls /etc/nginx/sites-enabled/ | grep -q "default"; then
        echo ""
        echo "   ⚠️  发现默认站点配置！"
        echo "   找到的文件:"
        ls /etc/nginx/sites-enabled/ | grep "default"
        echo ""
        read -p "   是否删除默认站点配置? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo rm -f /etc/nginx/sites-enabled/default
            sudo rm -f /etc/nginx/sites-enabled/000-default
            sudo rm -f /etc/nginx/sites-enabled/000-default.conf
            echo "   ✅ 已删除默认站点配置"
        fi
    else
        echo "   ✅ 未发现默认站点配置"
    fi
else
    echo "   ⚠️  sites-enabled目录不存在（可能使用conf.d）"
fi

# 3. 检查conf.d目录
echo ""
echo "3️⃣ 检查conf.d目录..."
if [ -d /etc/nginx/conf.d ]; then
    echo "   conf.d目录内容:"
    ls -la /etc/nginx/conf.d/ | grep -v "^total" | grep -v "^d"
    
    if [ -f /etc/nginx/conf.d/default.conf ]; then
        echo ""
        echo "   ⚠️  发现默认配置: default.conf"
        read -p "   是否备份并删除? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak
            echo "   ✅ 已备份为 default.conf.bak"
        fi
    fi
fi

# 4. 检查你的配置
echo ""
echo "4️⃣ 检查你的前端配置..."
CONFIG_AVAILABLE="/etc/nginx/sites-available/uniswap-v4-frontend.conf"
CONFIG_ENABLED="/etc/nginx/sites-enabled/uniswap-v4-frontend.conf"
CONFIG_CONFD="/etc/nginx/conf.d/uniswap-v4-frontend.conf"

FOUND_CONFIG=""

if [ -f "$CONFIG_AVAILABLE" ]; then
    echo "   ✅ 找到配置: $CONFIG_AVAILABLE"
    FOUND_CONFIG="$CONFIG_AVAILABLE"
    
    # 检查是否启用
    if [ -L "$CONFIG_ENABLED" ] || [ -f "$CONFIG_ENABLED" ]; then
        echo "   ✅ 配置已启用"
    else
        echo "   ⚠️  配置未启用，正在创建符号链接..."
        sudo ln -sf "$CONFIG_AVAILABLE" "$CONFIG_ENABLED"
        echo "   ✅ 已启用"
    fi
elif [ -f "$CONFIG_CONFD" ]; then
    echo "   ✅ 找到配置: $CONFIG_CONFD"
    FOUND_CONFIG="$CONFIG_CONFD"
else
    echo "   ❌ 未找到配置文件！"
    echo ""
    echo "   请创建配置文件:"
    echo "   sudo nano $CONFIG_AVAILABLE"
    echo "   或"
    echo "   sudo nano $CONFIG_CONFD"
    echo ""
    echo "   然后复制 nginx.conf.example 的内容"
    exit 1
fi

# 5. 检查配置内容
echo ""
echo "5️⃣ 检查配置内容..."
if [ -n "$FOUND_CONFIG" ]; then
    # 检查default_server
    if grep -q "listen 80 default_server" "$FOUND_CONFIG"; then
        echo "   ✅ 配置包含 default_server"
    else
        echo "   ❌ 配置缺少 default_server！"
        echo "   请确保配置文件中包含: listen 80 default_server;"
        echo ""
        read -p "   是否自动修复? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo sed -i 's/listen 80;/listen 80 default_server;/g' "$FOUND_CONFIG"
            echo "   ✅ 已修复"
        fi
    fi
    
    # 检查root路径
    ROOT_PATH=$(grep "^\s*root" "$FOUND_CONFIG" | head -1 | awk '{print $2}' | tr -d ';')
    if [ -n "$ROOT_PATH" ]; then
        echo "   📁 root路径: $ROOT_PATH"
        if [ -d "$ROOT_PATH" ]; then
            echo "   ✅ 路径存在"
            if [ -f "$ROOT_PATH/index.html" ]; then
                echo "   ✅ index.html存在"
            else
                echo "   ❌ index.html不存在！"
                echo "   请检查文件路径或上传前端文件"
            fi
        else
            echo "   ❌ 路径不存在！"
            echo "   请检查配置中的root路径是否正确"
        fi
    else
        echo "   ⚠️  未找到root配置"
    fi
fi

# 6. 检查nginx实际加载的配置
echo ""
echo "6️⃣ 检查nginx实际加载的配置..."
echo "   监听80端口的配置:"
sudo nginx -T 2>/dev/null | grep -A 5 "listen 80" | head -20

echo ""
echo "   default_server配置:"
DEFAULT_SERVERS=$(sudo nginx -T 2>/dev/null | grep "default_server" | wc -l)
if [ "$DEFAULT_SERVERS" -gt 0 ]; then
    sudo nginx -T 2>/dev/null | grep -B 2 -A 5 "default_server" | head -20
    echo "   ✅ 找到 $DEFAULT_SERVERS 个 default_server 配置"
else
    echo "   ❌ 未找到 default_server 配置！"
    echo "   这是问题的根源！"
fi

# 7. 测试配置
echo ""
echo "7️⃣ 测试nginx配置..."
if sudo nginx -t 2>&1 | grep -q "test is successful"; then
    echo "   ✅ 配置测试通过"
    TEST_PASSED=true
else
    echo "   ❌ 配置测试失败！"
    echo "   错误信息:"
    sudo nginx -t
    TEST_PASSED=false
fi

# 8. 如果测试通过，重新加载
if [ "$TEST_PASSED" = true ]; then
    echo ""
    echo "8️⃣ 重新加载nginx..."
    if sudo systemctl reload nginx; then
        echo "   ✅ nginx已重新加载"
    else
        echo "   ⚠️  reload失败，尝试重启..."
        sudo systemctl restart nginx
        echo "   ✅ nginx已重启"
    fi
    
    # 9. 验证
    echo ""
    echo "9️⃣ 验证访问..."
    sleep 1
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo "000")
    if [ "$RESPONSE" = "200" ]; then
        echo "   ✅ 本地访问正常 (HTTP $RESPONSE)"
    else
        echo "   ⚠️  本地访问返回: HTTP $RESPONSE"
    fi
fi

# 10. 总结
echo ""
echo "=========================================="
echo "📋 诊断总结"
echo "=========================================="
echo ""
echo "如果问题仍然存在，请检查:"
echo "1. 配置文件路径: $FOUND_CONFIG"
echo "2. root路径是否正确: $ROOT_PATH"
echo "3. 前端文件是否存在: $ROOT_PATH/index.html"
echo "4. 文件权限是否正确"
echo ""
echo "🔍 调试命令:"
echo "   sudo nginx -T | grep -A 10 'listen 80'"
echo "   curl -I http://localhost/"
echo "   sudo tail -f /var/log/nginx/error.log"
echo ""

