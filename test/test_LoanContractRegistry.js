require('chai').should();

var LoanContractRegistry = artifacts.require("LoanContractRegistry");
var DummyContract = artifacts.require("DummyContract");

const { assertRevert } = require('./helpers/assertRevert');

contract("LoanContractRegistry", function (addresses) {
  beforeEach(async function () {
    this.contract = await LoanContractRegistry.new();

    this.testContract = await DummyContract.new({ from: addresses[0] });
    this.testContract1 = await DummyContract.new({ from: addresses[1] });
    this.testContract2 = await DummyContract.new({ from: addresses[2] });
  });

  describe('1. AddChild', function () {
    it("should success", async function () {
      const res = await this.contract.addChild(this.testContract.address);

      const { logs } = res;
      logs.length.should.eq(1);

      const log = logs[0];
      log.event.should.eq('AddChild');
      log.args.contractAddress.should.eq(this.testContract.address);
      log.args.success.should.eq(true);
    });
    it("should be failed", async function () {
      await assertRevert(this.contract.addChild(this.testContract.address, { from: addresses[1] }));
    });
  });

  describe('2. ReleaseChild', function () {
    it("should success", async function () {
      await this.contract.addChild(this.testContract1.address, { from: addresses[1] });
      const res = await this.contract.releaseChild();

      const { logs } = res;
      logs.length.should.eq(1);

      const log = logs[0];
      log.event.should.eq('ReleaseChild');
      log.args.contractAddress.should.eq(this.testContract1.address);
      log.args.success.should.eq(true);
    });
    it("should return `false`", async function () {
      const res = await this.contract.releaseChild();
      res.should.have.property('tx').with.lengthOf(66);
    });
  });
});
