pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title Position contract
 * @dev Maintains a list of all lend and borrow positions per address
 */
contract Position is Ownable {
  mapping (address => address[]) public borrowedLoans;
  mapping (address => address[]) public lentLoans;

  /**
    * @dev record a position. Lend position in created for lender, and Borrow position for borrower
    * @param _lender : Lender's address
    * @param _borrower : Borrower's address
    * @param loanAddress : Address of the Loan contract from which the positions are created
  */
  function recordLoan(address _lender, address _borrower, address loanAddress) external returns (bool) {
    lentLoans[_lender].push(loanAddress);
    borrowedLoans[_borrower].push(loanAddress);
    return true;
  }

  /**
    * @dev returns the number of lend and borrow positions for a given address
    * @param _address : address of the lender / borrower
  */
  function getLoanCounts(address _address) external view returns (uint256, uint256) {
    return (lentLoans[_address].length, borrowedLoans[_address].length);
  }
}
