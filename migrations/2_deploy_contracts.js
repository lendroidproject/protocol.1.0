// import vyper artifacts
const ERC20 = artifacts.require('ERC20.vyper');
const Protocol = artifacts.require('protocol.vyper');

module.exports = function(deployer, network, accounts) {
  var registry;
  // deploy vyper contracts
  deployer.deploy(ERC20, "Lendroid Support Token", "LST", 18, 12000000000)
  .then(function(tokenContract) {
    console.log("Vyper Protocol token contract has been deployed");
    return deployer.deploy(Protocol, tokenContract.address)
  }).then(function(protocolContract) {
    console.log("Vyper Protocol contract has been deployed");
  });
};
