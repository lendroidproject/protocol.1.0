// helpers
const mineTx = require("./helpers/mineTx.js");
// contracts
var ERC20 = artifacts.require('ERC20.vyper'),
  Protocol = artifacts.require('protocol.vyper');
// provider
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"))

contract("Protocol", function (addresses) {


  beforeEach(async function () {
    this.protocolToken = await ERC20.new("Lendroid Support Token", "LST", 18, 12000000000);
    this.protocolContract = await Protocol.new(this.protocolToken.address);
    this.wrangler = addresses[4];
  });


  it("set_wrangler_status should be called only by owner", async function() {
    assert.isTrue(await this.protocolContract.owner() === addresses[0], 'protocol owner is not the first address');
    let errr = false
    try {
      await this.protocolContract.set_wrangler_status(this.wrangler, true, {from:addresses[7]});
    } catch (e) {
      errr = true
    }
    assert.isTrue(errr, 'a non-owner should not able to set the position_threshold value')
    errr = false
    try {
      await this.protocolContract.set_wrangler_status(this.wrangler, true, {from:addresses[0]});
    } catch (e) {
      errr = true
    }
    assert.isTrue(!errr, 'owner is not not able to set the wrangler activation status')
  });


  it("set_wrangler_status should allow owner to activate / deactivate wrangler status", async function() {
    let wrangler_status = await this.protocolContract.wranglers(this.wrangler);
    assert.isTrue(!wrangler_status, 'wrangler should have been deactivated');
    await this.protocolContract.set_wrangler_status(this.wrangler, true, {from:addresses[0]});
    wrangler_status = await this.protocolContract.wranglers(this.wrangler);
    assert.isTrue(wrangler_status, 'wrangler should have been activated');
    await this.protocolContract.set_wrangler_status(this.wrangler, false, {from:addresses[0]});
    wrangler_status = await this.protocolContract.wranglers(this.wrangler);
    assert.isTrue(!wrangler_status, 'wrangler should have been deactivated');
  });


  it("set_position_threshold should be called only by owner", async function() {
    assert.isTrue(await this.protocolContract.owner() === addresses[0], 'protocol owner is not the first address');
    let errr = false
    try {
      await this.protocolContract.set_position_threshold(11, {from:addresses[7]});
    } catch (e) {
      errr = true
    }
    assert.isTrue(errr, 'a non-owner should not able to set the position_threshold value')
    errr = false
    try {
      await this.protocolContract.set_position_threshold(11, {from:addresses[0]});
    } catch (e) {
      errr = true
    }
    assert.isTrue(!errr, 'owner is not not able to set the position_threshold value')
  });


  it("set_position_threshold should be changeable", async function() {
    let currentThreshold = await this.protocolContract.position_threshold();
    assert.isTrue(currentThreshold.toString() === '10', 'position_threshold does not have the default value');
    await this.protocolContract.set_position_threshold(11, {from:addresses[0]});
    currentThreshold = await this.protocolContract.position_threshold();
    assert.isTrue(currentThreshold.toString() === '11', 'position_threshold value should have changed');
  });
});
