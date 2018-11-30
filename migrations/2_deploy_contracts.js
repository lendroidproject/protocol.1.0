const Registry = artifacts.require('Registry');
const TokenTransferProxy = artifacts.require('TokenTransferProxy');
const Token = artifacts.require('ERC20');
const Position = artifacts.require('Position');
const Lazarus = artifacts.require('Lazarus');
const Kernel = artifacts.require('Lazarus');


module.exports = function(deployer, network, accounts) {
  var registry;
  // deploy vyper contracts
  deployer.deploy(ERC20, "Lendroid Support Token", "LST", 18, 12000000000)
  .then(function(tokenContract) {
    console.log("Vyper Protocol token contract has been deployed");
    return deployer.deploy(Protocol, tokenContract.address)
  }).then(function(protocolContract) {
    console.log("Vyper Protocol contract has been deployed");
    // deploy Registry
    return deployer.deploy(Registry)
  })
  .then(function(registryInstance) {
    registry = registryInstance;
    console.log("Registry has been deployed");
    // deploy TokenTransferProxy
    return deployer.deploy(TokenTransferProxy)
  })
  .then(function(tokenTransferProxyInstance) {
    registry.setTokenTransferProxy(tokenTransferProxyInstance.address);
    console.log("TokenTransferProxy has been deployed and set in Registry");
    // deploy Token
    return deployer.deploy(Token)
  })
  .then(function(tokenInstance) {
    registry.setToken(tokenInstance.address);
    console.log("Token has been deployed and set in Registry");
    // deploy Position
    return deployer.deploy(Position)
  })
  .then(function(positionInstance) {
    registry.setPosition(positionInstance.address);
    console.log("Position has been deployed and set in Registry");
    // deploy Position
    return deployer.deploy(Lazarus)
  })
  .then(function(lazarusInstance) {
    registry.setLazarus(lazarusInstance.address);
    console.log("Lazarus has been deployed and set in Registry");
    // deploy Position
    return deployer.deploy(Kernel)
  })
  .then(function(kernelInstance) {
    registry.setKernel(kernelInstance.address);
    console.log("Kernel has been deployed and set in Registry");
    // display success message
    console.log("All contracts have been deployed and registered");
  });
};
