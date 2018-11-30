# Vyper version of the Lendroid protocol v1
# THIS CONTRACT HAS NOT BEEN AUDITED!
# Solidity code available at:
# https://github.com/lendroidproject/protocol.1.0


# Interface for the ERC20 contract, used mainly for `transfer` and `transferFrom` functions
contract ERC20:
    def name() -> bytes32: constant
    def symbol() -> bytes32: constant
    def decimals() -> uint256: constant
    def balanceOf(_owner: address) -> uint256: constant
    def totalSupply() -> uint256: constant
    def transfer(_to: address, _amount: uint256) -> bool: modifying
    def transferFrom(_from: address, _to: address, _value: uint256) -> bool: modifying
    def approve(_spender: address, _amount: uint256) -> bool: modifying
    def allowance(_owner: address, _spender: address) -> uint256: modifying


# Events of the protocol.
PositionStatusNotification: event({_wrangler: indexed(address), _position_hash: indexed(bytes32), _notification_key: bytes[6], _notification_value: uint256})
PositionBorrowCurrencyNotification: event({_wrangler: indexed(address), _position_hash: indexed(bytes32), _notification_key: bytes[21], _notification_value: uint256})

# Variables of the protocol.
token_address: address(ERC20)
position_template_address: public(address)
owner: public(address)
# kernel
kernels_filled: uint256(wei)[bytes32]
kernels_cancelled: uint256(wei)[bytes32]
# position
positions: public({
    # players
    lender: address,
    borrower: address,
    relayer: address,
    wrangler: address,
    # terms
    created_at: timestamp,
    expires_at: timestamp,
    updated_at: timestamp,
    borrow_currency_address: address,
    lend_currency_address: address,
    borrow_currency_value: uint256(wei),
    borrow_currency_current_value: uint256(wei),
    lend_currency_borrowed_value: uint256(wei),
    lend_currency_owed_value: uint256(wei),
    status: uint256,
    # nonce
    nonce: uint256,
    # fees
    relayer_fee: uint256(wei),
    monitoring_fee: uint256(wei),
    rollover_fee: uint256(wei),
    closure_fee: uint256(wei)
}[bytes32])
POSITION_THRESHOLD: public(uint256)
last_borrow_position_index: uint256[address]
last_lend_position_index: uint256[address]
borrow_positions: bytes32[uint256][address]
lend_positions: bytes32[uint256][address]

# wrangler
wranglers: bool[address]
wrangler_nonces: uint256[address][address]

# constants
DECIMALS: public(uint256)
SECONDS_PER_DAY: public(uint256)
POSITION_STATUS_DEACTIVATED: public(uint256)
POSITION_STATUS_OPEN: public(uint256)
POSITION_STATUS_CLOSED: public(uint256)
POSITION_STATUS_LIQUIDATING: public(uint256)
POSITION_STATUS_LIQUIDATED: public(uint256)
POSITION_TOPPED_UP: public(uint256)
POSITION_TOPPED_DOWN: public(uint256)


@public
def __init__(_addresses: address[2]):
    self.owner = msg.sender
    self.token_address = _addresses[0]
    self.position_template_address = _addresses[1]
    self.POSITION_THRESHOLD = 10
    self.DECIMALS = 10 ** 18
    self.SECONDS_PER_DAY = 86400
    self.POSITION_STATUS_DEACTIVATED = 0
    self.POSITION_STATUS_OPEN = 1
    self.POSITION_STATUS_CLOSED = 2
    self.POSITION_STATUS_LIQUIDATING = 3
    self.POSITION_STATUS_LIQUIDATED = 4
    self.POSITION_TOPPED_UP = 1
    self.POSITION_TOPPED_DOWN = 2

@public
def set_position_threshold(_value: uint256) -> bool:
    assert msg.sender == self.owner
    self.POSITION_THRESHOLD = _value
    return True

@private
def is_contract(_address: address) -> bool:
    return (_address != ZERO_ADDRESS) and (_address.codesize > 0)

@public
@constant
def is_wrangler_active(_address: address) -> bool:
    return self.wranglers[_address]

@public
@constant
def current_wrangler_nonce(_addresses: address[2]) -> uint256:
    return self.wrangler_nonces[_addresses[0]][_addresses[1]]

@public
@constant
def can_borrow(_address: address) -> bool:
    return self.last_borrow_position_index[_address] < self.POSITION_THRESHOLD

@public
@constant
def can_lend(_address: address) -> bool:
    return self.last_lend_position_index[_address] < self.POSITION_THRESHOLD

