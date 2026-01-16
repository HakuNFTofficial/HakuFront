// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {
    IPositionDescriptor
} from "v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {
    IPositionManager
} from "v4-periphery/src/interfaces/IPositionManager.sol";

contract MyPositionDescriptor is IPositionDescriptor {
    IPoolManager private immutable POOL_MANAGER;

    constructor(address poolManager_) {
        POOL_MANAGER = IPoolManager(poolManager_);
    }

    /// @notice Return token metadata URI
    /// Simple implementation for local testing — returns a static JSON URI.
    function tokenURI(
        IPositionManager /*positionManager*/,
        uint256 /*tokenId*/
    ) external pure override returns (string memory) {
        return "https://example.com/default.json";
    }

    function flipRatio(
        address /*currency0*/,
        address /*currency1*/
    ) external pure override returns (bool) {
        return true;
    }

    function currencyRatioPriority(
        address /*currency*/
    ) external pure override returns (int256) {
        return 0;
    }

    function wrappedNative() external pure override returns (address) {
        return address(0);
    }

    function nativeCurrencyLabel()
        external
        pure
        override
        returns (string memory)
    {
        return "ETH";
    }

    function poolManager() external view override returns (IPoolManager) {
        return POOL_MANAGER;
    }
}
