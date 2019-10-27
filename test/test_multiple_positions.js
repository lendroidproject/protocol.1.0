// helpers
const mineTx = require("./helpers/mineTx.js");
const saltGenerator = require("./helpers/saltGenerator.js");
const blockTimestamp = require("./helpers/blockTimestamp");
// contracts
var ERC20 = artifacts.require("ERC20.vyper"),
  Protocol = artifacts.require("protocol.vyper");
// provider
const Web3 = require("web3");
const web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));

contract("Protocol - multiple position_hash", function(addresses) {
  beforeEach(async function() {
    this.ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    this.EMPTY_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
    this.protocolToken = await ERC20.new("Lendroid Support Token", "LST", 18, 12000000000);
    this.LendToken = await ERC20.new("Test Lend Token", "TLT", 18, 1000000000);
    this.BorrowToken = await ERC20.new("Test Borrow Token", "TBT", 18, 1000000000);
    this.protocolContract = await Protocol.new(this.protocolToken.address);
    let tx = await this.protocolContract.set_token_support(this.LendToken.address, true, { from: addresses[0] });
    await mineTx(tx);
    tx = await this.protocolContract.set_token_support(this.BorrowToken.address, true, { from: addresses[0] });
    await mineTx(tx);
    this.lender = addresses[1];
    this.borrower = addresses[2];
    this.relayer = addresses[3];
    this.wrangler = addresses[4];
    //// kernel terms
    // uint256 values
    this.kernel_daily_interest_rate = 10;
    // timedelta values
    this.kernel_position_duration_in_seconds = 5;
    this.wrangler_approval_duration_in_seconds = 5 * 60;
    // wei values
    this.kernel_lending_currency_maximum_value = web3.utils.toWei("40", "ether");
    this.kernel_relayer_fee = web3.utils.toWei("10", "ether");
    this.kernel_monitoring_fee = web3.utils.toWei("10", "ether");
    this.kernel_rollover_fee = web3.utils.toWei("10", "ether");
    this.kernel_closure_fee = web3.utils.toWei("10", "ether");
    // position terms
    let position_lending_currency_fill_value = web3.utils.toWei("30", "ether");
    let position_borrow_currency_fill_value = web3.utils.toWei("3", "ether");
    let position_lending_currency_owed_value = web3.utils.toWei("30", "ether");
    // open position
    tx = this.protocolToken.mint(this.lender, web3.utils.toWei("100", "ether"), { from: addresses[0] });
    await mineTx(tx);
    tx = this.protocolToken.approve(this.protocolContract.address, web3.utils.toWei("100", "ether"), {
      from: this.lender,
    });
    await mineTx(tx);
    // set allowance from lender to protocol contract for loan transfer
    tx = this.LendToken.mint(this.lender, web3.utils.toWei("40", "ether"), { from: addresses[0] });
    await mineTx(tx);
    tx = this.LendToken.approve(this.protocolContract.address, web3.utils.toWei("40", "ether"), { from: this.lender });
    await mineTx(tx);
    // set allowance from borrower to protocol contract for collateral transfer
    tx = this.BorrowToken.mint(this.borrower, web3.utils.toWei("5", "ether"), { from: addresses[0] });
    await mineTx(tx);
    tx = this.BorrowToken.approve(this.protocolContract.address, web3.utils.toWei("5", "ether"), {
      from: this.borrower,
    });
    await mineTx(tx);
    // Approve wrangler as protocol owner
    tx = this.protocolContract.set_wrangler_status(this.wrangler, true, { from: addresses[0] });
    await mineTx(tx);
    // timestamp values
    this.kernel_expires_at = (await blockTimestamp(web3)) + 86400 * 2;
    // bytes32 values
    this.kernel_creator_salt = `0x${saltGenerator()}`;
    // Sign kernel hash as lender
    let kernel_hash = await this.protocolContract.kernel_hash(
      [this.lender, this.ZERO_ADDRESS, this.relayer, this.wrangler, this.BorrowToken.address, this.LendToken.address],
      [
        this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee,
        this.kernel_monitoring_fee,
        this.kernel_rollover_fee,
        this.kernel_closure_fee,
      ],
      this.kernel_expires_at,
      this.kernel_creator_salt,
      this.kernel_daily_interest_rate,
      this.kernel_position_duration_in_seconds
    );
    this.kernel_creator_signature = await web3.eth.sign(kernel_hash, this.lender);
    this.kernel_addresses = [
      this.lender,
      this.ZERO_ADDRESS,
      this.relayer,
      this.wrangler,
      this.BorrowToken.address,
      this.LendToken.address,
    ];
    this.kernel_values = [
      this.kernel_lending_currency_maximum_value,
      this.kernel_relayer_fee,
      this.kernel_monitoring_fee,
      this.kernel_rollover_fee,
      this.kernel_closure_fee,
    ];
    // Sign position hash as wrangler
    let _nonce = "1";
    position_hash = await this.protocolContract.position_hash(
      [
        this.lender,
        this.lender,
        this.borrower,
        this.relayer,
        this.wrangler,
        this.BorrowToken.address,
        this.LendToken.address,
      ],
      [
        position_borrow_currency_fill_value,
        this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee,
        this.kernel_monitoring_fee,
        this.kernel_rollover_fee,
        this.kernel_closure_fee,
        position_lending_currency_fill_value,
      ],
      position_lending_currency_owed_value,
      _nonce
    );
    let _wrangler_approval_expiry_timestamp = (await blockTimestamp(web3)) + this.wrangler_approval_duration_in_seconds;
    let _wrangler_signature = await web3.eth.sign(position_hash, this.wrangler);
    // prepare inputs
    let _is_creator_lender = true;
    // do call
    tx = await this.protocolContract.fill_kernel(
      [this.lender, this.borrower, this.relayer, this.wrangler, this.BorrowToken.address, this.LendToken.address],
      [
        position_borrow_currency_fill_value,
        this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee,
        this.kernel_monitoring_fee,
        this.kernel_rollover_fee,
        this.kernel_closure_fee,
        position_lending_currency_fill_value,
      ],
      _nonce,
      this.kernel_daily_interest_rate,
      _is_creator_lender,
      [this.kernel_expires_at, _wrangler_approval_expiry_timestamp],
      this.kernel_position_duration_in_seconds,
      this.kernel_creator_salt,
      this.kernel_creator_signature,
      _wrangler_signature,
      { from: addresses[0] }
    );
    await mineTx(tx);
  });

  it("should fill the same kernel with two different positions each with a different nonce and fill_value within available kernel lend currency value", async function() {
    position_borrow_currency_fill_value = web3.utils.toWei("1", "ether");
    _nonce = "2";
    position_lending_currency_fill_value = web3.utils.toWei("10", "ether");
    position_lending_currency_owed_value = web3.utils.toWei("10", "ether");
    position_hash = await this.protocolContract.position_hash(
      [
        this.lender,
        this.lender,
        this.borrower,
        this.relayer,
        this.wrangler,
        this.BorrowToken.address,
        this.LendToken.address,
      ],
      [
        position_borrow_currency_fill_value,
        this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee,
        this.kernel_monitoring_fee,
        this.kernel_rollover_fee,
        this.kernel_closure_fee,
        position_lending_currency_fill_value,
      ],
      position_lending_currency_owed_value,
      _nonce
    );
    _wrangler_approval_expiry_timestamp = (await blockTimestamp(web3)) + this.wrangler_approval_duration_in_seconds;
    _wrangler_signature = await web3.eth.sign(position_hash, this.wrangler);
    _is_creator_lender = true;

    let errr = false;
    try {
      await this.protocolContract.fill_kernel(
        [this.lender, this.borrower, this.relayer, this.wrangler, this.BorrowToken.address, this.LendToken.address],
        [
          position_borrow_currency_fill_value,
          this.kernel_lending_currency_maximum_value,
          this.kernel_relayer_fee,
          this.kernel_monitoring_fee,
          this.kernel_rollover_fee,
          this.kernel_closure_fee,
          position_lending_currency_fill_value,
        ],
        _nonce,
        this.kernel_daily_interest_rate,
        _is_creator_lender,
        [this.kernel_expires_at, _wrangler_approval_expiry_timestamp],
        this.kernel_position_duration_in_seconds,
        this.kernel_creator_salt,
        this.kernel_creator_signature,
        _wrangler_signature,
        { from: addresses[0] }
      );
    } catch (e) {
      errr = true;
    }
    assert.isTrue(!errr, "two positions should be created with different nonce value for a givel kernel");
  });

  it("should not fill the same kernel with two different positions each with the same nonce and fill_value within available kernel lend currency value", async function() {
    position_borrow_currency_fill_value = web3.utils.toWei("1", "ether");
    _nonce = "1";
    position_lending_currency_fill_value = web3.utils.toWei("10", "ether");
    position_lending_currency_owed_value = web3.utils.toWei("10", "ether");
    position_hash = await this.protocolContract.position_hash(
      [
        this.lender,
        this.lender,
        this.borrower,
        this.relayer,
        this.wrangler,
        this.BorrowToken.address,
        this.LendToken.address,
      ],
      [
        position_borrow_currency_fill_value,
        this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee,
        this.kernel_monitoring_fee,
        this.kernel_rollover_fee,
        this.kernel_closure_fee,
        position_lending_currency_fill_value,
      ],
      position_lending_currency_owed_value,
      _nonce
    );
    _wrangler_approval_expiry_timestamp = (await blockTimestamp(web3)) + this.wrangler_approval_duration_in_seconds;
    _wrangler_signature = await web3.eth.sign(position_hash, this.wrangler);
    _is_creator_lender = true;

    let errr = false;
    try {
      await this.protocolContract.fill_kernel(
        [this.lender, this.borrower, this.relayer, this.wrangler, this.BorrowToken.address, this.LendToken.address],
        [
          position_borrow_currency_fill_value,
          this.kernel_lending_currency_maximum_value,
          this.kernel_relayer_fee,
          this.kernel_monitoring_fee,
          this.kernel_rollover_fee,
          this.kernel_closure_fee,
          position_lending_currency_fill_value,
        ],
        _nonce,
        this.kernel_daily_interest_rate,
        _is_creator_lender,
        [this.kernel_expires_at, _wrangler_approval_expiry_timestamp],
        this.kernel_position_duration_in_seconds,
        this.kernel_creator_salt,
        this.kernel_creator_signature,
        _wrangler_signature,
        { from: addresses[0] }
      );
    } catch (e) {
      errr = true;
    }
    assert.isTrue(errr, "second position with the same nonce value for a givel kernel should not be created");
  });

  it("should not fill the same kernel with two different positions each with a different nonce and fill_value above available kernel lend currency value", async function() {
    position_borrow_currency_fill_value = web3.utils.toWei("2", "ether");
    _nonce = "1";
    position_lending_currency_fill_value = web3.utils.toWei("20", "ether");
    position_lending_currency_owed_value = web3.utils.toWei("20", "ether");
    position_hash = await this.protocolContract.position_hash(
      [
        this.lender,
        this.lender,
        this.borrower,
        this.relayer,
        this.wrangler,
        this.BorrowToken.address,
        this.LendToken.address,
      ],
      [
        position_borrow_currency_fill_value,
        this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee,
        this.kernel_monitoring_fee,
        this.kernel_rollover_fee,
        this.kernel_closure_fee,
        position_lending_currency_fill_value,
      ],
      position_lending_currency_owed_value,
      _nonce
    );
    _wrangler_approval_expiry_timestamp = (await blockTimestamp(web3)) + this.wrangler_approval_duration_in_seconds;
    _wrangler_signature = await web3.eth.sign(position_hash, this.wrangler);
    _is_creator_lender = true;

    let errr = false;
    try {
      await this.protocolContract.fill_kernel(
        [this.lender, this.borrower, this.relayer, this.wrangler, this.BorrowToken.address, this.LendToken.address],
        [
          position_borrow_currency_fill_value,
          this.kernel_lending_currency_maximum_value,
          this.kernel_relayer_fee,
          this.kernel_monitoring_fee,
          this.kernel_rollover_fee,
          this.kernel_closure_fee,
          position_lending_currency_fill_value,
        ],
        _nonce,
        this.kernel_daily_interest_rate,
        _is_creator_lender,
        [this.kernel_expires_at, _wrangler_approval_expiry_timestamp],
        this.kernel_position_duration_in_seconds,
        this.kernel_creator_salt,
        this.kernel_creator_signature,
        _wrangler_signature,
        { from: addresses[0] }
      );
    } catch (e) {
      errr = true;
    }
    assert.isTrue(errr, "second position above kernel limit should not be created");
  });

  it("should work in the sequence: 1st position, kernel limit minimized, 2nd position", async function() {
    let _lend_currency_cancel_value = web3.utils.toWei("5", "ether");
    tx = this.protocolContract.cancel_kernel(
      this.kernel_addresses,
      this.kernel_values,
      this.kernel_expires_at,
      this.kernel_creator_salt,
      this.kernel_daily_interest_rate,
      this.kernel_position_duration_in_seconds,
      this.kernel_creator_signature,
      _lend_currency_cancel_value,
      { from: this.lender }
    );
    await mineTx(tx);

    position_borrow_currency_fill_value = web3.utils.toWei("0.5", "ether");
    _nonce = "2";
    position_lending_currency_fill_value = web3.utils.toWei("5", "ether");
    position_lending_currency_owed_value = web3.utils.toWei("5", "ether");
    position_hash = await this.protocolContract.position_hash(
      [
        this.lender,
        this.lender,
        this.borrower,
        this.relayer,
        this.wrangler,
        this.BorrowToken.address,
        this.LendToken.address,
      ],
      [
        position_borrow_currency_fill_value,
        this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee,
        this.kernel_monitoring_fee,
        this.kernel_rollover_fee,
        this.kernel_closure_fee,
        position_lending_currency_fill_value,
      ],
      position_lending_currency_owed_value,
      _nonce
    );
    _wrangler_approval_expiry_timestamp = (await blockTimestamp(web3)) + this.wrangler_approval_duration_in_seconds;
    _wrangler_signature = await web3.eth.sign(position_hash, this.wrangler);
    _is_creator_lender = true;

    let errr = false;
    try {
      await this.protocolContract.fill_kernel(
        [this.lender, this.borrower, this.relayer, this.wrangler, this.BorrowToken.address, this.LendToken.address],
        [
          position_borrow_currency_fill_value,
          this.kernel_lending_currency_maximum_value,
          this.kernel_relayer_fee,
          this.kernel_monitoring_fee,
          this.kernel_rollover_fee,
          this.kernel_closure_fee,
          position_lending_currency_fill_value,
        ],
        _nonce,
        this.kernel_daily_interest_rate,
        _is_creator_lender,
        [this.kernel_expires_at, _wrangler_approval_expiry_timestamp],
        this.kernel_position_duration_in_seconds,
        this.kernel_creator_salt,
        this.kernel_creator_signature,
        _wrangler_signature,
        { from: addresses[0] }
      );
    } catch (e) {
      errr = true;
    }
    assert.isTrue(!errr, "second position should be created after kernel cancel and amount to lend still available");
  });

  it("no position should be overridden according to the sequence: Open 3 borrow positions, close 1st position, open new position.", async function() {
    // borrower opens 2nd position

    position_borrow_currency_fill_value = web3.utils.toWei("0.3", "ether");
    _nonce = "2";
    position_lending_currency_fill_value = web3.utils.toWei("3", "ether");
    position_lending_currency_owed_value = web3.utils.toWei("3", "ether");
    position_hash = await this.protocolContract.position_hash(
      [
        this.lender,
        this.lender,
        this.borrower,
        this.relayer,
        this.wrangler,
        this.BorrowToken.address,
        this.LendToken.address,
      ],
      [
        position_borrow_currency_fill_value,
        this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee,
        this.kernel_monitoring_fee,
        this.kernel_rollover_fee,
        this.kernel_closure_fee,
        position_lending_currency_fill_value,
      ],
      position_lending_currency_owed_value,
      _nonce
    );
    _wrangler_approval_expiry_timestamp = (await blockTimestamp(web3)) + this.wrangler_approval_duration_in_seconds;
    _wrangler_signature = await web3.eth.sign(position_hash, this.wrangler);
    _is_creator_lender = true;

    tx = await this.protocolContract.fill_kernel(
      [this.lender, this.borrower, this.relayer, this.wrangler, this.BorrowToken.address, this.LendToken.address],
      [
        position_borrow_currency_fill_value,
        this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee,
        this.kernel_monitoring_fee,
        this.kernel_rollover_fee,
        this.kernel_closure_fee,
        position_lending_currency_fill_value,
      ],
      _nonce,
      this.kernel_daily_interest_rate,
      _is_creator_lender,
      [this.kernel_expires_at, _wrangler_approval_expiry_timestamp],
      this.kernel_position_duration_in_seconds,
      this.kernel_creator_salt,
      this.kernel_creator_signature,
      _wrangler_signature,
      { from: addresses[0] }
    );
    await mineTx(tx);

    let position_count = await this.protocolContract.position_counts(this.borrower);
    assert.isTrue(position_count[0].toNumber() === 2, `borrower should have 2 borrow positions`);

    // borrower opens 3rd position

    position_borrow_currency_fill_value = web3.utils.toWei("0.2", "ether");
    _nonce = "3";
    position_lending_currency_fill_value = web3.utils.toWei("2", "ether");
    position_lending_currency_owed_value = web3.utils.toWei("2", "ether");
    position_hash = await this.protocolContract.position_hash(
      [
        this.lender,
        this.lender,
        this.borrower,
        this.relayer,
        this.wrangler,
        this.BorrowToken.address,
        this.LendToken.address,
      ],
      [
        position_borrow_currency_fill_value,
        this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee,
        this.kernel_monitoring_fee,
        this.kernel_rollover_fee,
        this.kernel_closure_fee,
        position_lending_currency_fill_value,
      ],
      position_lending_currency_owed_value,
      _nonce
    );
    _wrangler_approval_expiry_timestamp = (await blockTimestamp(web3)) + this.wrangler_approval_duration_in_seconds;
    _wrangler_signature = await web3.eth.sign(position_hash, this.wrangler);
    _is_creator_lender = true;

    tx = await this.protocolContract.fill_kernel(
      [this.lender, this.borrower, this.relayer, this.wrangler, this.BorrowToken.address, this.LendToken.address],
      [
        position_borrow_currency_fill_value,
        this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee,
        this.kernel_monitoring_fee,
        this.kernel_rollover_fee,
        this.kernel_closure_fee,
        position_lending_currency_fill_value,
      ],
      _nonce,
      this.kernel_daily_interest_rate,
      _is_creator_lender,
      [this.kernel_expires_at, _wrangler_approval_expiry_timestamp],
      this.kernel_position_duration_in_seconds,
      this.kernel_creator_salt,
      this.kernel_creator_signature,
      _wrangler_signature,
      { from: addresses[0] }
    );
    await mineTx(tx);

    position_count = await this.protocolContract.position_counts(this.borrower);
    assert.isTrue(position_count[0].toNumber() === 3, `borrower should have 3 borrow positions`);

    let first_position_1 = await this.protocolContract.borrow_positions(this.borrower, 1);
    let second_position_1 = await this.protocolContract.borrow_positions(this.borrower, 2);
    let third_position_1 = await this.protocolContract.borrow_positions(this.borrower, 3);

    // borrower closes 1st position
    //   borrower prepares to repay
    //   set allowance from borrower to protocol contract for loan repayment
    tx = this.LendToken.mint(this.borrower, web3.utils.toWei("30", "ether"), { from: addresses[0] });
    await mineTx(tx);
    tx = this.LendToken.approve(this.protocolContract.address, web3.utils.toWei("30", "ether"), {
      from: this.borrower,
    });
    await mineTx(tx);
    tx = await this.protocolContract.close_position(first_position_1, { from: this.borrower });
    await mineTx(tx);

    position_count = await this.protocolContract.position_counts(this.borrower);
    assert.isTrue(position_count[0].toNumber() === 2, `borrower should have 2 borrow positions`);

    first_position_2 = await this.protocolContract.borrow_positions(this.borrower, 1);
    second_position_2 = await this.protocolContract.borrow_positions(this.borrower, 2);
    third_position_2 = await this.protocolContract.borrow_positions(this.borrower, 3);

    assert.isTrue(
      first_position_2 === third_position_1,
      `1st position hash should now be ${third_position_1}, NOT ${first_position_2}`
    );
    assert.isTrue(
      second_position_2 === second_position_1,
      `2st position hash should now be ${second_position_1}, NOT ${second_position_2}`
    );
    assert.isTrue(
      third_position_2 === this.EMPTY_BYTES32,
      `3rd position hash should now be ${this.EMPTY_BYTES32}, NOT ${third_position_2}`
    );

    // borrower opens a new position

    position_borrow_currency_fill_value = web3.utils.toWei("0.5", "ether");
    _nonce = "4";
    position_lending_currency_fill_value = web3.utils.toWei("5", "ether");
    position_lending_currency_owed_value = web3.utils.toWei("5", "ether");
    position_hash = await this.protocolContract.position_hash(
      [
        this.lender,
        this.lender,
        this.borrower,
        this.relayer,
        this.wrangler,
        this.BorrowToken.address,
        this.LendToken.address,
      ],
      [
        position_borrow_currency_fill_value,
        this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee,
        this.kernel_monitoring_fee,
        this.kernel_rollover_fee,
        this.kernel_closure_fee,
        position_lending_currency_fill_value,
      ],
      position_lending_currency_owed_value,
      _nonce
    );
    _wrangler_approval_expiry_timestamp = (await blockTimestamp(web3)) + this.wrangler_approval_duration_in_seconds;
    _wrangler_signature = await web3.eth.sign(position_hash, this.wrangler);
    _is_creator_lender = true;

    tx = await this.protocolContract.fill_kernel(
      [this.lender, this.borrower, this.relayer, this.wrangler, this.BorrowToken.address, this.LendToken.address],
      [
        position_borrow_currency_fill_value,
        this.kernel_lending_currency_maximum_value,
        this.kernel_relayer_fee,
        this.kernel_monitoring_fee,
        this.kernel_rollover_fee,
        this.kernel_closure_fee,
        position_lending_currency_fill_value,
      ],
      _nonce,
      this.kernel_daily_interest_rate,
      _is_creator_lender,
      [this.kernel_expires_at, _wrangler_approval_expiry_timestamp],
      this.kernel_position_duration_in_seconds,
      this.kernel_creator_salt,
      this.kernel_creator_signature,
      _wrangler_signature,
      { from: addresses[0] }
    );
    await mineTx(tx);

    position_count = await this.protocolContract.position_counts(this.borrower);
    assert.isTrue(position_count[0].toNumber() === 3, `borrower should have 3 borrow positions`);

    first_position_3 = await this.protocolContract.borrow_positions(this.borrower, 1);
    second_position_3 = await this.protocolContract.borrow_positions(this.borrower, 2);
    third_position_3 = await this.protocolContract.borrow_positions(this.borrower, 3);

    assert.isTrue(
      first_position_3 === third_position_1,
      `1st position hash should now be ${third_position_1}, NOT ${first_position_3}`
    );
    assert.isTrue(
      second_position_3 === second_position_1,
      `2st position hash should now be ${second_position_1}, NOT ${second_position_3}`
    );
    assert.isTrue(third_position_3 !== this.EMPTY_BYTES32, `3rd position hash should now NOT be ${this.EMPTY_BYTES32}`);
  });
});
