// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "lib/v4-core/src/interfaces/IPoolManager.sol";
import {IWETH9} from "lib/v4-periphery/src/interfaces/external/IWETH9.sol";

contract MinimalV4Router {
    IPoolManager public immutable poolManager;
    IWETH9 public immutable weth;
    address public immutable permit2;

    constructor(IPoolManager _poolManager, IWETH9 _weth, address _permit2) {
        poolManager = _poolManager;
        weth = _weth;
        permit2 = _permit2;
    }

    // 示例：wrap native token to WETH
    function wrap() external payable {
        weth.deposit{value: msg.value}();
        require(weth.transfer(msg.sender, msg.value), "WETH transfer failed");
    }

    // 示例：unwrap
    function unwrap(uint256 amount) external {
        require(
            weth.transferFrom(msg.sender, address(this), amount),
            "WETH transferFrom failed"
        );
        weth.withdraw(amount);
        payable(msg.sender).transfer(amount);
    }
}
