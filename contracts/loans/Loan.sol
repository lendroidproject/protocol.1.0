pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/AddressUtils.sol";
import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import {TokenTransferProxy} from "../TokenTransferProxy.sol";


/**
 * @title SimpleLoan contract
 * @dev the creator is always the SimpleWrangler contract
 */

contract Loan is Ownable {
  using SafeMath for uint256;
  using AddressUtils for address;

  // players
  address public lender;
  address public borrower;
  address public wrangler;
  // loan terms
  uint256 public createdAtTimestamp;
  uint256 public updatedAtTimestamp;
  uint256 public expiresAtTimestamp;
  address public collateralToken;
  address public loanToken;
  uint256 public collateralAmount;
  uint256 public loanAmountBorrowed; // Principal amount
  uint256 public loanAmountOwed; // Principal + interest (i.e., calculated beforehand)
  // loan nonce
  uint256 nonce;
  // fees
  uint256 public relayerFeeLST; // Set by Lender for Relayer
  uint256 public monitoringFeeLST; // Set by Lender for Wrangler
  uint256 public rolloverFeeLST; // Set by Borrower for Wrangler
  uint256 public closureFeeLST; // Set by Borrower for Borrower
  // contract addresses
  address public TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS;
  address public TOKEN_CONTRACT_ADDRESS;
  // invariants
  uint256 public DECIMALS = 10 ** 18;
  uint256 public SECONDS_PER_DAY = 86400;

  enum Status {
    OPEN,
    CLOSED,
    LIQUIDATING,
    LIQUIDATED,
    DEACTIVATED
  }
  Status public status;

  // events
  event LogLoanStatus(
    address indexed _wrangler,
    address indexed _loanAddress,
    bytes32 _description
  );

  // init
  function init(
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
    address[2] _contractAddresses
  ) external returns (bool)
//   ) external
  {
    // validate input
    require(msg.sender.isContract());
    // set players
    lender = _addresses[0];
    borrower = _addresses[1];
    wrangler = _addresses[3];
    // set nonce
    nonce = _values[10];
    // set terms
    collateralToken = _addresses[4];
    loanToken = _addresses[5];
    collateralAmount = _values[0];
    loanAmountBorrowed = _values[12];
    // validate _loanAmountBorrowed
    require(loanAmountBorrowed > 0);
    uint256 interestRatePerDay = _values[2].div(DECIMALS);
    uint256 loanDurationInDays = _values[3].div(SECONDS_PER_DAY);
    loanAmountOwed = loanAmountBorrowed.add(loanAmountBorrowed.mul(interestRatePerDay).mul(loanDurationInDays).div(100));
    // validate _loanAmountOwed
    require(loanAmountOwed >= loanAmountBorrowed);
    createdAtTimestamp = block.timestamp;
    expiresAtTimestamp = createdAtTimestamp.add(_values[3]);
    // validate createdAtTimestamp
    // require(createdAtTimestamp <= _values[4]);
    status = Status.OPEN;
    // fees
    monitoringFeeLST = _values[6];
    rolloverFeeLST = _values[7];
    closureFeeLST = _values[8];
    // set contract addresses
    require(_contractAddresses[0].isContract());
    require(_contractAddresses[1].isContract());
    TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS = _contractAddresses[0];
    TOKEN_CONTRACT_ADDRESS = _contractAddresses[1];
    // // transfer collateral token from borrower to this address
    require(
      TokenTransferProxy(TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS).transferFrom(
        collateralToken,
        borrower,
        address(this),
        collateralAmount
      )
    );
    // transfer loan token from lender to borrower
    require(
      TokenTransferProxy(TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS).transferFrom(
        loanToken,
        lender,
        borrower,
        loanAmountBorrowed
      )
    );
    // transfer monitoringFeeLST from lender to wrangler
    require(
      TokenTransferProxy(TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS).transferFrom(
        TOKEN_CONTRACT_ADDRESS,
        lender,
        wrangler,
        monitoringFeeLST
      )
    );
    emit LogLoanStatus(wrangler, address(this), "Loan created");
    // LogLoanStatus(wrangler, address(this), "Loan created");

    return true;
  }

  function computeHash()
    public
    view
    returns (bytes32)
  {
    return keccak256(
      abi.encodePacked(
        collateralToken,
        loanToken,
        collateralAmount,
        loanAmountBorrowed,
        loanAmountOwed,
        expiresAtTimestamp,
        lender,
        borrower,
        wrangler,
        monitoringFeeLST,
        rolloverFeeLST,
        closureFeeLST,
        nonce
      )
    );
  }

  function transferCollateralToken(address _collateralToken, address _to) internal returns (bool) {
    assert(
      ERC20(_collateralToken).transfer(
        _to,
        ERC20(_collateralToken).balanceOf(this)
      )
    );
    return true;
  }

  // methods
  function close(address _collateralToken) external returns (bool) {
    require(_collateralToken.isContract());
    require(block.timestamp < expiresAtTimestamp && msg.sender == borrower);
    assert(status == Status.OPEN);
    // transfer loan token from borrower to lender
    require(
      TokenTransferProxy(TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS).transferFrom(
        loanToken,
        borrower,
        lender,
        loanAmountOwed
      )
    );
    // transfer collateral token from this address to sender (aka, borrower)
    require(transferCollateralToken(_collateralToken, msg.sender));
    status = Status.CLOSED;
    emit LogLoanStatus(wrangler, address(this), "Loan closed");
    // LogLoanStatus(wrangler, address(this), "Loan closed");
    return true;
  }

  // TODO: implement liquidation initiation process by wrangler, finalize repayment in liquidate

  function liquidate(address _collateralToken) external returns (bool) {
    require(_collateralToken.isContract());
    if (block.timestamp > expiresAtTimestamp) require(msg.sender == wrangler || msg.sender == lender);
    else require(msg.sender == wrangler);
    assert(status == Status.OPEN);
    // transfer collateral token from this address to sender (aka, wrangler or lender)
    require(transferCollateralToken(_collateralToken, msg.sender));
    status = Status.LIQUIDATED;
    emit LogLoanStatus(wrangler, address(this), "Loan closed");
    // LogLoanStatus(wrangler, address(this), "Loan liquidated");
    return true;
  }

  function topUp(address _collateralToken, uint256 _amount) external returns (bool) {
    require(_collateralToken.isContract());
    require(block.timestamp < expiresAtTimestamp && msg.sender == borrower);
    assert(status == Status.OPEN);
    // increment borrowed amount
    collateralAmount = collateralAmount.add(_amount);
    // transfer collateral token from sender (aka, borrower) to this address
    require(
      TokenTransferProxy(TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS).transferFrom(
        _collateralToken,
        msg.sender,
        address(this),
        _amount
      )
    );
    emit LogLoanStatus(wrangler, address(this), "Collateral topped up");
    // LogLoanStatus(wrangler, address(this), "Collateral topped up");
    return true;
  }

  function clean() external onlyOwner returns (bool) {
    // validate requirement to clean this contract
    assert(status == Status.CLOSED || status == Status.LIQUIDATED);
    // set players
    lender = address(0);
    borrower = address(0);
    wrangler = address(0);
    // set nonce
    nonce = 0;
    // set terms
    collateralToken = address(0);
    loanToken = address(0);
    collateralAmount = 0;
    loanAmountBorrowed = 0;
    // validate _loanAmountBorrowed
    loanAmountOwed = 0;
    // validate _loanAmountOwed
    expiresAtTimestamp = 0;
    // validate _expiresAtTimestamp
    createdAtTimestamp = 0;
    status = Status.DEACTIVATED;
    // fees
    monitoringFeeLST = 0;
    rolloverFeeLST = 0;
    closureFeeLST = 0;
    emit LogLoanStatus(wrangler, address(this), "Loan Contract cleaned");
    // LogLoanStatus(wrangler, address(this), "Loan Contract cleaned");
    return true;
  }

  /**
   * @dev override parent function
   */
  function renounceOwnership() public onlyOwner {
    revert();
  }

}
