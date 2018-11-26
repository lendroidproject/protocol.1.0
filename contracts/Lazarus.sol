pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/utils/Address.sol";


/**
  * @title Lazarus contract
  * @dev Saves Loan contracts for reuse, once they have been closed.
  * This technique helps to recylce used contracts so they do not stagnate the Ethereum blockchain forever.
*/
contract Lazarus is Ownable {
  using Address for address;

  mapping (uint256 => address) public children;
  uint256 public lastChild = 0;

  /**
    * @dev Add a contract as a child. It's important that the sender is the onwer of the contract.
    * After calling this function, the sender should transfer the ownership of the child to Lazarus
    * @param _contractAddress : The address of the chiold contract
  */
  function addChild(address _contractAddress) external returns (bool) {
    require(_contractAddress.isContract());
    require(Ownable(_contractAddress).owner() == msg.sender);
    lastChild ++;
    children[lastChild] = _contractAddress;
    return true;
  }

  /**
    * @dev Remove the last child if it's owner is not Lazarus.
    * Returns true if last child was indeed cleaned. It's advised to repeat this call until we get "false"
  */
  function cleanLastChild() external returns (bool) {
    if (lastChild == 0) return false;
    address _contractAddress = children[lastChild];
    if (Ownable(_contractAddress).owner() != address(this)){
      delete children[lastChild];
      lastChild --;
      return true;
    }
    return false;
  }

  /**
    * @dev Release the last child and transfer it's ownership to the caller.
    * Returns an array of [true, child address] is successful
  */
  function releaseChild() external returns (bool, address) {
    if (lastChild == 0) return (false, address(0));
    address _contractAddress = children[lastChild];
    require(_contractAddress.isContract());
    if (Ownable(_contractAddress).owner() != address(this)) return (false, address(0));
    // Clean up the list
    delete children[lastChild];
    lastChild --;
    Ownable(_contractAddress).transferOwnership(msg.sender);
    return (true, _contractAddress);
  }

}
