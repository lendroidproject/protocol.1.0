pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import {Loan} from "../loans/Loan.sol";


/**
 * @title WranglerLoanRegistry contract
 * @dev Creates, stores info about, and manages loans approved by the wrangler
 */
contract WranglerLoanRegistry is Ownable {
  // nonce for borrower
  mapping (address => uint256) public nonces;
  mapping (address => bool) public loans;

  function create(
    address[7] _addresses,
    // _loanToken, _collateralToken,
    // _tokenTransferProxyContractAddress, _tokenContractAddress,
    // _lender, _borrower, _wrangler
    uint256[7] _values,
    // _collateralAmount, _loanAmountBorrowed, _loanAmountOwed, _expiresAtTimestamp,
    // _monitoringFeeLST, _rollOverFeeLST, _closureFeeLST,
    // nonce, wranglerApprovalExpiry
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external onlyOwner returns (bool) {
    /* require(_values[8] > block.timestamp); */
    /* uint256 currentNonce = nonces[_addresses[5]];
    require(_values[7] == currentNonce + 1);
    nonces[_addresses[5]] = currentNonce + 1; */
    address loanAddress = new Loan(
      _addresses,
      _values,
      v,
      r,
      s
    );
    loans[loanAddress] = true;
    return true;
  }

//   TODO
//   function rollover() external onlyOwner returns (bool) {
//     return true;
//   }
}
