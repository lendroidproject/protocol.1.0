def test_set_wrangler_status_should_be_called_only_by_owner(w3, Protocol, assert_tx_failed):
    assert Protocol.functions.owner().call() == w3.eth.defaultAccount
    assert_tx_failed(lambda: Protocol.functions.set_wrangler_status(w3.eth.wranglerAccount.address, True).transact({'from': w3.eth.maliciousUserAccount}))
    assert Protocol.functions.wranglers(w3.eth.wranglerAccount.address).call() == False
    Protocol.functions.set_wrangler_status(w3.eth.wranglerAccount.address, True).transact({'from': w3.eth.defaultAccount})
    assert Protocol.functions.wranglers(w3.eth.wranglerAccount.address).call() == True


def test_set_wrangler_status_should_allow_owner_to_activate_deactivate_wrangler_status(w3, Protocol, assert_tx_failed):
    assert Protocol.functions.wranglers(w3.eth.wranglerAccount.address).call() == False
    Protocol.functions.set_wrangler_status(w3.eth.wranglerAccount.address, True).transact({'from': w3.eth.defaultAccount})
    assert Protocol.functions.wranglers(w3.eth.wranglerAccount.address).call() == True
    Protocol.functions.set_wrangler_status(w3.eth.wranglerAccount.address, False).transact({'from': w3.eth.defaultAccount})
    assert Protocol.functions.wranglers(w3.eth.wranglerAccount.address).call() == False


def test_set_position_threshold_should_be_called_only_by_owner(w3, Protocol, assert_tx_failed):
    assert Protocol.functions.owner().call() == w3.eth.defaultAccount
    assert Protocol.functions.position_threshold().call() == 10
    assert_tx_failed(lambda: Protocol.functions.set_position_threshold(11).transact({'from': w3.eth.maliciousUserAccount}))
    assert Protocol.functions.position_threshold().call() == 10
    Protocol.functions.set_position_threshold(11).transact({'from': w3.eth.defaultAccount})
    assert Protocol.functions.position_threshold().call() == 11


def test_set_position_threshold_should_allow_owner_to_modify_value(w3, Protocol, assert_tx_failed):
    assert Protocol.functions.position_threshold().call() == 10
    Protocol.functions.set_position_threshold(11).transact({'from': w3.eth.defaultAccount})
    assert Protocol.functions.position_threshold().call() == 11
    Protocol.functions.set_position_threshold(12).transact({'from': w3.eth.defaultAccount})
    assert Protocol.functions.position_threshold().call() == 12
    Protocol.functions.set_position_threshold(10).transact({'from': w3.eth.defaultAccount})
    assert Protocol.functions.position_threshold().call() == 10


def test_set_token_support_should_be_called_only_by_owner(w3, Protocol, Lend_token, assert_tx_failed):
    assert Protocol.functions.owner().call() == w3.eth.defaultAccount
    assert Protocol.functions.supported_tokens(Lend_token.address).call() == False
    assert_tx_failed(lambda: Protocol.functions.set_token_support(Lend_token.address, True).transact({'from': w3.eth.maliciousUserAccount}))
    assert Protocol.functions.supported_tokens(Lend_token.address).call() == False
    Protocol.functions.set_token_support(Lend_token.address, True).transact({'from': w3.eth.defaultAccount})
    assert Protocol.functions.supported_tokens(Lend_token.address).call() == True


def test_set_token_support_should_allow_owner_to_activate_deactivate_tokens(w3, Protocol, Lend_token, Borrow_token, assert_tx_failed):
    assert Protocol.functions.supported_tokens(Lend_token.address).call() == False
    Protocol.functions.set_token_support(Lend_token.address, True).transact({'from': w3.eth.defaultAccount})
    assert Protocol.functions.supported_tokens(Lend_token.address).call() == True
    assert Protocol.functions.supported_tokens(Borrow_token.address).call() == False
    Protocol.functions.set_token_support(Borrow_token.address, True).transact({'from': w3.eth.defaultAccount})
    assert Protocol.functions.supported_tokens(Borrow_token.address).call() == True
    Protocol.functions.set_token_support(Lend_token.address, False).transact({'from': w3.eth.defaultAccount})
    assert Protocol.functions.supported_tokens(Lend_token.address).call() == False
    Protocol.functions.set_token_support(Borrow_token.address, False).transact({'from': w3.eth.defaultAccount})
    assert Protocol.functions.supported_tokens(Borrow_token.address).call() == False

def test_set_token_support_should_not_accept_non_contract_addresses(w3, Protocol, assert_tx_failed):
    assert_tx_failed(lambda: Protocol.functions.set_token_support(w3.eth.maliciousUserAccount, True).transact({'from': w3.eth.defaultAccount}))
