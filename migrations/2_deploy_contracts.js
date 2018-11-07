const LoanContractRegistry = artifacts.require('LoanContractRegistry');


module.exports = function (deployer, network, accounts) {
  deployer.deploy(LoanContractRegistry)
    .then(instance => {
      console.log('LoanContractRegistry has been deployed');
    });
}