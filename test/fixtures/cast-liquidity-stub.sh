#!/usr/bin/env bash
set -euo pipefail

case "$1" in
    wallet)
        echo "0xD693a84A55fd1CbA3e1B5d82571b4Cfe1aF14510"
        ;;
    to-wei)
        case "$2" in
            25000) echo "25000000000000000000000" ;;
            50000000) echo "50000000000000000000000000" ;;
            *) exit 1 ;;
        esac
        ;;
    call)
        case "$3" in
            "owner()(address)") echo "0xD693a84A55fd1CbA3e1B5d82571b4Cfe1aF14510" ;;
            "poolManager()(address)") echo "0x447032aAa569105437516dA21792862Bf05422C6" ;;
            "tokenA()(address)") echo "0x0000000000000000000000000000000000000000" ;;
            "tokenB()(address)") echo "0x19c02CC2118Afe3CB59bb2f777d1a1124c7A6C12" ;;
            "decimals()(uint8)") echo "18" ;;
            "balanceOf(address)(uint256)") echo "100000000000000000000000000" ;;
            "allowance(address,address)(uint256)") echo "100000000000000000000000000" ;;
            *) exit 1 ;;
        esac
        ;;
    balance)
        echo "100000000000000000000000000"
        ;;
    *)
        exit 1
        ;;
esac
