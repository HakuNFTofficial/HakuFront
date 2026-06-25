#!/bin/bash

# Load Pool Configuration from src/PoolConfig.sol
# This script extracts constants from PoolConfig.sol and exports them as environment variables
# 
# Usage:
#   source scripts/load_pool_config.sh
#   echo $POOL_CONFIG_TICK_LOWER
#   echo $POOL_CONFIG_HOOKS

set -e

POOL_CONFIG_FILE="src/PoolConfig.sol"

# Helper function to extract constant value from PoolConfig.sol
# Handles both single-line and multi-line declarations
extract_constant() {
    local constant_name="$1"
    # Extract up to 2 lines to handle multi-line declarations
    local value=$(grep -A 1 -F "constant ${constant_name}" "$POOL_CONFIG_FILE" | \
                  head -2 | \
                  tr '\n' ' ' | \
                  sed 's|//.*||' | \
                  sed 's/.*=\s*//' | \
                  sed 's/;.*$//' | \
                  sed 's/^[[:space:]]*//' | \
                  sed 's/[[:space:]]*$//' | \
                  sed 's/[[:space:]]\+/ /g')
    echo "$value"
}

# Extract all constants
export POOL_CONFIG_POOL_MANAGER=$(extract_constant "POOL_MANAGER")
export POOL_CONFIG_TOKEN_A=$(extract_constant "TOKEN_A")
export POOL_CONFIG_TOKEN_B=$(extract_constant "TOKEN_B")
export POOL_CONFIG_SWAP_EXECUTOR=$(extract_constant "SWAP_EXECUTOR")
export POOL_CONFIG_QUOTER=$(extract_constant "QUOTER")

# Pool parameters
export POOL_CONFIG_FEE=$(extract_constant "FEE")
export POOL_CONFIG_HOOK_FEE=$(extract_constant "HOOK_FEE")
export POOL_CONFIG_TICK_SPACING=$(extract_constant "TICK_SPACING")
export POOL_CONFIG_HOOKS=$(extract_constant "HOOKS")

# Price and ratio
export POOL_CONFIG_SQRT_PRICE_X96=$(extract_constant "SQRT_PRICE_X96")
export POOL_CONFIG_LIQUIDITY_RATIO=$(extract_constant "LIQUIDITY_RATIO")

# Position parameters
export POOL_CONFIG_TICK_LOWER=$(extract_constant "TICK_LOWER")
export POOL_CONFIG_TICK_UPPER=$(extract_constant "TICK_UPPER")
export POOL_CONFIG_SALT=$(extract_constant "SALT")

# PoolId
export POOL_CONFIG_POOL_ID=$(extract_constant "POOL_ID")

# Handle special case for FEE (LPFeeLibrary.DYNAMIC_FEE_FLAG)
if echo "$POOL_CONFIG_FEE" | grep -q "DYNAMIC_FEE_FLAG"; then
    export POOL_CONFIG_FEE_HEX="0x800000"
    export POOL_CONFIG_FEE="8388608"  # 0x800000 in decimal
fi

# Display loaded configuration (optional, comment out in production)
if [ "${VERBOSE:-}" = "1" ]; then
    echo "✅ Configuration loaded from src/PoolConfig.sol"
    echo ""
    echo "Contracts:"
    echo "  POOL_MANAGER: $POOL_CONFIG_POOL_MANAGER"
    echo "  TOKEN_A:      $POOL_CONFIG_TOKEN_A"
    echo "  TOKEN_B:      $POOL_CONFIG_TOKEN_B"
    echo "  HOOKS:        $POOL_CONFIG_HOOKS"
    echo ""
    echo "Pool Parameters:"
    echo "  FEE:          $POOL_CONFIG_FEE (${POOL_CONFIG_FEE_HEX:-})"
    echo "  HOOK_FEE:     $POOL_CONFIG_HOOK_FEE"
    echo "  TICK_SPACING: $POOL_CONFIG_TICK_SPACING"
    echo ""
    echo "Position:"
    echo "  TICK_LOWER:   $POOL_CONFIG_TICK_LOWER"
    echo "  TICK_UPPER:   $POOL_CONFIG_TICK_UPPER"
    echo "  SALT:         $POOL_CONFIG_SALT"
    echo ""
    echo "Pool:"
    echo "  POOL_ID:      $POOL_CONFIG_POOL_ID"
    echo ""
fi
