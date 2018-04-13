pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/AddressUtils.sol";
import {TokenTransferProxy} from "./TokenTransferProxy.sol";
import {WranglerLoanRegistry} from "./wranglers/WranglerLoanRegistry.sol";


/**
 * @title LoanOfferRegistry contract
 * @dev Fills or cancels loan offers created by lender. WranglerLoanRegistry then creates Loans approved by the wrangler
 */
contract LoanOfferRegistry is Ownable {
  using SafeMath for uint256;
  using AddressUtils for address;
  // contract addresses
  address public TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS;
  address public TOKEN_CONTRACT_ADDRESS;
  // Mappings of offerHash => amounts of collateralTokenAmount filled or cancelled.
  mapping (bytes32 => uint) public filled;
  mapping (bytes32 => uint) public cancelled;

  struct Offer {
        address lender;
        address borrower;
        address relayer;
        address wrangler;
        address collateralToken;
        address loanToken;
        uint256 loanAmountOffered;
        uint256 interestRatePerDay;
        uint256 loanDuration;
        uint256 offerExpiryTimestamp;
        uint256 relayerFeeLST;
        uint256 monitoringFeeLST;
        uint256 rolloverFeeLST;
        uint256 closureFeeLST;
        bytes32 offerHash;
    }

  // constructor
  function LoanOfferRegistry(address _token, address _tokenTransferProxy) public {
    TOKEN_CONTRACT_ADDRESS = _token;
    TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS = _tokenTransferProxy;
  }

  function fill(
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
    uint8[2] _vS,
    bytes32[2] _rS,
    bytes32[2] _sS,
    bool _isOfferCreatorLender
  ) external returns (bool) {
    // (re)create offer object
    Offer memory offer = Offer({
      lender: _addresses[0],
      borrower: _addresses[1],
      relayer: _addresses[2],
      wrangler: _addresses[3],
      collateralToken: _addresses[4],
      loanToken: _addresses[5],
      loanAmountOffered: _values[1],
      interestRatePerDay: _values[2],
      loanDuration: _values[3],
      offerExpiryTimestamp: _values[4],
      relayerFeeLST: _values[5],
      monitoringFeeLST: _values[6],
      rolloverFeeLST: _values[7],
      closureFeeLST: _values[8],
      offerHash: computeOfferHash(_addresses, _values)
    });
    // validate _lender is not empty
    require(offer.lender != address(0));
    // validate _borrower is not empty
    require(offer.borrower != address(1));
    // validate _relayer is not empty
    require(offer.relayer != address(2));
    // validate _wrangler is not empty
    require(offer.wrangler != address(3));
    // validate _collateralToken is a contract address
    require(_addresses[4].isContract());
    // validate _loanToken is a contract address
    require(_addresses[5].isContract());
    // validate loan amounts
    require(offer.loanAmountOffered > 0 && offer.interestRatePerDay > 0);
    // validate asked and offered expiry timestamps
    require(block.timestamp >= offer.offerExpiryTimestamp);
    // validate signature of offer creator
    address offerCreator = _isOfferCreatorLender ? offer.lender : offer.borrower;
    require(offerCreator == ecrecover(offer.offerHash, _vS[0], _rS[0], _sS[0]));
    // fill offer with collateral
    uint remainingCollateralAmount = _values[0].sub(getFilledOrCancelledCollateralAmount(offer.offerHash));
    require(remainingCollateralAmount >= _values[0]);
    filled[offer.offerHash] = filled[offer.offerHash].add(_values[0]);
    // Transfer input to wranglerLoanRegistryContractAddress
    require(_addresses[1].isContract());
    // Create loan via WranglerLoanRegistry
    address[2] memory _contractAddresses = [
      TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS,
      TOKEN_CONTRACT_ADDRESS
    ];
    WranglerLoanRegistry(_addresses[6]).create(
      _addresses,
      _values,
      _contractAddresses,
      _vS[1],
      _rS[1],
      _sS[1]
    );
    // transfer relayerFeeLST from lender to relayer
    require(TokenTransferProxy(TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS).transferFrom(
      TOKEN_CONTRACT_ADDRESS,
      offer.lender,
      offer.relayer,
      offer.relayerFeeLST
    ));

    return true;
  }

//   TODO
//   function cancel() external returns (bool) {
//     return true;
//   }

  function getFilledOrCancelledCollateralAmount(bytes32 offerHash)
    public
    constant
    returns (uint)
  {
    return filled[offerHash].add(cancelled[offerHash]);
  }

  function computeOfferHash(address[7] _addresses, uint[13] _values)
    public
    constant
    returns (bytes32)
  {
    return keccak256(
      address(this),
      _addresses[0], // lender
      _addresses[1], // borrower
      _addresses[2], // relayer
      _addresses[3], // wrangler
      _addresses[4], // collateralToken
      _addresses[5], // loanToken
      _values[1],    // loanAmountOffered
    //   _values[2],    // interestRatePerDay
    //   _values[3],    // loanDuration
      _values[4],    // offerExpiryTimestamp
      _values[5],    // relayerFeeLST
      _values[6],    // monitoringFeeLST
      _values[7],    // rolloverFeeLST
      _values[8],    // closureFeeLST
      _values[9]     // creatorSalt
    );
  }

}
