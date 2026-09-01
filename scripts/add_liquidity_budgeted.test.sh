#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_BIN="$(mktemp -d)"
trap 'rm -rf "$TEMP_BIN"' EXIT

ln -s "$REPO_ROOT/test/fixtures/cast-liquidity-stub.sh" "$TEMP_BIN/cast"

if ! OUTPUT="$(
    PATH="$TEMP_BIN:$PATH" \
        PRIVATE_KEY="test-private-key" \
        /bin/bash "$REPO_ROOT/scripts/add_liquidity_budgeted.sh" 2>&1
)"; then
    echo "$OUTPUT" >&2
    exit 1
fi

case "$OUTPUT" in
    *"Dry run complete. No transaction was sent."*) ;;
    *)
        echo "Expected the macOS Bash dry run to complete" >&2
        echo "$OUTPUT" >&2
        exit 1
        ;;
esac

echo "macOS Bash dry run passed"
