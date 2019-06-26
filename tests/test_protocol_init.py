def test_lst_deploy(w3, LST_token):
    assert LST_token.functions.name().call() == 'Lendroid Support Token'
    assert LST_token.functions.symbol().call() == 'LST'
    assert LST_token.functions.decimals().call() == 18
    assert LST_token.functions.totalSupply().call() == 12000000000*10**18


def test_protocol_deploy(w3, LST_token, Protocol):
    assert Protocol.functions.protocol_token_address().call() == LST_token.address


def test_lend_token_deploy(w3, Lend_token):
    assert Lend_token.functions.name().call() == 'Test Lend Token'
    assert Lend_token.functions.symbol().call() == 'TLT'
    assert Lend_token.functions.decimals().call() == 18
    assert Lend_token.functions.totalSupply().call() == 10000000000*10**18


def test_borrow_token_deploy(w3, Borrow_token):
    assert Borrow_token.functions.name().call() == 'Test Borrow Token'
    assert Borrow_token.functions.symbol().call() == 'TBT'
    assert Borrow_token.functions.decimals().call() == 18
    assert Borrow_token.functions.totalSupply().call() == 10000000000*10**18
