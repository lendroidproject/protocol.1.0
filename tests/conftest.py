import os
import random

import pytest

from vyper import compile_code

from eth_tester import (
    EthereumTester,
    PyEVMBackend,
)

from eth_account import (Account, )

from eth_tester.exceptions import (
    TransactionFailed,
)

from web3 import (
    Web3, EthereumTesterProvider
)

from vdb.vdb import (
    VyperDebugCmd
)
from vdb.eth_tester_debug_backend import (
    set_debug_info
)
from vdb.source_map import (
    produce_source_map
)


ZERO_ADDRESS = Web3.toChecksumAddress('0x0000000000000000000000000000000000000000')


@pytest.fixture
def tester():
    genesis_overrides = {"gas_limit": 7000000}
    custom_genesis_params = PyEVMBackend._generate_genesis_params(
        overrides=genesis_overrides
    )
    pyevm_backend = PyEVMBackend(genesis_parameters=custom_genesis_params)
    t = EthereumTester(backend=pyevm_backend)
    return t


def zero_gas_price_strategy(web3, transaction_params=None):
    return 0  # zero gas price makes testing simpler.


@pytest.fixture()
def w3(tester):
    w3 = Web3(EthereumTesterProvider(ethereum_tester=tester))
    w3.eth.setGasPriceStrategy(zero_gas_price_strategy)
    w3.eth.defaultAccount = w3.eth.accounts[0]
    w3.eth.lenderAccount = Account.create('lender')
    w3.eth.sendTransaction({'to': w3.eth.lenderAccount.address, 'from': w3.eth.accounts[1], 'value': 1000000*10**18})
    w3.eth.borrowerAccount = Account.create('borrower')
    w3.eth.sendTransaction({'to': w3.eth.borrowerAccount.address, 'from': w3.eth.accounts[2], 'value': 1000000*10**18})
    w3.eth.relayerAccount = Account.create('relayer')
    w3.eth.sendTransaction({'to': w3.eth.relayerAccount.address, 'from': w3.eth.accounts[3], 'value': 1000000*10**18})
    w3.eth.wranglerAccount = Account.create('relayer')
    w3.eth.sendTransaction({'to': w3.eth.wranglerAccount.address, 'from': w3.eth.accounts[4], 'value': 1000000*10**18})
    w3.eth.maliciousUserAccount = w3.eth.accounts[7]
    return w3


def _get_contract(w3, source_code, *args, **kwargs):
    interface_codes = kwargs.get('interface_codes')

    if interface_codes == None:
        compiler_output = compile_code(
            source_code,
            ['bytecode', 'abi'],
        )
        source_map = produce_source_map(source_code)
    else:
        compiler_output = compile_code(
            source_code,
            ['bytecode', 'abi'],
            interface_codes=interface_codes,
        )
        source_map = produce_source_map(source_code, interface_codes=interface_codes)

    abi = compiler_output['abi']
    bytecode = compiler_output['bytecode']
    contract = w3.eth.contract(abi=abi, bytecode=bytecode)

    # Enable vdb.
    set_debug_info(source_code, source_map)
    import vdb
    setattr(vdb.debug_computation.DebugComputation, 'enable_debug', True)
    constructor_args = kwargs.get('constructor_args', [])
    value = kwargs.pop('value', 0)
    value_in_eth = kwargs.pop('value_in_eth', 0)
    value = value_in_eth * 10**18 if value_in_eth else value  # Handle deploying with an eth value.
    gasPrice = kwargs.pop('gasPrice', 0)
    from_ = kwargs.pop('from_', w3.eth.accounts[0])
    deploy_transaction = {
        'from': from_,
        'data': contract._encode_constructor_data(constructor_args),
        'value': value,
        'gasPrice': gasPrice,
    }
    tx = w3.eth.sendTransaction(deploy_transaction)
    tx_receipt = w3.eth.getTransactionReceipt(tx)
    if tx_receipt['status'] == 0:
        import ipdb; ipdb.set_trace()
        raise Exception('Could not deploy contract! {}'.format(tx_receipt))
    address = tx_receipt['contractAddress']
    contract = w3.eth.contract(address, abi=abi, bytecode=bytecode)
    # Filter logs.
    contract._logfilter = w3.eth.filter({
        'fromBlock': w3.eth.blockNumber - 1,
        'address': contract.address
    })
    return contract


def _transact_as_local_account(w3, local_account, transaction_function, gas=70000):
    transaction_params = transaction_function.buildTransaction({
        'gas': 70000,
        'gasPrice': w3.toWei('1', 'gwei'),
        'nonce': w3.eth.getTransactionCount(local_account.address),
    })
    raw_tx = local_account.signTransaction(transaction_params).rawTransaction
    w3.eth.sendRawTransaction(raw_tx)


@pytest.fixture
def get_logs(w3):
    def get_logs(tx_hash, c, event_name):
        tx_receipt = w3.eth.getTransactionReceipt(tx_hash)
        logs = c._classic_contract.events[event_name]().processReceipt(tx_receipt)
        return logs
    return get_logs


@pytest.fixture
def get_contract(w3):
    def get_contract(source_code, *args, **kwargs):
        return _get_contract(w3, source_code, *args, **kwargs)
    return get_contract