@public
@constant
def kernel_hash(_addresses: address[6], _values: uint256(wei)[9],
        _kernel_expires: timestamp) -> bytes32:
    # return sha3(concat("a","b"))
    return sha3(
        concat(
            convert(self, bytes32),
            convert(_addresses[0], bytes32),# lender
            convert(_addresses[1], bytes32),# borrower
            convert(_addresses[2], bytes32),# relayer
            convert(_addresses[3], bytes32),# wrangler
            convert(_addresses[4], bytes32),# collateralToken
            convert(_addresses[5], bytes32),# loanToken
            convert(_values[0], bytes32),# loanAmountOffered
            convert(_kernel_expires, bytes32),# offerExpiryTimestamp
            convert(_values[2], bytes32),# relayerFeeLST
            convert(_values[3], bytes32),# monitoringFeeLST
            convert(_values[4], bytes32),# rolloverFeeLST
            convert(_values[5], bytes32),# closureFeeLST
            convert(_values[6], bytes32)# creatorSalt
        )
    )

@public
@constant
def position_hash(_addresses: address[7], _values: uint256(wei)[13], lend_currency_owed_value: uint256(wei), _nonce: uint256,
        _position_expires_at: timestamp) -> bytes32:
    return sha3(
        concat(
            convert(self, bytes32),
            convert(_addresses[4], bytes32),# collateralToken
            convert(_addresses[5], bytes32),# loanToken
            convert(_values[0], bytes32),# collateralAmount
            convert(_values[12], bytes32),# loanAmountBorrowed
            convert(lend_currency_owed_value, bytes32),# loanAmountOwed
            convert(_position_expires_at, bytes32),# loanExpiresAtTimestamp
            convert(_addresses[0], bytes32),# lender
            convert(_addresses[1], bytes32),# borrower
            convert(_addresses[2], bytes32),# relayer
            convert(_addresses[3], bytes32),# wrangler
            convert(_values[5], bytes32),# relayerFeeLST
            convert(_values[6], bytes32),# monitoringFeeLST
            convert(_values[7], bytes32),# rolloverFeeLST
            convert(_values[8], bytes32),# closureFeeLST
            convert(_nonce, bytes32)# nonce
        )
    )


@public
@constant
def filled_or_cancelled_loan_amount(_kernel_hash: bytes32) -> uint256:
    return as_unitless_number(self.kernels_filled[_kernel_hash]) + as_unitless_number(self.kernels_filled[_kernel_hash])


@private
def record_position(_lender: address, _borrower: address, _position: bytes32) -> bool:
    assert self.can_borrow(_borrower)
    assert self.can_lend(_lender)
    self.borrow_positions[_borrower][self.last_borrow_position_index[_borrower] + 1] = _position
    self.last_borrow_position_index[_borrower] += 1
    self.lend_positions[_lender][self.last_lend_position_index[_lender]+1] = _position
    self.last_lend_position_index[_lender] += 1
    return True


@private
def remove_position(_position_hash: bytes32) -> bool:
    self.last_borrow_position_index[self.positions[_position_hash].borrower] -= 1
    self.last_lend_position_index[self.positions[_position_hash].lender] -= 1
    return True


@public
@constant
def position_counts(_address: address) -> (uint256, uint256):
    return (self.last_borrow_position_index[_address], self.last_lend_position_index[_address])


