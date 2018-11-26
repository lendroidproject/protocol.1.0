pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/utils/Address.sol";

import {TokenTransferProxy} from "./TokenTransferProxy.sol";
import {Kernel} from "./Kernel.sol";
import {Position} from "./Position.sol";
import {Lazarus} from "./Lazarus.sol";


/**
 * @title Registry contract
 * @dev A directory that stores and retrieves addresses of the lower-level protocol contracts
 */
contract Registry is Ownable {
  using Address for address;

  // contract addresses
  address public TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS;
  address public TOKEN_CONTRACT_ADDRESS;
  address public POSITION_CONTRACT_ADDRESS;
  address public KERNEL_CONTRACT_ADDRESS;
  address public LAZARUS_CONTRACT_ADDRESS;

  /**
   * @dev Set the address of TokenTransferProxy contract
   * @param _address The address of the new contract.
   */
  function setTokenTransferProxy(address _address) external onlyOwner {
    require(_address.isContract());
    TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS = _address;
  }

  /**
   * @dev Get the TokenTransferProxy contract
   */
  function getTokenTransferProxy() external view returns (TokenTransferProxy) {
    return TokenTransferProxy(TOKEN_TRANSFER_PROXY_CONTRACT_ADDRESS);
  }

  /**
   * @dev Set the address of Token contract
   * @param _address The address of the new contract.
   */
  function setToken(address _address) external onlyOwner {
    require(_address.isContract());
    TOKEN_CONTRACT_ADDRESS = _address;
  }

  /**
   * @dev Set the address of Position contract
   * @param _address The address of the new contract.
   */
  function setPosition(address _address) external onlyOwner {
    require(_address.isContract());
    POSITION_CONTRACT_ADDRESS = _address;
  }
  /**
   * @dev Get the Position contract
   */
  function getPosition() external view returns (Position) {
    return Position(POSITION_CONTRACT_ADDRESS);
  }

  /**
   * @dev Set the address of Kernel contract
   * @param _address The address of the new contract.
   */
  function setKernel(address _address) external onlyOwner {
    require(_address.isContract());
    KERNEL_CONTRACT_ADDRESS = _address;
  }
  /**
   * @dev Get the Kernel contract
   */
  function getKernel() external view returns (Kernel) {
    return Kernel(KERNEL_CONTRACT_ADDRESS);
  }

  /**
   * @dev Set the address of Lazarus contract
   * @param _address The address of the new contract.
   */
  function setLazarus(address _address) external onlyOwner {
    require(_address.isContract());
    LAZARUS_CONTRACT_ADDRESS = _address;
  }
  /**
   * @dev Get the Lazarus contract
   */
  function getLazarus() external view returns (Lazarus) {
    return Lazarus(LAZARUS_CONTRACT_ADDRESS);
  }

}
