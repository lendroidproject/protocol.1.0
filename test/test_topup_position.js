// helpers
const mineTx = require("./helpers/mineTx.js");
const delay = require("./helpers/delay.js");
const saltGenerator = require("./helpers/saltGenerator.js");
// contracts
var ERC20 = artifacts.require('ERC20.vyper'),
  Protocol = artifacts.require('protocol.vyper');
// provider
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"))

const privateKeys = [
  '0x2a4dba8342d59c882ad703e8a0777c638bb7e0ae027e33cdc03000c08256fc2a',
  '0x2f927f35b9cb296e1edca9742b53a731f99cf030963957e2ef8f111be03b075e',
  '0x66f0c26de3f0a350d2892c27f9a934f4409fc7834a43babc5fc06ddf58e4846d',
  '0xdc2f22a232908faa3f719e4ac14827b790dcf0e23f49c134a3abd98294c5281c',
  '0x8d778e9ed2902be340fe68af5e0cd3bc6a60f8c86b3df334b5116e940c02da4f',
  '0x7bb0d719fe9907bff8e0d5604a159a411f8df89fa02ed3f6e101ded9c67a54a9',
  '0x35b4021d2be107ed86ddc63dd0bf6eec0cdd537e98883b4c9c653ec5c97f75ca',
  '0x6065603332df2f4fd243f3f4fde400b035da33f62d51fbe207014cb9d79e99be',
  '0xc0ea1c6abbada74f4d567dbe83c038fc74ad0972fc44effbaa7a4f99831eb979',
  '0xdc8da70cdfbdc3a12193da888ce765d14b93a7bad7f7bf8caa797a95b653d352',
]

