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
        address loanToken;
        address collateralToken;
        uint loanAmountOffered;
        uint loanAmountToRepay;
        uint expiresAtTimestamp;
        uint collateralAmountOffered;
        uint relayerFeeLST;
        uint monitoringFeeLST;
        bytes32 offerHash;
    }

  // constructor
  function LoanOfferRegistry(address _token, address _tokenTransferProxy) public {
    TOKEN_CONTRACT_ADDRESS = _token;
    TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS = _tokenTransferProxy;
  }

  function fill(
    address[7] _addresses,
    // relayer, wranglerLoanRegistryContractAddress,
    // lender, borrower, wrangler, loanToken, collateralToken
    uint[13] _values,
    // collateralAmount, loanExpiresAtTimestamp,
    // loanAmountBorrowed, loanAmountOwed, collateralAmountOffered, offerExpiresAt,
    // relayerFeeLST, monitoringFeeLST,
    // lenderSalt,
    // rolloverFeeLST, closureFeeLST,
    // wranglerSalt, wranglerApprovalExpiry
    uint8[2] _vS,
    bytes32[2] _rS,
    bytes32[2] _sS,
    bool _isOfferCreatorLender
  ) external returns (bool) {
    // Get offer parameters from input
    address[5] memory _offerAddresses = [_addresses[2], _addresses[3], _addresses[0],
      _addresses[5], _addresses[6]
    ];
    uint256[7] memory _offerValues = [_values[2], _values[3], _values[4], _values[5],
      _values[6], _values[7], _values[8]
    ];
    // (re)create offer object
    Offer memory offer = Offer({
      lender: _offerAddresses[0],
      borrower: _offerAddresses[1],
      relayer: _offerAddresses[2],
      loanToken: _offerAddresses[3],
      collateralToken: _offerAddresses[4],
      loanAmountOffered: _offerValues[0],
      loanAmountToRepay: _offerValues[1],
      expiresAtTimestamp: _offerValues[2],
      collateralAmountOffered: _offerValues[3],
      relayerFeeLST: _offerValues[4],
      monitoringFeeLST: _offerValues[5],
      offerHash: computeOfferHash(_offerAddresses, _offerValues)
    });
    // validate loan and collateral amounts
    require(offer.loanAmountOffered > 0 && offer.loanAmountToRepay > 0 && offer.collateralAmountOffered > 0);
    // validate asked and offered expiry timestamps
    require(block.timestamp >= offer.expiresAtTimestamp && block.timestamp >= _values[1] && offer.expiresAtTimestamp >= _values[1]);
    // validate signature of offer creator
    address offerCreator = _isOfferCreatorLender ? offer.lender : offer.borrower;
    require(offerCreator == ecrecover(offer.offerHash, _vS[0], _rS[0], _sS[0]));
    // fill offer with collateral
    uint remainingCollateralAmount = offer.collateralAmountOffered.sub(getFilledOrCancelledCollateralAmount(offer.offerHash));
    require(remainingCollateralAmount >= _values[0]);
    filled[offer.offerHash] = filled[offer.offerHash].add(_values[0]);
    // Transfer input to wranglerLoanRegistryContractAddress
    require(_addresses[1].isContract());
    // Get offer parameters from input
    address[7] memory _loanAddresses = [_addresses[5], _addresses[6],
      TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS, TOKEN_CONTRACT_ADDRESS,
      _addresses[2], _addresses[3], _addresses[4]
    ];
    uint256[7] memory _loanValues = [_values[0], _values[2], _values[3], _values[5],
      _values[7], _values[9], _values[10]
    ];
    WranglerLoanRegistry(_addresses[1]).create(
      _loanAddresses,
      _loanValues,
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

  function computeOfferHash(address[5] _offerAddresses, uint[7] _offerValues)
    public
    constant
    returns (bytes32)
  {
    return keccak256(
      address(this),
      _offerAddresses[0], // lender
      _offerAddresses[1], // borrower
      _offerAddresses[2], // relayer
      _offerAddresses[3], // loanToken
      _offerAddresses[4], // collateralToken
      _offerValues[0],    // loanAmountOffered
      _offerValues[1],    // loanAmountToRepay
      // Interest rate per day
      _offerValues[2],    // expiresAtTimestamp
      _offerValues[3],    // collateralAmountOffered
      _offerValues[4],    // relayerFeeLST
      _offerValues[5],    // monitoringFeeLST
      _offerValues[6]    // salt
    );
  }

}
