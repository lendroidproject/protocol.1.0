pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title LoanRegistry contract
 * @dev Maintains a list of all loans lent or borrowed per address
 */
contract LoanRegistry is Ownable {
  mapping (address => address[]) public borrowedLoans;
  mapping (address => address[]) public lentLoans;

  event RecordLoan(
    address lender,
    address borrower,
    address loanAddress,
    bool success
  );

  function recordLoan(address _lender, address _borrower, address loanAddress) external returns (bool) {
    lentLoans[_lender].push(loanAddress);
    borrowedLoans[_borrower].push(loanAddress);

    emit RecordLoan(_lender, _borrower, loanAddress, true);

    return true;
  }

  function getLoanCounts(address _address) external view returns (uint256, uint256) {
    return (lentLoans[_address].length, borrowedLoans[_address].length);
  }
}
