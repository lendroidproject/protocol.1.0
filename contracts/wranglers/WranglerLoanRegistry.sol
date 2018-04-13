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
    // lender, borrower, relayer, wrangler,
    // collateralToken, loanToken,
    // wranglerLoanRegistryContractAddress
    uint[13] _values,
    // collateralAmount,
    // loanAmountOffered, interestRatePerDay, loanDuration, offerExpiryTimestamp,
    // relayerFeeLST, monitoringFeeLST, rolloverFeeLST, closureFeeLST,
    // creatorSalt,
    // wranglerNonce, wranglerApprovalExpiry, loanAmountFilled
    address[2] _contractAddresses,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external onlyOwner returns (bool) {
    require(_values[11] > block.timestamp);
    uint256 currentNonce = nonces[_addresses[1]];
    require(_values[10] == currentNonce + 1);
    nonces[_addresses[1]] = currentNonce + 1;
    address loanAddress = new Loan(
      _addresses,
      _values,
      _contractAddresses,
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
