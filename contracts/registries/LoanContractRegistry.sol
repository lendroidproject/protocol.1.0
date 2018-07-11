pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/AddressUtils.sol";
import {Loan} from "../loans/Loan.sol";


/**
 * @title LoanContractRegistry contract
 * @dev Tends to Loan contracts that are orphaned and available to be filled
 */
contract LoanContractRegistry is Ownable {
  using AddressUtils for address;

  mapping (address => address) public currentOwner;
  mapping (address => uint256) public indices;

  address[] public children;

  function isChild(address _contractAddress) internal view returns (bool) {
    return (children.length > 0 && children[indices[_contractAddress]] == _contractAddress && currentOwner[_contractAddress] == address(this));
  }

  function addChild(address _contractAddress) external returns (bool) {
    require(_contractAddress.isContract());
    Loan childContract = Loan(_contractAddress);
    require(childContract.owner() == msg.sender);
    assert(!isChild(_contractAddress));
    currentOwner[_contractAddress] = address(this);
    indices[_contractAddress] = children.length;
    children.push(_contractAddress);
    return true;
  }

  function transferChild(address _contractAddress, address _newOwner) internal returns (address) {
    require(_contractAddress.isContract());
    assert(isChild(_contractAddress));
    address lastContract = children[children.length - 1];
    // Clean up the list
    children[indices[_contractAddress]] = lastContract;
    children.length --;
    // Clean up the index-mapping
    if (lastContract == _contractAddress) delete indices[lastContract];
    else indices[lastContract] = indices[_contractAddress];
    currentOwner[_contractAddress] = _newOwner;
    Loan(_contractAddress).transferOwnership(_newOwner);
    return _contractAddress;
  }

  function releaseLastChild() external returns (bool, address) {
    if (children.length == 0) return (false, address(0));
    address child = children[children.length - 1];
    address lastChildAddress = transferChild(child, msg.sender);
    return (true, lastChildAddress);
  }

  function childrenCount() external view returns(uint256) {
    return children.length;
  }

}
