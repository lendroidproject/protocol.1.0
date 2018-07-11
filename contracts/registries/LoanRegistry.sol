pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title LoanRegistry contract
 * @dev Maintains a list of all loans lent or borrowed per address
 */
contract LoanRegistry is Ownable {
  mapping (address => address[]) public borrowedLoans;
  mapping (address => address[]) public lentLoans;

  function recordLoan(address _lender, address _borrower, address loanAddress) external returns (bool) {
    lentLoans[_lender].push(loanAddress);
    borrowedLoans[_borrower].push(loanAddress);
  }

  function getLoanCount(bytes32 _type) external view returns (uint256) {
    if (_type == "lender") return lentLoans[msg.sender].length;
    if (_type == "borrower") return borrowedLoans[msg.sender].length;
    return 0;
  }
}