@private
def open_position(_kernel_creator: address,
        _addresses: address[7], _values: uint256(wei)[13],
        _position_duration_in_seconds: timedelta, _nonce: uint256,
        _approval_expires: timestamp, _v: uint256, _r: uint256, _s: uint256) -> bool:
    assert self.wranglers[_addresses[3]]
    assert _approval_expires > block.timestamp
    assert _nonce == self.current_wrangler_nonce([_addresses[3], _kernel_creator]) + 1
    self.wrangler_nonces[_addresses[3]][_kernel_creator] += 1
    # owed value
    _lend_currency_borrowed_value: uint256(wei) = _values[12]
    _daily_interest_rate: uint256 = as_unitless_number(_values[2]) / as_unitless_number(self.DECIMALS)
    _position_duration_in_days: uint256 = as_unitless_number(_position_duration_in_seconds) / as_unitless_number(self.SECONDS_PER_DAY)
    _total_interest: uint256 = as_unitless_number(_lend_currency_borrowed_value) * _daily_interest_rate * _daily_interest_rate / 100
    _total_owed: uint256 = as_unitless_number(_lend_currency_borrowed_value) + _total_interest
    _lend_currency_owed_value: uint256(wei) = as_wei_value(_total_owed, "wei")
    _position_expires_at: timestamp = block.timestamp + _position_duration_in_seconds
    _position_hash: bytes32 = self.position_hash(_addresses, _values, _lend_currency_owed_value, _nonce, _position_expires_at)
    # record position
    # players
    self.positions[_position_hash].lender = _addresses[0]
    self.positions[_position_hash].borrower = _addresses[1]
    self.positions[_position_hash].relayer = _addresses[2]
    self.positions[_position_hash].wrangler = _addresses[3]
    # terms
    self.positions[_position_hash].created_at = block.timestamp
    self.positions[_position_hash].expires_at = _position_expires_at
    self.positions[_position_hash].updated_at = block.timestamp
    self.positions[_position_hash].borrow_currency_address = _addresses[4]
    self.positions[_position_hash].lend_currency_address = _addresses[5]
    self.positions[_position_hash].borrow_currency_value = _values[0]
    self.positions[_position_hash].borrow_currency_current_value = _values[0]
    self.positions[_position_hash].lend_currency_borrowed_value = _lend_currency_borrowed_value
    self.positions[_position_hash].lend_currency_owed_value = _lend_currency_owed_value
    self.positions[_position_hash].status = self.POSITION_STATUS_OPEN
    # nonce
    self.positions[_position_hash].nonce = _nonce
    # fees
    self.positions[_position_hash].relayer_fee = _values[5]
    self.positions[_position_hash].monitoring_fee = _values[6]
    self.positions[_position_hash].rollover_fee = _values[7]
    self.positions[_position_hash].closure_fee = _values[8]
    assert self.record_position(_addresses[0], _addresses[1], _position_hash)

    # transfer borrow_currency_current_value from borrower to this address
    assert ERC20(self.positions[_position_hash].borrow_currency_address).transferFrom(
        self.positions[_position_hash].borrower,
        self,
        as_unitless_number(self.positions[_position_hash].borrow_currency_current_value)
    )
    # transfer lend_currency_borrowed_value from lender to borrower
    assert ERC20(self.positions[_position_hash].lend_currency_address).transferFrom(
        self.positions[_position_hash].lender,
        self.positions[_position_hash].borrower,
        as_unitless_number(self.positions[_position_hash].lend_currency_borrowed_value)
    )
    # transfer monitoring_fee from lender to wrangler
    assert self.token_address.transferFrom(
        self.positions[_position_hash].lender,
        self.positions[_position_hash].wrangler,
        as_unitless_number(self.positions[_position_hash].monitoring_fee)
    )
    # Notify wrangler that a position has been opened
    log.PositionStatusNotification(self.positions[_position_hash].wrangler, _position_hash, "status", self.POSITION_STATUS_OPEN)

    return True


@public
def topup_position(_position_hash: bytes32, _borrow_currency_increment: uint256(wei)) -> bool:
    # confirm sender is borrower
    assert msg.sender == self.positions[_position_hash].borrower
    # confirm position has not expired yet
    assert self.positions[_position_hash].expires_at >= block.timestamp
    # confirm position is still active
    assert self.positions[_position_hash].status == self.POSITION_STATUS_OPEN
    # transfer borrow_currency_current_value from borrower to this address
    assert ERC20(self.positions[_position_hash].borrow_currency_address).transferFrom(
        self.positions[_position_hash].borrower,
        self,
        as_unitless_number(_borrow_currency_increment)
    )
    self.positions[_position_hash].borrow_currency_current_value += _borrow_currency_increment
    # Notify wrangler that a position has been closed
    log.PositionBorrowCurrencyNotification(self.positions[_position_hash].wrangler, _position_hash, "borrow_currency_value", self.POSITION_TOPPED_UP)

    return True


@public
def liquidate_position(_position_hash: bytes32) -> bool:
    # confirm position has expired
    assert self.positions[_position_hash].expires_at < block.timestamp
    # confirm sender is lender or wrangler
    assert (msg.sender == self.positions[_position_hash].wrangler) or (msg.sender == self.positions[_position_hash].lender)
    # confirm position is still active
    assert self.positions[_position_hash].status == self.POSITION_STATUS_OPEN
    # transfer borrow_currency_current_value from this address to the sender
    assert ERC20(self.positions[_position_hash].borrow_currency_address).transfer(
        self.positions[_position_hash].borrower,
        as_unitless_number(self.positions[_position_hash].borrow_currency_current_value)
    )
    self.positions[_position_hash].status = self.POSITION_STATUS_LIQUIDATED
    assert self.remove_position(_position_hash)
    # Notify wrangler that a position has been liquidated
    log.PositionStatusNotification(self.positions[_position_hash].wrangler, _position_hash, "status", self.POSITION_STATUS_LIQUIDATED)

    return True


