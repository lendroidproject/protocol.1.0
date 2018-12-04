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
    //// kernel terms
    // uint256 values
    this.kernel_daily_interest_rate = 10
    // timedelta values
    this.kernel_position_duration_in_seconds = 86400
    // wei values
    this.kernel_lending_currency_maximum_value = '40'
    this.kernel_relayer_fee = '10'
    this.kernel_monitoring_fee = '10'
    this.kernel_rollover_fee = '10'
    this.kernel_closure_fee = '10'
    // timestamp values
    let _today = new Date()
    _today.setDate(_today.getDate() + 2)
    this.kernel_expires_at = _today.getTime() / 1000
    // bytes32 values
    this.kernel_creator_salt = '0x92c0b12fa215396ed0867a9a871aee1a17657643000000000000000000000000'
    // position terms
    this.position_lending_currency_fill_value = '30'
    this.position_borrow_currency_fill_value = '3'
  });


  it("open_position should work as expected", async function() {
    // setup
    // set allowance from lender to protocol contract for relayer_fee + monitoring_fee
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
    // lender check
    let lenderPositionCounts = await this.protocolContract.position_counts(this.lender);
    let lenderBorrowPositionsCount = lenderPositionCounts[0];
    let lenderLendPositionsCount = lenderPositionCounts[1];
    assert.isTrue(lenderBorrowPositionsCount.toString() === '0', "lender's borrow position count should be 0");
    assert.isTrue(lenderLendPositionsCount.toString() === '0', "lender's lend position count should be 0");
    assert.isTrue(await this.protocolContract.can_lend(this.lender), 'lender should be able to lend')
    // borrower check
    let borrowerPositionCounts = await this.protocolContract.position_counts(this.borrower);
    let borrowerBorrowPositionsCount = borrowerPositionCounts[0];
    let borrowerLendPositionsCount = borrowerPositionCounts[1];
    assert.isTrue(borrowerBorrowPositionsCount.toString() === '0', "borrower's borrow position count should be 0");
    assert.isTrue(borrowerLendPositionsCount.toString() === '0', "borrower's lend position count should be 0");
    assert.isTrue(await this.protocolContract.can_lend(this.borrower), 'borrower should be able to lend')

    // fill kernel and open position
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
    _r1 = `0x${res.slice(0, 64)}`
    _s1 = `0x${res.slice(64, 128)}`
    _v1 = `${res.slice(128, 130)}` === '00' ? 27 : 28
    // Sign position hash as wrangler
    let _today = new Date()
    _position_expiry_seconds = _today.getTime() + 86400
    // _addresses, _values, _lend_currency_owed_value, _nonce, _position_expires_at
    let position_hash = await this.protocolContract.position_hash(
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
      _position_expiry_seconds / 1000
    )
    let res_p = web3.eth.sign(this.wrangler, position_hash)
    res_p = res_p.substr(2)
    _r2 = `0x${res_p.slice(0, 64)}`
    _s2 = `0x${res_p.slice(64, 128)}`
    _v2 = `${res_p.slice(128, 130)}` === '00' ? 27 : 28
    // prepare inputs
    let _nonce = '1';
    let _is_creator_lender = true;
    // test pre-call
    let _kernel_amount_filled = await this.protocolContract.kernels_filled(kernel_hash);
    assert.isTrue(_kernel_amount_filled.toString() === '0');
    let _kernel_amount_cancelled = await this.protocolContract.kernels_cancelled(kernel_hash);
    assert.isTrue(_kernel_amount_cancelled.toString() === '0');
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
      _nonce,
      this.kernel_daily_interest_rate,
      _is_creator_lender,
      [
        this.kernel_expires_at, this.kernel_expires_at
      ],
      this.kernel_position_duration_in_seconds,
      this.kernel_creator_salt,
      [
        [_v1, web3._extend.utils.toBigNumber(_r1).toNumber(), web3._extend.utils.toBigNumber(_s1).toNumber()],
        [_v2, web3._extend.utils.toBigNumber(_r2).toNumber(), web3._extend.utils.toBigNumber(_s2).toNumber()],
      ],
      {from: addresses[0]}
    );

    await mineTx(tx);
    // test post-call
    lenderPositionCounts = await this.protocolContract.position_counts(this.lender);
    lenderBorrowPositionsCount = lenderPositionCounts[0];
    lenderLendPositionsCount = lenderPositionCounts[1];
    assert.isTrue(lenderBorrowPositionsCount.toString() === '0', "lender's borrow position count should be 0");
    assert.isTrue(lenderLendPositionsCount.toString() === '1', "lender's lend position count should be 1");
    borrowerPositionCounts = await this.protocolContract.position_counts(this.borrower);
    borrowerBorrowPositionsCount = borrowerPositionCounts[0];
     borrowerLendPositionsCount = borrowerPositionCounts[1];
    assert.isTrue(borrowerBorrowPositionsCount.toString() === '1', "borrower's borrow position count should be 0");
    assert.isTrue(borrowerLendPositionsCount.toString() === '0', "borrower's lend position count should be 0");
  });
});
