#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${RPC_URL:-https://rpc.testnet.arc.network}"
EXECUTOR_PROXY="${EXECUTOR_PROXY:-0x6B184D87FdcD84C111a149289DCdAA40376EEB24}"
HAKU_TOKEN="${HAKU_TOKEN:-0x19c02CC2118Afe3CB59bb2f777d1a1124c7A6C12}"
EXPECTED_POOL_ID="${EXPECTED_POOL_ID:-0x12512a4efd2e73344522fd8f20520575d943f6127fde7a0b6c8d70f41cfe8f5c}"
USDC_AMOUNT="${USDC_AMOUNT:-25000}"
HAKU_AMOUNT="${HAKU_AMOUNT:-50000000}"
SLIPPAGE_BPS="${SLIPPAGE_BPS:-50}"
DEADLINE_SECONDS="${DEADLINE_SECONDS:-300}"
EXECUTE=false

normalize_address() {
    printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

if [[ "${1:-}" == "--execute" ]]; then
    EXECUTE=true
elif [[ -n "${1:-}" ]]; then
    echo "Usage: $0 [--execute]" >&2
    exit 1
fi

if (( SLIPPAGE_BPS < 0 || SLIPPAGE_BPS >= 10000 )); then
    echo "SLIPPAGE_BPS must be between 0 and 9999" >&2
    exit 1
fi
if (( DEADLINE_SECONDS <= 0 )); then
    echo "DEADLINE_SECONDS must be greater than 0" >&2
    exit 1
fi

if [[ -z "${PRIVATE_KEY:-}" ]]; then
    read -r -s -p "请输入 OWNER PRIVATE KEY（输入不会显示）: " PRIVATE_KEY
    echo
fi

OWNER="$(cast wallet address --private-key "$PRIVATE_KEY")"
AMOUNT0_MAX="$(cast to-wei "$USDC_AMOUNT" ether)"
AMOUNT1_MAX="$(cast to-wei "$HAKU_AMOUNT" ether)"
AMOUNT0_MIN="$(printf '%s * %s / 10000\n' "$AMOUNT0_MAX" "$((10000 - SLIPPAGE_BPS))" | bc)"
AMOUNT1_MIN="$(printf '%s * %s / 10000\n' "$AMOUNT1_MAX" "$((10000 - SLIPPAGE_BPS))" | bc)"

EXECUTOR_OWNER="$(cast call "$EXECUTOR_PROXY" 'owner()(address)' --rpc-url "$RPC_URL")"
EXECUTOR_POOL_MANAGER="$(cast call "$EXECUTOR_PROXY" 'poolManager()(address)' --rpc-url "$RPC_URL")"
EXECUTOR_TOKEN_A="$(cast call "$EXECUTOR_PROXY" 'tokenA()(address)' --rpc-url "$RPC_URL")"
EXECUTOR_TOKEN_B="$(cast call "$EXECUTOR_PROXY" 'tokenB()(address)' --rpc-url "$RPC_URL")"
HAKU_DECIMALS="$(cast call "$HAKU_TOKEN" 'decimals()(uint8)' --rpc-url "$RPC_URL")"
NATIVE_BALANCE="$(cast balance "$OWNER" --rpc-url "$RPC_URL")"
HAKU_BALANCE="$(cast call "$HAKU_TOKEN" 'balanceOf(address)(uint256)' "$OWNER" --rpc-url "$RPC_URL")"
ALLOWANCE="$(cast call "$HAKU_TOKEN" 'allowance(address,address)(uint256)' "$OWNER" "$EXECUTOR_PROXY" --rpc-url "$RPC_URL")"

if [[ "$(normalize_address "$EXECUTOR_OWNER")" != "$(normalize_address "$OWNER")" ]]; then
    echo "Executor owner mismatch: expected $OWNER, got $EXECUTOR_OWNER" >&2
    exit 1
fi
if [[ "$(normalize_address "$EXECUTOR_TOKEN_A")" != "0x0000000000000000000000000000000000000000" ]]; then
    echo "Executor tokenA is not native currency: $EXECUTOR_TOKEN_A" >&2
    exit 1
fi
if [[ "$(normalize_address "$EXECUTOR_TOKEN_B")" != "$(normalize_address "$HAKU_TOKEN")" ]]; then
    echo "Executor tokenB mismatch: expected $HAKU_TOKEN, got $EXECUTOR_TOKEN_B" >&2
    exit 1
fi
if [[ "$HAKU_DECIMALS" != "18" ]]; then
    echo "Haku decimals mismatch: expected 18, got $HAKU_DECIMALS" >&2
    exit 1
fi
if [[ "$(printf '%s < %s\n' "$NATIVE_BALANCE" "$AMOUNT0_MAX" | bc)" == "1" ]]; then
    echo "Insufficient native USDC: need $AMOUNT0_MAX wei, have $NATIVE_BALANCE wei" >&2
    exit 1
fi
if [[ "$(printf '%s < %s\n' "$HAKU_BALANCE" "$AMOUNT1_MAX" | bc)" == "1" ]]; then
    echo "Insufficient Haku: need $AMOUNT1_MAX wei, have $HAKU_BALANCE wei" >&2
    exit 1
fi

echo "RPC:              $RPC_URL"
echo "Owner:            $OWNER"
echo "Executor:         $EXECUTOR_PROXY"
echo "PoolManager:      $EXECUTOR_POOL_MANAGER"
echo "Expected PoolId:  $EXPECTED_POOL_ID"
echo "USDC max/min:     $AMOUNT0_MAX / $AMOUNT0_MIN wei"
echo "Haku max/min:     $AMOUNT1_MAX / $AMOUNT1_MIN wei"
echo "Deadline window:  $DEADLINE_SECONDS seconds"

if [[ "$EXECUTE" != true ]]; then
    echo
    echo "Dry run complete. No transaction was sent."
    if [[ "$(printf '%s < %s\n' "$ALLOWANCE" "$AMOUNT1_MAX" | bc)" == "1" ]]; then
        echo "Haku allowance is insufficient; --execute will approve the exact maximum first."
    fi
    echo "Run $0 --execute to simulate and broadcast."
    exit 0
fi

if [[ "$(printf '%s < %s\n' "$ALLOWANCE" "$AMOUNT1_MAX" | bc)" == "1" ]]; then
    echo "Approving exact Haku maximum..."
    cast send "$HAKU_TOKEN" \
        'approve(address,uint256)(bool)' \
        "$EXECUTOR_PROXY" \
        "$AMOUNT1_MAX" \
        --rpc-url "$RPC_URL" \
        --private-key "$PRIVATE_KEY"
fi

DEADLINE="$(( $(date +%s) + DEADLINE_SECONDS ))"
FUNCTION_SIGNATURE='addLiquidity(uint256,uint256,uint256,uint256,uint256)'

echo "Simulating addLiquidity..."
cast call "$EXECUTOR_PROXY" \
    "$FUNCTION_SIGNATURE" \
    "$AMOUNT0_MAX" \
    "$AMOUNT1_MAX" \
    "$AMOUNT0_MIN" \
    "$AMOUNT1_MIN" \
    "$DEADLINE" \
    --from "$OWNER" \
    --value "$AMOUNT0_MAX" \
    --rpc-url "$RPC_URL"

echo "Sending addLiquidity transaction once..."
cast send "$EXECUTOR_PROXY" \
    "$FUNCTION_SIGNATURE" \
    "$AMOUNT0_MAX" \
    "$AMOUNT1_MAX" \
    "$AMOUNT0_MIN" \
    "$AMOUNT1_MIN" \
    "$DEADLINE" \
    --value "$AMOUNT0_MAX" \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY"
