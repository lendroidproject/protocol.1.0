from web3 import Web3


def test_protocol_should_not_accept_ether(w3, Protocol, assert_tx_failed):
    w3.eth.getBalance(Protocol.address) == 0
    assert_tx_failed(lambda: w3.eth.sendTransaction({'to': Protocol.address, 'from': w3.eth.maliciousUserAccount, 'value': 100}))


def test_escape_hatch_token_should_be_called_only_by_owner(w3, Protocol, Borrow_token, assert_tx_failed):
    assert Protocol.functions.owner().call() == w3.eth.defaultAccount
    assert_tx_failed(lambda: Protocol.functions.escape_hatch_token(Borrow_token.address).transact({'from': w3.eth.maliciousUserAccount}))
    Protocol.functions.escape_hatch_token(Borrow_token.address).transact({'from': w3.eth.defaultAccount})

def test_tokens_should_be_wihdrawable_under_an_escape_hatch_condition(w3, Protocol, Malicious_token, assert_tx_failed):
    assert Malicious_token.functions.balanceOf(w3.eth.maliciousUserAccount).call() == 2*10**18
    Malicious_token.functions.transfer(Protocol.address, Web3.toWei('2', 'ether')).transact({'from': w3.eth.maliciousUserAccount})
    assert Malicious_token.functions.balanceOf(w3.eth.maliciousUserAccount).call() == 0
    assert Malicious_token.functions.balanceOf(Protocol.address).call() == 2*10**18
    assert Malicious_token.functions.balanceOf(w3.eth.defaultAccount).call() == 0
    Protocol.functions.escape_hatch_token(Malicious_token.address).transact({'from': w3.eth.defaultAccount})
    assert Malicious_token.functions.balanceOf(w3.eth.maliciousUserAccount).call() == 0
    assert Malicious_token.functions.balanceOf(Protocol.address).call() == 0
    assert Malicious_token.functions.balanceOf(w3.eth.defaultAccount).call() == 2*10**18
