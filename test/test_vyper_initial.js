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
    this.ZERO_ADDRESS = 0x0000000000000000000000000000000000000000;
    this.protocolToken = await ERC20.new("Lendroid Support Token", "LST", 18, 12000000000);
    this.LendToken = await ERC20.new("Test Lend Token", "TLT", 18, 1000000000);
    this.BorrowToken = await ERC20.new("Test Borrow Token", "TBT", 18, 1000000000);
    this.protocolContract = await Protocol.new(this.protocolToken.address);
    this.lender = addresses[1];
    this.borrower = addresses[2];
    this.relayer = addresses[3];
    this.wrangler = addresses[4];
  });

  it("set_position_threshold should be called only by owner", async function() {
    assert.isTrue(await this.protocolContract.owner() === addresses[0], 'protocol owner is not the first address');
    let errr = false
    try {
      await this.protocolContract.set_position_threshold(11, {from:addresses[7]});
    } catch (e) {
      errr = true
    }
    assert.isTrue(errr, 'a non-owner should not able to set the POSITION_THRESHOLD value')
    errr = false
    try {
      await this.protocolContract.set_position_threshold(11, {from:addresses[0]});
    } catch (e) {
      errr = true
    }
    assert.isTrue(!errr, 'owner is not not able to set the POSITION_THRESHOLD value')
  });

  it("set_position_threshold should be changeable", async function() {
    let currentThreshold = await this.protocolContract.POSITION_THRESHOLD();
    assert.isTrue(currentThreshold.toString() === '10', 'POSITION_THRESHOLD does not have the default value');
    await this.protocolContract.set_position_threshold(11, {from:addresses[0]});
    currentThreshold = await this.protocolContract.POSITION_THRESHOLD();
    assert.isTrue(currentThreshold.toString() === '11', 'POSITION_THRESHOLD value should have changed');
  });
});
