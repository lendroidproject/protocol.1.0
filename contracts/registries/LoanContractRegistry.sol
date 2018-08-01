pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/AddressUtils.sol";


/**
 * @title LoanContractRegistry contract
 * @dev Tends to Loan contracts that are orphaned and available to be filled
 */
contract LoanContractRegistry is Ownable {
  using AddressUtils for address;

  mapping (uint256 => address) public children;
  uint256 public lastChild = 0;

  function isChild(address _contractAddress) internal view returns (bool) {
    return Ownable(_contractAddress).owner() == address(this);
  }

  function addChild(address _contractAddress) external returns (bool) {
    require(_contractAddress.isContract());
    require(Ownable(_contractAddress).owner() == msg.sender);
    assert(!isChild(_contractAddress));
    lastChild ++;
    children[lastChild] = _contractAddress;
    return true;
  }

  function releaseChild() external returns (bool, address) {
    if (lastChild == 0) return (false, address(0));
    address _contractAddress = children[lastChild];
    require(_contractAddress.isContract());
    assert(isChild(_contractAddress));
    // Clean up the list
    delete children[lastChild];
    lastChild --;
    Ownable(_contractAddress).transferOwnership(msg.sender);
    return (true, _contractAddress);
  }


}
