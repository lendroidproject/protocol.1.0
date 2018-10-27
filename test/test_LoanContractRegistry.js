var LoanContractRegistry = artifacts.require("LoanContractRegistry");

const BigNumber = web3.BigNumber;
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract("LoanContractRegistry", function (addresses) {
  beforeEach(async function () {
    this.contract = await LoanContractRegistry.new(addresses[0]);
    this.contract.addChild(addresses[1]);
    this.contract.addChild(addresses[2]);
  });

  it("should `isChild` return `true`", async function () {
    this.contract.isChild(addresses[1]).equal(true);
  });

  it("should `isChild` return `false`", async function () {
    this.contract.isChild(addresses[3]).equal(true);
  });

  it("should `addChild` return `true`", async function () {
    this.contract.addChild(addresses[3]).equal(true);
  });

  it("should `addChild` be failed", async function () {
    this.contract.addChild(addresses[1]).not.equal(true);
  });

  it("should `releaseChild` return `true` and its address", async function () {
    this.contract.releaseChild(addresses[2]).equal(true, addresses[2]);
  });

  it("should `releaseChild` be failed", async function () {
    this.contract.releaseChild(addresses[3]).not.equal(true, addresses[3]);
  });
});
