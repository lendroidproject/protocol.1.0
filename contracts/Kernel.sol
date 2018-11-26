pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/utils/Address.sol";

import {Registry} from "./Registry.sol";
import {SimpleWrangler} from "./SimpleWrangler.sol";


/**
 * @title Kernel contract
 * @dev Fills or cancels loan kernels. SimpleWrangler then creates Loans approved by the wrangler script
 */
contract Kernel is Ownable {
  using SafeMath for uint256;
  using Address for address;
  // contract addresses
  address public REGISTRY_CONTRACT_ADDRESS;
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
  constructor(address _registry) public {
    REGISTRY_CONTRACT_ADDRESS = _registry;
  }

  /**
    * @dev fill a loan kernel. A kernel can be created only by a lender or a borrower.
    * If created by a lender, it's a lend order, otherwise a borrow order.
    * @param _addresses An array of 7 addresses approved by the wrangler
    * @param _values An array of 13 uint values approved by the wrangler
    * @param _vS Array of two uint8 values; one "v" from creator's signature and another from wrangler's
    * @param _rS Array of two bytes32 values; one "r" from creator's signature and another from wrangler's
    * @param _sS Array of two bytes32 values; one "s" from creator's signature and another from wrangler's
    * @param _isOfferCreatorLender boolean set by the wrangler
  */
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
    // (re)create kernel object
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
      offerHash: computeOfferHashFromFillInputs(_addresses, _values, _isOfferCreatorLender)
    });
    // validate _lender is not empty
    require(offer.lender != address(0));
    // validate _borrower is not empty
    require(offer.borrower != address(0));
    // It's OK if _relayer is empty
    // validate _wrangler is not empty
    require(offer.wrangler != address(0));
    // validate _collateralToken is a contract address
    require(_addresses[4].isContract());
    // validate _loanToken is a contract address
    require(_addresses[5].isContract());
    // validate loan amounts
    require(offer.loanAmountOffered > 0 && offer.interestRatePerDay > 0);
    // validate asked and offered expiry timestamps
    require(offer.offerExpiryTimestamp >= block.timestamp);
    // validate signature of offer creator
    address offerCreator = _isOfferCreatorLender ? offer.lender : offer.borrower;
    require(offerCreator == ecrecover(offer.offerHash, _vS[0], _rS[0], _sS[0]));
    // validate laon amount to be filled
    uint filledOrCancelledLoanAmount = getFilledOrCancelledLoanAmount(offer.offerHash);
    require(offer.loanAmountOffered.sub(filledOrCancelledLoanAmount) >= _values[12]);
    // fill offer with lending currency
    filled[offer.offerHash] = filled[offer.offerHash].add(_values[12]);
    // Transfer input to wranglerLoanRegistryContractAddress
    require(_addresses[6].isContract());
    // Create loan via SimpleWrangler
    address loanAddress = SimpleWrangler(_addresses[6]).create(
      offerCreator,
      _addresses,
      _values,
      REGISTRY_CONTRACT_ADDRESS,
      _vS[1],
      _rS[1],
      _sS[1]
    );
    require(Registry(REGISTRY_CONTRACT_ADDRESS).getPosition().recordLoan(
      offer.lender, offer.borrower, loanAddress
    ));
    // transfer relayerFeeLST from lender to relayer
    if (offer.relayer != address(0)) {
      require(
        Registry(REGISTRY_CONTRACT_ADDRESS).getTokenTransferProxy()
          .transferFrom(
          Registry(REGISTRY_CONTRACT_ADDRESS).TOKEN_CONTRACT_ADDRESS(),
          offer.lender,
          offer.relayer,
          offer.relayerFeeLST
        )
      );
    }

    return true;
  }

  /**
    * @dev cancel a partially-filled or unfilled loan kernel.
    * @param _addresses An array of 6 addresses used in the kernel object
    * @param _values An array of 9 uint values used in the kernel object
    * @param _v from creator's signature
    * @param _r from creator's signature
    * @param _s from creator's signature
    * @param cancelledLoanTokenAmount amount of loan currency to cancel
  */
  function cancel(
    address[6] _addresses,
    uint[9] _values,
    uint8 _v,
    bytes32 _r,
    bytes32 _s,
    uint cancelledLoanTokenAmount)
    public
    returns (bool)
  {
    // (re)create offer object
    Offer memory offer = Offer({
      lender: _addresses[0],
      borrower: _addresses[1],
      relayer: _addresses[2],
      wrangler: _addresses[3],
      collateralToken: _addresses[4],
      loanToken: _addresses[5],
      loanAmountOffered: _values[0],
      interestRatePerDay: _values[1],
      loanDuration: _values[2],
      offerExpiryTimestamp: _values[3],
      relayerFeeLST: _values[4],
      monitoringFeeLST: _values[5],
      rolloverFeeLST: _values[6],
      closureFeeLST: _values[7],
      offerHash: computeOfferHash(_addresses, _values)
    });
    // verify sender is order creator
    require(ecrecover(offer.offerHash, _v, _r, _s) == msg.sender);
    // verify sanity of offered and cancellation amounts
    require(offer.loanAmountOffered > 0 && cancelledLoanTokenAmount > 0);
    uint filledOrCancelledLoanAmount = getFilledOrCancelledLoanAmount(offer.offerHash);
    // verify cancellation amount does not exceed remaining laon amount to be filled
    require(offer.loanAmountOffered.sub(filledOrCancelledLoanAmount) >= cancelledLoanTokenAmount);

    cancelled[offer.offerHash] = cancelled[offer.offerHash].add(cancelledLoanTokenAmount);

    return true;
  }

  function getFilledOrCancelledLoanAmount(bytes32 offerHash)
    public
    constant
    returns (uint)
  {
    return filled[offerHash].add(cancelled[offerHash]);
  }

  /**
    * @dev compute the kernel hash from inputs sent to fill()
    * This function is necessary to respect the variable limit on the EVM stack
    * Called only by this contract
    * @param _addresses An array of 7 addresses approved by the wrangler
    * @param _values An array of 13 uint values approved by the wrangler
    * @param _isOfferCreatorLender boolean set by the wrangler
  */
  function computeOfferHashFromFillInputs(
    address[7] _addresses, uint[13] _values, bool _isOfferCreatorLender
  )
    internal
    constant
    returns (bytes32)
  {
    address[6] memory offerAddresses = [
      _isOfferCreatorLender ? _addresses[0] : address(0), // lender
      _isOfferCreatorLender ? address(0) : _addresses[1], // borrower
      _addresses[2], // relayer
      _addresses[3], // wrangler
      _addresses[4], // collateralToken
      _addresses[5]  // loanToken
    ];
    uint[9] memory offerValues = [
      _values[1],    // loanAmountOffered
      _values[2],    // interestRatePerDay
      _values[3],    // loanDuration
      _values[4],    // offerExpiryTimestamp
      _values[5],    // relayerFeeLST
      _values[6],    // monitoringFeeLST
      _values[7],    // rolloverFeeLST
      _values[8],    // closureFeeLST
      _values[9]     // creatorSalt
    ];
    return computeOfferHash(offerAddresses, offerValues);
  }

  /**
    * @dev compute the kernel hash from properties that make up the kernel object.
    * Called from both UI client and this contract
    * @param _addresses An array of 6 addresses used in the kernel object
    * @param _values An array of 9 uint values used in the kernel object
  */
  function computeOfferHash(address[6] _addresses, uint[9] _values)
    public
    constant
    returns (bytes32)
  {
    return keccak256(
      abi.encodePacked(
        address(this),
        _addresses[0], // lender
        _addresses[1], // borrower
        _addresses[2], // relayer
        _addresses[3], // wrangler
        _addresses[4], // collateralToken
        _addresses[5], // loanToken
        _values[0],    // loanAmountOffered
        _values[1],    // offerExpiryTimestamp
        _values[2],    // relayerFeeLST
        _values[3],    // monitoringFeeLST
        _values[4],    // rolloverFeeLST
        _values[5],    // closureFeeLST
        _values[6]     // creatorSalt
      )
    );
  }

}
