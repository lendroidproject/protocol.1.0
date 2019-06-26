from web3 import (Web3,)

def transact_as_local_account(w3, local_account, transaction_function, gas=70000):
    transaction_params = transaction_function.buildTransaction({
        'gas': 70000,
        'gasPrice': w3.toWei('1', 'gwei'),
        'nonce': w3.eth.getTransactionCount(local_account.address),
    })
    raw_tx = local_account.signTransaction(transaction_params).rawTransaction
    w3.eth.sendRawTransaction(raw_tx)


def test_fill_kernel(w3, Protocol, LST_token, Lend_token, Borrow_token, random_salt, zero_address):
    Protocol.functions.set_token_support(Lend_token.address, True).transact({'from': w3.eth.defaultAccount})
    Protocol.functions.set_token_support(Borrow_token.address, True).transact({'from': w3.eth.defaultAccount})
    assert Protocol.functions.supported_tokens(Lend_token.address).call() == True
    assert Protocol.functions.supported_tokens(Borrow_token.address).call() == True
    kernel_daily_interest_rate = Web3.toWei('0.000001', 'ether')
    kernel_position_duration_in_seconds = 90 * 60 * 60 * 24
    wrangler_approval_duration_in_seconds = 5 * 60
    kernel_lending_currency_maximum_value = Web3.toWei('40', 'ether')
    kernel_relayer_fee = Web3.toWei('10', 'ether')
    kernel_monitoring_fee = Web3.toWei('10', 'ether')
    kernel_rollover_fee = Web3.toWei('10', 'ether')
    kernel_closure_fee = Web3.toWei('10', 'ether')
    kernel_expires_at = w3.eth.getBlock('latest').timestamp + 86400*2
    kernel_creator_salt = '0x{0}'.format(random_salt)
    position_lending_currency_fill_value = Web3.toWei('10', 'ether')
    position_borrow_currency_fill_value = Web3.toWei('1.1', 'ether')
    position_lending_currency_owed_value = Protocol.functions.owed_value(
      position_lending_currency_fill_value,
      kernel_daily_interest_rate,
      kernel_position_duration_in_seconds
    ).call()
    # set LST approval

    LST_token.functions.mint(w3.eth.lenderAccount.address, Web3.toWei('100', 'ether')).transact({'from': w3.eth.defaultAccount})
    transact_as_local_account(w3, w3.eth.lenderAccount, LST_token.functions.approve(Protocol.address, Web3.toWei('100', 'ether')))

    # set Lend token approval
    Lend_token.functions.mint(w3.eth.lenderAccount.address, Web3.toWei('100', 'ether')).transact({'from': w3.eth.defaultAccount})
    transact_as_local_account(w3, w3.eth.lenderAccount, Lend_token.functions.approve(Protocol.address, Web3.toWei('100', 'ether')))
    # set Borrow token approval
    Borrow_token.functions.mint(w3.eth.borrowerAccount.address, Web3.toWei('100', 'ether')).transact({'from': w3.eth.defaultAccount})
    transact_as_local_account(w3, w3.eth.borrowerAccount, Borrow_token.functions.approve(Protocol.address, Web3.toWei('100', 'ether')))
    # approve wrangler
    Protocol.functions.set_wrangler_status(w3.eth.wranglerAccount.address, True).transact({'from': w3.eth.defaultAccount})
    # position_index check
    assert Protocol.functions.last_position_index().call() == 0
    # lender check
    lenderPositionCounts = Protocol.functions.position_counts(w3.eth.lenderAccount.address).call()
    assert lenderPositionCounts[0] == 0
    assert lenderPositionCounts[1] == 0
    assert Protocol.functions.can_lend(w3.eth.lenderAccount.address).call() == True
    # borrower check
    borrowerPositionCounts = Protocol.functions.position_counts(w3.eth.borrowerAccount.address).call()
    assert borrowerPositionCounts[0] == 0
    assert borrowerPositionCounts[1] == 0
    assert Protocol.functions.can_borrow(w3.eth.borrowerAccount.address).call() == True
    # balances check
    assert Borrow_token.functions.balanceOf(Protocol.address).call() == 0
    assert Lend_token.functions.balanceOf(w3.eth.borrowerAccount.address).call() == 0
    assert LST_token.functions.balanceOf(w3.eth.wranglerAccount.address).call() == 0
    assert LST_token.functions.balanceOf(w3.eth.relayerAccount.address).call() == 0
    # prepare signed kernel hash
    kernel_hash = Protocol.functions.kernel_hash(
      [
        w3.eth.lenderAccount.address, zero_address, w3.eth.relayerAccount.address, w3.eth.wranglerAccount.address, Borrow_token.address, Lend_token.address
      ],
      [
        kernel_lending_currency_maximum_value,
        kernel_relayer_fee, kernel_monitoring_fee, kernel_rollover_fee, kernel_closure_fee
      ],
      kernel_expires_at, kernel_creator_salt,
      kernel_daily_interest_rate, kernel_position_duration_in_seconds
    ).call()
    kernel_hash = Web3.soliditySha3(['bytes32', 'bytes32'], [Web3.toBytes(text='\x19Ethereum Signed Message:\n32'), kernel_hash])
    _signature = w3.eth.account.signHash(kernel_hash, private_key=w3.eth.lenderAccount.privateKey)
    kernel_creator_signature = _signature.signature
    # prepare signed position hash
    nonce = Web3.toInt(1)
    position_hash = Protocol.functions.position_hash(
      [
        w3.eth.lenderAccount.address, w3.eth.lenderAccount.address, w3.eth.borrowerAccount.address, w3.eth.relayerAccount.address, w3.eth.wranglerAccount.address, Borrow_token.address, Lend_token.address
      ],
      [
        position_borrow_currency_fill_value, kernel_lending_currency_maximum_value,
        kernel_relayer_fee, kernel_monitoring_fee, kernel_rollover_fee, kernel_closure_fee,
        position_lending_currency_fill_value
      ],
      position_lending_currency_owed_value,
      nonce
    ).call()
    position_hash = Web3.soliditySha3(['bytes32', 'bytes32'], [Web3.toBytes(text='\x19Ethereum Signed Message:\n32'), position_hash])
    _signature = w3.eth.account.signHash(position_hash, private_key=w3.eth.wranglerAccount.privateKey)
    wrangler_signature = _signature.signature
    # prepare inputs for kernel fill
    wrangler_approval_expiry_timestamp = w3.eth.getBlock('latest').timestamp + wrangler_approval_duration_in_seconds
    is_creator_lender = True
    # verify kernel has been neither filled nor cancelled
    assert Protocol.functions.kernels_filled(kernel_hash).call() == 0
    assert Protocol.functions.kernels_cancelled(kernel_hash).call() == 0
    # fill kernel
    Protocol.functions.fill_kernel(
      [
        w3.eth.lenderAccount.address, w3.eth.borrowerAccount.address, w3.eth.relayerAccount.address, w3.eth.wranglerAccount.address, Borrow_token.address, Lend_token.address
      ],
      [
        position_borrow_currency_fill_value, kernel_lending_currency_maximum_value,
        kernel_relayer_fee, kernel_monitoring_fee, kernel_rollover_fee, kernel_closure_fee,
        position_lending_currency_fill_value
      ],
      nonce,
      kernel_daily_interest_rate,
      is_creator_lender,
      [
        kernel_expires_at, wrangler_approval_expiry_timestamp
      ],
      kernel_position_duration_in_seconds,
      kernel_creator_salt,
      kernel_creator_signature,
      wrangler_signature
    ).transact({'from': w3.eth.defaultAccount})
    # position_index confirm
    assert Protocol.functions.last_position_index().call() == 1
    # lender confirm
    lenderPositionCounts = Protocol.functions.position_counts(w3.eth.lenderAccount.address).call()
    assert lenderPositionCounts[0] == 0
    assert lenderPositionCounts[1] == 1
    # borrower confirm
    borrowerPositionCounts = Protocol.functions.position_counts(w3.eth.borrowerAccount.address).call()
    assert borrowerPositionCounts[0] == 1
    assert borrowerPositionCounts[1] == 0
    # balances confirm
    assert Borrow_token.functions.balanceOf(Protocol.address).call() == position_borrow_currency_fill_value
    assert Lend_token.functions.balanceOf(w3.eth.borrowerAccount.address).call() == position_lending_currency_fill_value
    assert LST_token.functions.balanceOf(w3.eth.wranglerAccount.address).call() == kernel_monitoring_fee
    assert LST_token.functions.balanceOf(w3.eth.relayerAccount.address).call() == kernel_relayer_fee
