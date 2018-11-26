pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/utils/Address.sol";

import {Registry} from "./Registry.sol";
import {SimpleLoan} from "./SimpleLoan.sol";


/**
 * @title SimpleWrangler contract
 * @dev Creates, stores info about, and manages loans approved by the wrangler
 */
contract SimpleWrangler is Ownable {
  using Address for address;

  // contract addresses
  address public REGISTRY_CONTRACT_ADDRESS;
  // nonce for offerCreator
  mapping (address => uint256) public nonces;
  mapping (address => bool) public loans;

  // constructor
  constructor(address _registry) public {
    REGISTRY_CONTRACT_ADDRESS = _registry;
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
    address _registryContractAddress,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (address) {
    // confirm wrangler is owner of this contract
    require(_addresses[3] == owner());
    require(_values[11] > block.timestamp);
    uint256 currentNonce = nonces[offerCreator];
    require(_values[10] == currentNonce + 1);
    nonces[offerCreator] = currentNonce + 1;
    bool success;
    address loanAddress;
    SimpleLoan loan;
    (success, loanAddress) = Registry(REGISTRY_CONTRACT_ADDRESS).getLazarus().releaseChild();
    loan = success ? SimpleLoan(loanAddress) : new SimpleLoan();
    require(loan.init(_addresses, _values, _registryContractAddress));
    // validate wrangler signature
    bytes32 loanHash = loan.computeHash();
    require(ecrecover(loanHash, v, r, s) == owner());
    // save and return loan address
    loans[address(loan)] = true;
    return address(loan);
  }

  /**
   * @dev transfer ownership of given loanAddress to Lazarus
   */
  function releaseContract(address loanAddress) external returns (bool) {
    require(loanAddress.isContract());
    require(loans[loanAddress]);
    loans[loanAddress] = false;
    SimpleLoan loan = SimpleLoan(loanAddress);
    require(loan.borrower() == msg.sender);
    require(loan.owner() == address(this));
    require(loan.clean());
    require(Registry(REGISTRY_CONTRACT_ADDRESS).getLazarus().addChild(address(loan)));
    loan.transferOwnership(Registry(REGISTRY_CONTRACT_ADDRESS).LAZARUS_CONTRACT_ADDRESS());
    return true;
  }

//   TODO
//   function rollover() external onlyOwner returns (bool) {
//     return true;
//   }
}
