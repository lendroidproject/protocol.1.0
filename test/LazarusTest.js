var Lazarus = artifacts.require("Lazarus");
var DummyContract = artifacts.require("DummyContract");
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"))

contract("Lazarus", function (addresses) {

  it("Test stub that should never fail.", async function() {
    assert.true;
  });

  beforeEach(async function () {
    this.contract = await Lazarus.new();
    this.dummyContract1 = await DummyContract.new({from:addresses[0]});
    this.dummyContract2 = await DummyContract.new({from:addresses[0]});
  });

  it("addChild should not accept a non-smart contract", async function() {
    let errr = false
    try {
      await this.contract.addChild(addresses[0], {from:addresses[0]});
    } catch (e) {
      errr = true
    }
    assert.isTrue(errr, 'Address should refer to a deployed smart contract')
  });

  it("addChild should increment lastChild value (and become new owner) after adding a child", async function() {
    assert.equal(await this.contract.lastChild(), 0);
    assert.equal(await this.dummyContract1.owner(), addresses[0]);
    await this.contract.addChild(this.dummyContract1.address, {from:addresses[0]});
    // necessary to test specific functionality
    await this.dummyContract1.transferOwnership(this.contract.address, {from:addresses[0]});
    assert.equal(await this.contract.lastChild(), 1);
    assert.equal(await this.dummyContract1.owner(), this.contract.address);
  });

  it("addChild should not add the same child twice", async function() {
    await this.contract.addChild(this.dummyContract1.address, {from:addresses[0]});
    // necessary to test specific functionality
    await this.dummyContract1.transferOwnership(this.contract.address, {from:addresses[0]});
    let errr = false
    try {
      await this.contract.addChild(this.dummyContract1.address, {from:addresses[0]});
    } catch (e) {
      errr = true
    }
    assert.isTrue(errr, 'Should not add the same child twice')
  });

  it("cleanLastChild should return false when there's no child", async function() {
    assert.equal(await this.contract.lastChild(), 0);
    const tx_result = await this.contract.cleanLastChild.sendTransaction({from:addresses[0]}).then(function(res) {console.log(res); return res});
    console.log(tx_result);
    assert.isTrue(tx_result, 'Should return false when lastChild is 0')
  });
});
