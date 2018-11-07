const LoanContractRegistry = artifacts.require('LoanContractRegistry');
const LoanRegistry = artifacts.require('LoanRegistry');


module.exports = function (deployer, network, accounts) {
  deployer.deploy(LoanContractRegistry)
    .then(instance => {
      console.log('LoanContractRegistry has been deployed');
      return deployer.deploy(LoanRegistry);
    })
    .then(instance => {
      console.log('LoanRegistry has been deployed');
    });
}