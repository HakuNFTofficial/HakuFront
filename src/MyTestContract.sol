// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {
    IUnlockCallback
} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {
    IPositionManager
} from "v4-periphery/src/interfaces/IPositionManager.sol";

contract MyTestContract is IUnlockCallback {
    IPoolManager public poolManager;
    IPositionManager public positionManager;

    constructor(address _poolManager, address _positionManager) {
        poolManager = IPoolManager(_poolManager);
        positionManager = IPositionManager(_positionManager);
    }

    // 调用这个函数发起 unlock
    function doModifyLiquidity(
        bytes calldata unlockData
    ) external returns (bytes memory) {
        // unlockData 是你自己构造的数据，会在 unlockCallback 被调用时传回
        return poolManager.unlock(unlockData);
    }

    // unlock 成功后，core 会调用这个 callback
    function unlockCallback(
        bytes calldata data
    ) external override returns (bytes memory) {
        // 你可以在这里做 swap 或 modifyLiquidity
        // 举例：在回调里调用 PositionManager 的 modifyLiquidities
        // 假设 data 是通过 ABI 编码过来的 modifyLiquidities 参数
        // 当然，这里只是示例，真正调用时 data 的结构取决于你的 encode 逻辑

        // 直接调用 periphery 批量命令
        // 注意：deadline 是一个示例值
        uint256 deadline = block.timestamp + 300;
        positionManager.modifyLiquidities(data, deadline);

        // 返回空 bytes（或者你需要返回什么就返回什么）
        return "";
    }
}
