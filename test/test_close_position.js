// helpers
const mineTx = require("./helpers/mineTx.js");
const delay = require("./helpers/delay.js");
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
    //// kernel terms
    // uint256 values
    this.kernel_daily_interest_rate = 10
    // timedelta values
    this.kernel_position_duration_in_seconds = 5
    // wei values
    this.kernel_lending_currency_maximum_value = '40'
    this.kernel_relayer_fee = '10'
    this.kernel_monitoring_fee = '10'
    this.kernel_rollover_fee = '10'
    this.kernel_closure_fee = '10'
    // timestamp values
    // let _today = new Date()
    // _today.setDate(_today.getDate() + 2)
    // this.kernel_expires_at = _today.getTime() / 1000
    this.kernel_expires_at = web3.eth.getBlock(web3.eth.blockNumber).timestamp + 86400*2
    // bytes32 values
    this.kernel_creator_salt = '0x92c0b12fa215396ed0867a9a871aee1a17657643000000000000000000000000'
    // position terms
    this.position_lending_currency_fill_value = '30'
    this.position_borrow_currency_fill_value = '3'
    // open position
    let tx = this.protocolToken.deposit({from: this.lender, value: '100'})
    await mineTx(tx);
    tx = this.protocolToken.approve(this.protocolContract.address, '100', {from: this.lender})
    await mineTx(tx);
    // set allowance from lender to protocol contract for loan transfer
    tx = this.LendToken.deposit({from: this.lender, value: '40'})
    await mineTx(tx);
    tx = this.LendToken.approve(this.protocolContract.address, '40', {from: this.lender})
    await mineTx(tx);
    // set allowance from borrower to protocol contract for collateral transfer
    tx = this.BorrowToken.deposit({from: this.borrower, value: '5'})
    await mineTx(tx);
    tx = this.BorrowToken.approve(this.protocolContract.address, '5', {from: this.borrower})
    await mineTx(tx);
    // Approve wrangler as protocol owner
    tx = this.protocolContract.set_wrangler_status(this.wrangler, true, {from:addresses[0]});
    await mineTx(tx);
    // Sign kernel hash as lender
    let kernel_hash = await this.protocolContract.kernel_hash(
      [
        this.lender, this.ZERO_ADDRESS, this.relayer, this.wrangler, this.BorrowToken.address, this.LendToken.address
      ],
      [
        this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee, this.kernel_monitoring_fee, this.kernel_rollover_fee, this.kernel_closure_fee
      ],
      this.kernel_expires_at, this.kernel_creator_salt,
      this.kernel_daily_interest_rate, this.kernel_position_duration_in_seconds
    )
    let res = web3.eth.sign(this.lender, kernel_hash)
    res = res.substr(2)
    // Sign position hash as wrangler
    _position_expiry_timestamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp + this.kernel_position_duration_in_seconds
    // _addresses, _values, _lend_currency_owed_value, _nonce, _position_expires_at
    this.position_hash = await this.protocolContract.position_hash(
      [
        this.lender, this.borrower, this.relayer, this.wrangler, this.BorrowToken.address, this.LendToken.address
      ],
      [
        this.position_borrow_currency_fill_value, this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee, this.kernel_monitoring_fee, this.kernel_rollover_fee, this.kernel_closure_fee,
        this.position_lending_currency_fill_value
      ],
      '33',
      '1',
      _position_expiry_timestamp
    )
    let res_p = web3.eth.sign(this.wrangler, this.position_hash)
    res_p = res_p.substr(2)
    // prepare inputs
    // do call
    tx = await this.protocolContract.fill_kernel(
      [
        this.lender, this.borrower, this.relayer, this.wrangler, this.BorrowToken.address, this.LendToken.address
      ],
      [
        this.position_borrow_currency_fill_value, this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee, this.kernel_monitoring_fee, this.kernel_rollover_fee, this.kernel_closure_fee,
        this.position_lending_currency_fill_value
      ],
      '1',
      this.kernel_daily_interest_rate,
      true,
      [
        this.kernel_expires_at, _position_expiry_timestamp
      ],
      this.kernel_position_duration_in_seconds,
      this.kernel_creator_salt,
      [
        [
          `${res.slice(128, 130)}` === '00' ? 27 : 28,
          web3._extend.utils.toBigNumber(`0x${res.slice(0, 64)}`).toNumber(),
          web3._extend.utils.toBigNumber(`0x${res.slice(64, 128)}`).toNumber()
        ],
        [
          `${res_p.slice(128, 130)}` === '00' ? 27 : 28,
          web3._extend.utils.toBigNumber(`0x${res_p.slice(0, 64)}`).toNumber(),
          web3._extend.utils.toBigNumber(`0x${res_p.slice(64, 128)}`).toNumber()
        ],
      ],
      {from: addresses[0]}
    );
    await mineTx(tx);
    this.position_index = await this.protocolContract.last_borrow_position_index(this.borrower)
    this.position_hash = await this.protocolContract.borrow_positions(this.borrower, this.position_index)

    // borrower prepares to repay
    // set allowance from borrower to protocol contract for loan repayment
    tx = this.LendToken.deposit({from: this.borrower, value: '33'})
    await mineTx(tx);
    tx = this.LendToken.approve(this.protocolContract.address, '33', {from: this.borrower})
    await mineTx(tx);

    this.position = await this.protocolContract.position(this.position_hash)
  });


  it("close_position should not be callable by lender", async function() {

    let errr = false
    try {
      await this.protocolContract.close_position(this.position_hash, {from:this.lender});
    } catch (e) {
      errr = true
    }
    assert.isTrue(errr, 'lender should not be able to close a position')
  });

  it("close_position should not be callable by wrangler", async function() {

    let errr = false
    try {
      await this.protocolContract.close_position(this.position_hash, {from:this.wrangler});
    } catch (e) {
      errr = true
    }
    assert.isTrue(errr, 'wrangler should not be able to close a position')
  });

  it("close_position should be callable by borrower", async function() {

    let errr = false
    try {
      await this.protocolContract.close_position(this.position_hash, {from:this.borrower});
    } catch (e) {
      errr = true
    }
    assert.isTrue(!errr, 'borrower should be able to close a position')
  });

  it("close_position should not work after position has expired", async function() {
    console.log(`Position expiry timestamp: ${this.position[5].toNumber()}`)
    while (web3.eth.getBlock(web3.eth.blockNumber).timestamp <= this.position[5].toNumber()) {
      console.log(`Current blocktimestamp: ${web3.eth.getBlock(web3.eth.blockNumber).timestamp}. Will check after 1s ...`)
      web3.currentProvider.send({
       jsonrpc: "2.0",
       method: "evm_mine",
       id: new Date().getTime()
      })
      await delay(5001)
    }
    console.log(`Current blocktimestamp: ${web3.eth.getBlock(web3.eth.blockNumber).timestamp}`)
    let errr = false
    try {
      await this.protocolContract.close_position(this.position_hash, {from:this.borrower});
    } catch (e) {
      errr = true
    }
    assert.isTrue(errr, 'borrower should not be able to close a position after position has expired')
  });
});