contract("Protocol", function (addresses) {

  beforeEach(async function () {
    this.ZERO_ADDRESS = 0x0000000000000000000000000000000000000000;
    this.protocolToken = await ERC20.new("Lendroid Support Token", "LST", 18, 12000000000);
    this.LendToken = await ERC20.new("Test Lend Token", "TLT", 18, 1000000000);
    this.BorrowToken = await ERC20.new("Test Borrow Token", "TBT", 18, 1000000000);
    this.protocolContract = await Protocol.new(this.protocolToken.address);
    let tx = await this.protocolContract.set_token_support(this.LendToken.address, true, {from:addresses[0]});
    await mineTx(tx);
    tx = await this.protocolContract.set_token_support(this.BorrowToken.address, true, {from:addresses[0]});
    await mineTx(tx);
    this.lender = addresses[1];
    this.lender_priv = privateKeys[1];
    this.borrower = addresses[2];
    this.borrower_priv = privateKeys[2];
    this.relayer = addresses[3];
    this.relayer_priv = privateKeys[3];
    this.wrangler = addresses[4];
    this.wrangler_priv = privateKeys[4];
    //// kernel terms
    // uint256 values
    this.kernel_daily_interest_rate = 10
    // timedelta values
    this.kernel_position_duration_in_seconds = 5
    this.wrangler_approval_duration_in_seconds = 5 * 60
    // wei values
    this.kernel_lending_currency_maximum_value = web3.utils.toWei('40', 'ether')
    this.kernel_relayer_fee = web3.utils.toWei('10', 'ether')
    this.kernel_monitoring_fee = web3.utils.toWei('10', 'ether')
    this.kernel_rollover_fee = web3.utils.toWei('10', 'ether')
    this.kernel_closure_fee = web3.utils.toWei('10', 'ether')
    // timestamp values
    this.kernel_expires_at = (await web3.eth.getBlock(web3.eth.blockNumber)).timestamp + 86400*2
    // bytes32 values
    this.kernel_creator_salt = `0x${saltGenerator()}`
    // position terms
    this.position_lending_currency_fill_value = web3.utils.toWei('30', 'ether')
    this.position_borrow_currency_fill_value = web3.utils.toWei('3', 'ether')
    this.position_lending_currency_owed_value = web3.utils.toWei('30', 'ether')
    // open position
    tx = this.protocolToken.mint(this.lender, web3.utils.toWei('100', 'ether'), {from: addresses[0]})
    await mineTx(tx);
    tx = this.protocolToken.approve(this.protocolContract.address, web3.utils.toWei('100', 'ether'), {from: this.lender})
    await mineTx(tx);
    // set allowance from lender to protocol contract for loan transfer
    tx = this.LendToken.mint(this.lender, web3.utils.toWei('40', 'ether'), {from: addresses[0]})
    await mineTx(tx);
    tx = this.LendToken.approve(this.protocolContract.address, web3.utils.toWei('40', 'ether'), {from: this.lender})
    await mineTx(tx);
    // set allowance from borrower to protocol contract for collateral transfer
    tx = this.BorrowToken.mint(this.borrower, web3.utils.toWei('5', 'ether'), {from: addresses[0]})
    await mineTx(tx);
    tx = this.BorrowToken.approve(this.protocolContract.address, web3.utils.toWei('5', 'ether'), {from: this.borrower})
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
    // let _kernel_creator_signature = web3.eth.sign(this.lender, kernel_hash)
    let _kernel_creator_signature = await web3.eth.accounts.sign(kernel_hash, this.lender_priv)
    _kernel_creator_signature = _kernel_creator_signature.signature
    _kernel_creator_signature = _kernel_creator_signature.substr(2)
    // Sign position hash as wrangler
    let _nonce = '1';
    this.position_hash = await this.protocolContract.position_hash(
      [
        this.lender, this.lender, this.borrower, this.relayer, this.wrangler, this.BorrowToken.address, this.LendToken.address
      ],
      [
        this.position_borrow_currency_fill_value, this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee, this.kernel_monitoring_fee, this.kernel_rollover_fee, this.kernel_closure_fee,
        this.position_lending_currency_fill_value
      ],
      this.position_lending_currency_owed_value,
      _nonce
    )
    let _wrangler_approval_expiry_timestamp = (await web3.eth.getBlock(web3.eth.blockNumber)).timestamp + this.wrangler_approval_duration_in_seconds
    // let _wrangler_signature = web3.eth.sign(this.wrangler, this.position_hash)
    let _wrangler_signature = await web3.eth.accounts.sign(this.position_hash, this.wrangler_priv)
    _wrangler_signature = _wrangler_signature.signature
    _wrangler_signature = _wrangler_signature.substr(2)
    // prepare inputs
    let _is_creator_lender = true;
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
        this.kernel_expires_at, _wrangler_approval_expiry_timestamp
      ],
      this.kernel_position_duration_in_seconds,
      this.kernel_creator_salt,
      [
        [
          `${_kernel_creator_signature.slice(128, 130)}` === '00' ? web3.utils.toBN(27) : web3.utils.toBN(28),
          web3.utils.toBN(`0x${_kernel_creator_signature.slice(0, 64)}`),
          web3.utils.toBN(`0x${_kernel_creator_signature.slice(64, 128)}`)
        ],
        [
          `${_wrangler_signature.slice(128, 130)}` === '00' ? web3.utils.toBN(27) : web3.utils.toBN(28),
          web3.utils.toBN(`0x${_wrangler_signature.slice(0, 64)}`),
          web3.utils.toBN(`0x${_wrangler_signature.slice(64, 128)}`)
        ],
      ],
      {from: addresses[0]}
    );
    await mineTx(tx);
    this.position_index = await this.protocolContract.borrow_positions_count(this.borrower)
    this.position_hash = await this.protocolContract.borrow_positions(this.borrower, this.position_index)
    this.position = await this.protocolContract.position(this.position_hash)

    // topup amount
    this.borrow_currency_topup_value = web3.utils.toWei('1', 'ether')
  });


  it("topup_position should not be callable by lender", async function() {
    let errr = false
    try {
      await this.protocolContract.topup_position(this.position_hash, this.borrow_currency_topup_value, {from:this.lender});
    } catch (e) {
      errr = true
    }
    assert.isTrue(errr, 'lender should not be able to topup a position')
  });

  it("topup_position should not be callable by wrangler", async function() {
    let errr = false
    try {
      await this.protocolContract.topup_position(this.position_hash, this.borrow_currency_topup_value, {from:this.wrangler});
    } catch (e) {
      errr = true
    }
    assert.isTrue(errr, 'wrangler should not be able to topup a position')
  });

  it("topup_position should be callable by borrower before position has expired", async function() {
    if (!((await web3.eth.getBlock(web3.eth.blockNumber)).timestamp > this.position[8].toNumber())) {
      let errr = false
      try {
        await this.protocolContract.topup_position(this.position_hash, this.borrow_currency_topup_value, {from:this.borrower});
      } catch (e) {
        errr = true
      }
      assert.isTrue(!errr, 'borrower should be able to topup a position')
    }
  });

  it("topup_position should not be callable by borrower after position has expired", async function() {
    console.log(`Position expiry timestamp: ${this.position[8].toNumber()}`)
    while (!((await web3.eth.getBlock(web3.eth.blockNumber)).timestamp > this.position[8].toNumber())) {
      console.log(`Current blocktimestamp: ${(await web3.eth.getBlock(web3.eth.blockNumber)).timestamp}. Will check after 1s ...`)
      web3.currentProvider.send({
       jsonrpc: "2.0",
       method: "evm_mine",
       id: new Date().getTime()
      })
      await delay(1000)
    }
    console.log(`Current blocktimestamp: ${(await web3.eth.getBlock(web3.eth.blockNumber)).timestamp}`)
    let errr = false
    try {
      await this.protocolContract.topup_position(this.position_hash, this.borrow_currency_topup_value, {from:this.borrower});
    } catch (e) {
      errr = true
    }
    assert.isTrue(errr, 'borrower should not be able to topup a position after position has expired')
  });

  it("topup_position should increment borrow_currency_current_value correctly", async function() {
    if (!((await web3.eth.getBlock(web3.eth.blockNumber)).timestamp > this.position[8].toNumber())) {
      let borrow_currency_value = this.position[11]
      let borrow_currency_current_value = this.position[12]
      assert.isTrue(borrow_currency_value.toNumber() === borrow_currency_current_value.toNumber(), `borrow_currency_current_value should be ${borrow_currency_value}, NOT ${borrow_currency_current_value}`)
      let tx = await this.protocolContract.topup_position(this.position_hash, this.borrow_currency_topup_value, {from:this.borrower});
      await mineTx(tx);
      this.position = await this.protocolContract.position(this.position_hash)
      borrow_currency_current_value = this.position[12]
      let expected_borrow_currency_current_value = borrow_currency_value.add(this.borrow_currency_topup_value)
      assert.isTrue(borrow_currency_current_value.toNumber() === expected_borrow_currency_current_value.toNumber(), `borrow_currency_current_value should be ${expected_borrow_currency_current_value.toNumber()}, NOT ${borrow_currency_current_value.toNumber()}`)
    }
  });

});
