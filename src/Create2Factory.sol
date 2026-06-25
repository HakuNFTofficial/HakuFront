// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract Create2Factory {
    event Deployed(address addr, uint256 salt);

    function deploy(
        uint256 salt,
        bytes memory creationCode
    ) external payable returns (address addr) {
        assembly {
            addr := create2(
                callvalue(),
                add(creationCode, 0x20),
                mload(creationCode),
                salt
            )
        }
        require(addr != address(0), "Create2Factory: Failed on deploy");
        emit Deployed(addr, salt);
    }
}
