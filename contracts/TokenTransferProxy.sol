/*

  Copyright 2018 Lendroid Foundation

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/

/*
  Original work has been inspired from ZeroEx Intl.
  Several parts of the original work have been modified to fit the specifications of the Lendroid Foundation
*/

pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { ERC20 as Token } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


/// @title TokenTransferProxy - Inspired from 0xProject. Transfers tokens on behalf of contracts.
/// @dev Handles only the ERC20 transferFrom function.
contract TokenTransferProxy is Ownable {

    /// @dev Calls into ERC20 Token contract, invoking transferFrom.
    /// @param token Address of token to transfer.
    /// @param from Address to transfer token from.
    /// @param to Address to transfer token to.
    /// @param value Amount of token to transfer.
    /// @return Success of transfer.
    function transferFrom(
        address token,
        address from,
        address to,
        uint value)
        public
        returns (bool)
    {
        return Token(token).transferFrom(from, to, value);
    }
}