def create_contract(w3, get_contract, path, constructor_args, interface_codes=None, **kwargs):
    wd = os.path.dirname(os.path.realpath(__file__))
    with open(os.path.join(wd, os.pardir, path)) as f:
        source_code = f.read()
    return get_contract(source_code, constructor_args=constructor_args, interface_codes=interface_codes, **kwargs)


@pytest.fixture
def assert_tx_failed(tester):
    def assert_tx_failed(function_to_test, exception=TransactionFailed):
        snapshot_id = tester.take_snapshot()
        with pytest.raises(exception):
            function_to_test()
        tester.revert_to_snapshot(snapshot_id)
    return assert_tx_failed


@pytest.fixture
def LST_token(w3, get_contract):
    return create_contract(
        w3=w3,
        get_contract=get_contract,
        path='contracts/ERC20.v.py',
        constructor_args=['Lendroid Support Token', 'LST', 18, 12000000000]
    )


@pytest.fixture
def Lend_token(w3, get_contract):
    return create_contract(
        w3=w3,
        get_contract=get_contract,
        path='contracts/ERC20.v.py',
        constructor_args=['Test Lend Token', 'TLT', 18, 10000000000]
    )


@pytest.fixture
def Borrow_token(w3, get_contract):
    return create_contract(
        w3=w3,
        get_contract=get_contract,
        path='contracts/ERC20.v.py',
        constructor_args=['Test Borrow Token', 'TBT', 18, 10000000000]
    )


@pytest.fixture
def Malicious_token(w3, get_contract):
    return create_contract(
        w3=w3,
        get_contract=get_contract,
        path='contracts/ERC20.v.py',
        constructor_args=['Test Malicious Token', 'TMT', 18, 2],
        from_=w3.eth.maliciousUserAccount
    )


@pytest.fixture
def Protocol(w3, get_contract, LST_token):
    wd = os.path.dirname(os.path.realpath(__file__))
    with open(os.path.join(wd, os.pardir, 'contracts/ERC20.v.py')) as f:
        interface_codes = {
            'ERC20': {
                'type': 'vyper',
                'code': f.read()
            }
        }
    return create_contract(
        w3=w3,
        get_contract=get_contract,
        path='contracts/protocol.v.py',
        constructor_args=[LST_token.address],
        interface_codes=interface_codes
    )


@pytest.fixture
def random_salt(**kwargs):
    string_size = kwargs.pop('string_size', 32)
    assert isinstance(string_size, int)
    ran = random.randrange(10**80)
    myhex = "%064x" % ran
    #limit string to `string_size` characters
    myhex = myhex[:string_size]

    return myhex


@pytest.fixture
def zero_address():
    return Web3.toChecksumAddress('0x0000000000000000000000000000000000000000')


@pytest.fixture
def Signed_Kernel_hash():
    pass


@pytest.fixture
def Position(w3, Protocol, LST_token, Lend_token, Borrow_token, random_salt):
    Protocol.functions.set_token_support(Lend_token.address, True).transact({'from': w3.eth.defaultAccount})
    Protocol.functions.set_token_support(Borrow_token.address, True).transact({'from': w3.eth.defaultAccount})
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
    _transact_as_local_account(w3, w3.eth.lenderAccount, LST_token.functions.approve(Protocol.address, Web3.toWei('100', 'ether')))

    # set Lend token approval
    Lend_token.functions.mint(w3.eth.lenderAccount.address, Web3.toWei('100', 'ether')).transact({'from': w3.eth.defaultAccount})
    _transact_as_local_account(w3, w3.eth.lenderAccount, Lend_token.functions.approve(Protocol.address, Web3.toWei('100', 'ether')))
    # set Borrow token approval
    Borrow_token.functions.mint(w3.eth.borrowerAccount.address, Web3.toWei('100', 'ether')).transact({'from': w3.eth.defaultAccount})
    _transact_as_local_account(w3, w3.eth.borrowerAccount, Borrow_token.functions.approve(Protocol.address, Web3.toWei('100', 'ether')))
    # approve wrangler
    Protocol.functions.set_wrangler_status(w3.eth.wranglerAccount.address, True).transact({'from': w3.eth.defaultAccount})
    # prepare signed kernel hash
    kernel_hash = Protocol.functions.kernel_hash(
      [
        w3.eth.lenderAccount.address, ZERO_ADDRESS, w3.eth.relayerAccount.address, w3.eth.wranglerAccount.address, Borrow_token.address, Lend_token.address
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
      Web3.toInt(1)
    ).call()
    position_hash = Web3.soliditySha3(['bytes32', 'bytes32'], [Web3.toBytes(text='\x19Ethereum Signed Message:\n32'), position_hash])
    _signature = w3.eth.account.signHash(position_hash, private_key=w3.eth.wranglerAccount.privateKey)
    wrangler_signature = _signature.signature
    # prepare inputs for kernel fill
    wrangler_approval_expiry_timestamp = w3.eth.getBlock('latest').timestamp + wrangler_approval_duration_in_seconds
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
      Web3.toInt(1),
      kernel_daily_interest_rate,
      True,
      [
        kernel_expires_at, wrangler_approval_expiry_timestamp
      ],
      kernel_position_duration_in_seconds,
      kernel_creator_salt,
      kernel_creator_signature,
      wrangler_signature
    ).transact({'from': w3.eth.defaultAccount})
