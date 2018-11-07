const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

const LoanRegistry = artifacts.require("LoanRegistry");
const DummyContract = artifacts.require("DummyContract");

const { assertRevert } = require('./helpers/assertRevert');

contract("LoanRegistry", function (addresses) {
  const lenders = [addresses[3], addresses[4], addresses[5]];
  const borrowers = [addresses[4], addresses[5], addresses[4]];

  beforeEach(async function () {
    this.contract = await LoanRegistry.new();
    this.testContract = await DummyContract.new({ from: addresses[0] });
    this.testContract1 = await DummyContract.new({ from: addresses[1] });
    this.testContract2 = await DummyContract.new({ from: addresses[2] });
  });

  describe('1. RecordLoan', function () {
    it("should success", async function () {
      const res = await this.contract.recordLoan(lenders[0], borrowers[0], this.testContract.address);

      const { logs } = res;
      logs.length.should.eq(1);

      const log = logs[0];
      log.event.should.eq('RecordLoan');
      log.args.lender.should.eq(lenders[0]);
      log.args.borrower.should.eq(borrowers[0]);
      log.args.loanAddress.should.eq(this.testContract.address);
      log.args.success.should.eq(true);
    });
  });

  describe('2. GetLoanCounts', function () {
    it("should success", async function () {
      await this.contract.recordLoan(lenders[0], borrowers[0], this.testContract.address);
      await this.contract.recordLoan(lenders[1], borrowers[1], this.testContract1.address);
      await this.contract.recordLoan(lenders[2], borrowers[2], this.testContract2.address);

      const res = await this.contract.getLoanCounts(addresses[4]);
      res[0].should.be.bignumber.equal(new BigNumber(1));
      res[1].should.be.bignumber.equal(new BigNumber(2));
    });
  });
});
