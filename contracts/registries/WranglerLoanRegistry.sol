pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/AddressUtils.sol";
import {LoanContractRegistry} from "./LoanContractRegistry.sol";
import {Loan} from "../loans/Loan.sol";


/**
 * @title WranglerLoanRegistry contract
 * @dev Creates, stores info about, and manages loans approved by the wrangler
 */
contract WranglerLoanRegistry is Ownable {
  using AddressUtils for address;
    
  // contract addresses
  address public LOAN_CONTRACT_REGISTRY_CONTRACT_ADDRESS;
  // nonce for offerCreator
  mapping (address => uint256) public nonces;
  mapping (address => bool) public loans;

  // constructor
  function WranglerLoanRegistry(address _loanContractRegistry) public {
//   constructor(address _loanContractRegistry) public {
    LOAN_CONTRACT_REGISTRY_CONTRACT_ADDRESS = _loanContractRegistry;
  }

  function create(
    address offerCreator,
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
  ) external returns (address) {
    require(_values[11] > block.timestamp);
    uint256 currentNonce = nonces[offerCreator];
    require(_values[10] == currentNonce + 1);
    nonces[offerCreator] = currentNonce + 1;
    bool success;
    address loanAddress;
    Loan loan;
    (success, loanAddress) = LoanContractRegistry(LOAN_CONTRACT_REGISTRY_CONTRACT_ADDRESS).releaseLastChild();
    loan = success ? Loan(loanAddress) : new Loan();
    loan.init(
      _addresses,
      _values,
      _contractAddresses,
      v,
      r,
      s
    );
    loans[address(loan)] = true;
    return address(loan);
  }

  /**
   * @dev transfer ownership of this contract to loanContractRegistry
   */
  function releaseContract(address loanAddress) external returns (bool) {
    require(loanAddress.isContract());
    Loan loan = Loan(loanAddress);
    require(loan.borrower() == msg.sender);
    require(loan.owner() == address(this));
    require(loan.clean());
    require(LoanContractRegistry(LOAN_CONTRACT_REGISTRY_CONTRACT_ADDRESS).addChild(address(loan)));
    loan.transferOwnership(LOAN_CONTRACT_REGISTRY_CONTRACT_ADDRESS);
    return true;
  }

//   TODO
//   function rollover() external onlyOwner returns (bool) {
//     return true;
//   }
}