@public
def close_position(_position_hash: bytes32) -> bool:
    # confirm sender is borrower
    assert msg.sender == self.positions[_position_hash].borrower
    # confirm position has not expired yet
    assert self.positions[_position_hash].expires_at >= block.timestamp
    # confirm position is still active
    assert self.positions[_position_hash].status == self.POSITION_STATUS_OPEN
    # transfer lend_currency_owed_value from borrower to lender
    assert ERC20(self.positions[_position_hash].lend_currency_address).transferFrom(
        self.positions[_position_hash].borrower,
        self.positions[_position_hash].lender,
        as_unitless_number(self.positions[_position_hash].lend_currency_owed_value)
    )
    # transfer borrow_currency_current_value from this address to borrower
    assert ERC20(self.positions[_position_hash].borrow_currency_address).transfer(
        self.positions[_position_hash].borrower,
        as_unitless_number(self.positions[_position_hash].borrow_currency_current_value)
    )
    self.positions[_position_hash].status = self.POSITION_STATUS_CLOSED
    assert self.remove_position(_position_hash)
    # Notify wrangler that a position has been closed
    log.PositionStatusNotification(self.positions[_position_hash].wrangler, _position_hash, "status", self.POSITION_STATUS_CLOSED)

    return True


@public
def fill_kernel(_addresses: address[7], _values: uint256(wei)[13],
        position_duration_in_seconds: timedelta, _timestamps: timestamp[2], _nonce: uint256,
        _vS: uint256[2], _rS: uint256[2], _sS: uint256[2],
        _is_creator_lender: bool) -> bool:
    # validate _lender is not empty
    assert _addresses[0] != ZERO_ADDRESS
    # validate _borrower is not empty
    assert _addresses[1] != ZERO_ADDRESS
    # It's OK if _relayer is empty
    # validate _wrangler is not empty
    assert _addresses[3] != ZERO_ADDRESS
    # validate _collateralToken is a contract address
    assert self.is_contract(_addresses[4])
    # validate _loanToken is a contract address
    assert self.is_contract(_addresses[5])
    # validate loan amounts
    assert as_unitless_number(_values[1]) > 0
    assert as_unitless_number(_values[2]) > 0
    # validate asked and offered expiry timestamps
    assert _timestamps[0] > block.timestamp
    # validate signature of kernel creator
    _kernel_creator: address = _addresses[1]
    _kernel_lender: address = ZERO_ADDRESS
    _kernel_borrower: address = _addresses[1]
    if _is_creator_lender:
        _kernel_creator = _addresses[0]
        _kernel_lender = _addresses[0]
        _kernel_borrower = ZERO_ADDRESS
    _kernel_addresses: address[6] = [
        _kernel_lender, _kernel_borrower,
        _addresses[2], # relayer
        _addresses[3], # wrangler
        _addresses[4], # collateralToken
        _addresses[5]  # loanToken
    ]
    _kernel_values: uint256(wei)[9] = [
        _values[1],    # loanAmountOffered
        _values[2],    # interestRatePerDay
        _values[3],    # loanDuration
        _values[4],    # offerExpiryTimestamp
        _values[5],    # relayerFeeLST
        _values[6],    # monitoringFeeLST
        _values[7],    # rolloverFeeLST
        _values[8],    # closureFeeLST
        _values[9]     # creatorSalt
    ]
    _k_hash: bytes32 = self.kernel_hash(_kernel_addresses, _kernel_values, _timestamps[0])
    # require(offerCreator == ecrecover(offer.offerHash, _vS[0], _rS[0], _sS[0]));
    assert _kernel_creator == ecrecover(_k_hash, _vS[0], _rS[0], _sS[0])
    # validate laon amount to be filled
    assert as_unitless_number(_values[0]) - self.filled_or_cancelled_loan_amount(_k_hash) >= as_unitless_number(_values[12])
    # fill offer with lending currency
    self.kernels_filled[_k_hash] += _values[12]
    # Transfer input to wranglerLoanRegistryContractAddress
    assert self.is_contract(_addresses[6])
    # open position
    assert self.open_position(_kernel_creator, _addresses, _values,
        position_duration_in_seconds, _nonce, _timestamps[1], _vS[1], _rS[1], _sS[1])
    # transfer relayerFeeLST from lender to relayer
    if not _addresses[3] == ZERO_ADDRESS:
        assert self.token_address.transferFrom(_addresses[0], _addresses[3], as_unitless_number(_values[5]))

    return True


@public
def cancel_kernel(_addresses: address[6], _values: uint256(wei)[9], _expires: timestamp,
        _v: uint256, _r: uint256, _s: uint256,
        _lend_currency_cancel_value: uint256(wei)) -> bool:
    # verify sender is kernel signer
    kernel_hash: bytes32 = self.kernel_hash(_addresses, _values, _expires)
    assert msg.sender == ecrecover(kernel_hash, _v, _r, _s)
    # verify sanity of offered and cancellation amounts
    assert as_unitless_number(_values[1]) > 0
    assert as_unitless_number(_lend_currency_cancel_value) > 0
    # verify cancellation amount does not exceed remaining laon amount to be filled
    assert as_unitless_number(_values[0]) - self.filled_or_cancelled_loan_amount(kernel_hash) >= as_unitless_number(_lend_currency_cancel_value)
    self.kernels_cancelled[kernel_hash] += _lend_currency_cancel_value

    return True


@public
@payable
def __default__():
    pass
