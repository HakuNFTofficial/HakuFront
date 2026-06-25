#!/bin/bash

# Configuration
RPC_URL="${RPC_URL:-https://rpc.testnet.arc.network}"
PRIVATE_KEY="${PRIVATE_KEY:-}"
POOL_MANAGER="${POOL_MANAGER:-}"
CREATE2_FACTORY="${CREATE2_FACTORY:-}"
SALT="${SALT:-}"
EXPECTED_ADDR="${HOOK_ADDRESS:-}"

# Check if private key is provided as argument or env var
if [ -n "$1" ]; then
    PRIVATE_KEY="$1"
fi

if [ -z "$PRIVATE_KEY" ] || [ -z "$POOL_MANAGER" ] || [ -z "$CREATE2_FACTORY" ] || [ -z "$SALT" ]; then
    echo "Error: PRIVATE_KEY, POOL_MANAGER, CREATE2_FACTORY, and SALT are required."
    echo "Usage:"
    echo "  RPC_URL=https://rpc.testnet.arc.network \\"
    echo "  PRIVATE_KEY=0x... \\"
    echo "  POOL_MANAGER=0x... \\"
    echo "  CREATE2_FACTORY=0x... \\"
    echo "  SALT=0x... \\"
    echo "  ./scripts/deploy_fee_growth_hook_cast.sh"
    exit 1
fi

echo "Compiling..."
forge build

echo "Getting creation code..."
BYTECODE=$(forge inspect FeeGrowthHook bytecode)

if [ -z "$BYTECODE" ]; then
    echo "Error: Failed to get bytecode. Make sure compilation succeeded."
    exit 1
fi

echo "Encoding constructor arguments..."
# Constructor: constructor(IPoolManager _poolManager)
ENCODED_ARGS=$(cast abi-encode "constructor(address)" "$POOL_MANAGER")

# Remove "0x" from encoded args if present (cast abi-encode usually adds it)
ENCODED_ARGS=${ENCODED_ARGS#0x}

echo "Combining init code..."
INIT_CODE="${BYTECODE}${ENCODED_ARGS}"

echo "Deploying via Create2Factory..."
echo "RPC URL: $RPC_URL"
echo "PoolManager: $POOL_MANAGER"
echo "Factory: $CREATE2_FACTORY"
echo "Salt: $SALT"

if [ -n "$EXPECTED_ADDR" ]; then
    echo "Checking if already deployed at $EXPECTED_ADDR..."
    CODE_SIZE=$(cast code "$EXPECTED_ADDR" --rpc-url "$RPC_URL" | wc -c)

    # cast code returns 0x if empty.

    if [ "$CODE_SIZE" -gt 10 ]; then
        echo ""
        echo "⚠️  Contract already deployed."
        echo "----------------------------------------"
        echo "Hook Address: $EXPECTED_ADDR"
        echo "Salt:         $SALT"
        echo "----------------------------------------"
        exit 0
    fi
fi

echo "Sending transaction..."
CAST_OUTPUT=$(cast send "$CREATE2_FACTORY" "deploy(uint256,bytes)" "$SALT" "$INIT_CODE" --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --json)

if [ $? -ne 0 ]; then
    echo "Error: Deployment failed."
    echo "$CAST_OUTPUT"
    exit 1
fi

# Extract address from logs
# The Factory emits Deployed(address addr, uint256 salt)
# Topic 0: 0xb03c53b28e78a88e31607a27e1fa48234dce28d5d9d9ec7b295aeb02e674a1e1
# Data: 32 bytes address (padded), 32 bytes salt
# We can use cast receipt or parse the output if --json is used. 
# Since we used --json, we can parse the logs directly.

# Extract the data field from the log with the matching topic
LOG_DATA=$(echo "$CAST_OUTPUT" | jq -r '.logs[] | select(.topics[0] == "0xb03c53b28e78a88e31607a27e1fa48234dce28d5d9d9ec7b295aeb02e674a1e1") | .data')

if [ -n "$LOG_DATA" ]; then
    # The address is the first 32 bytes (64 chars) of data, but data starts with 0x
    # Address is effectively characters 26-66 of 0x-prefixed string (padded to 32 bytes)
    # Actually, standard ABI:
    # 0x + 64 chars (addr) + 64 chars (salt)
    # Address is right-aligned in the first word.
    
    # Remove 0x
    CLEAN_DATA=${LOG_DATA#0x}
    # First 64 chars is address word
    ADDR_WORD=${CLEAN_DATA:0:64}
    # Last 40 chars of that word is the address
    DEPLOYED_ADDR="0x${ADDR_WORD:24:40}"
    
    echo ""
    echo "✅ Deployment Successful!"
    echo "----------------------------------------"
    echo "Hook Address: $DEPLOYED_ADDR"
    echo "Salt:         $SALT"
    echo "Transaction:  $(echo "$CAST_OUTPUT" | jq -r '.transactionHash')"
    echo "----------------------------------------"
else 
    echo "Warning: Transaction succeeded but could not parse Deployed event."
    echo "Raw Output:"
    echo "$CAST_OUTPUT"
fi
