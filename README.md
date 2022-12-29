# Reloanr package with Lendroid protocol v1.0
The Reloanr package comprises the following tools. Please feel free to use them (in any combination) to deploy your own fixed-interest, p2p lending ecosystem.

## Smart contracts
Lendroid Protocol version 1.0

This project is built using the [Truffle Framework](https://truffleframework.com/docs/truffle/overview "Truffle overview"). The smart contracts, originally written in [Solidity](https://solidity.readthedocs.io, "Solidity ReadTheDocs"), have been migrated to [Vyper](https://vyper.readthedocs.io "Vyper ReadTheDocs"). The Vyper contracts have been tested using [Truper](https://github.com/maurelian/truper "Truper's github repo").

- [Github](https://github.com/lendroidproject/protocol.1.0)
- [Audit report](https://github.com/lendroidproject/protocol.1.0/blob/master/audit-report.pdf)
- [PoC](https://app.reloanr.com)

## Javascript library
Nodejs implementation for user interface to interact with the smart contracts.
- [Github](https://github.com/lendroidproject/lendroid-js)
## UI template
A base template of the user interface.
- [Github](https://github.com/lendroidproject/reloanr-ui)
## Kernel server
An API server implementation on Google Cloud (Python) for shared off-chain (lend / borrow) loan offers
- [Github](https://github.com/lendroidproject/kernel-server)
## Wrangler API server
An API server implementation on Google Cloud (Python) for a simple wrangler
- [Github](https://github.com/lendroidproject/pywrangler)

## How to use this repo

### Installation and setup
* Clone this repository

  `git clone <repo>`

* cd into the cloned repo

  `cd protocol.1.0`

* Install dependencies via npm

  `npm install`

* Install Vyper. Refer to [Vyper's installation instructions](https://vyper.readthedocs.io/en/latest/installing-vyper.html "Installing Vyper") for further reference

  * Python 3.6+ is a pre-requisite, and can be installed from [here](https://www.python.org/downloads "Python version downloads")

  * Install virtualenv from pip

    `pip install virtualenv` or `pip3 install virtualenv`

  * Create a virtual environment

    `virtualenv -p python3.6 --no-site-packages ~/vyper-venv`

### Test and development

* Open a new terminal (Terminal 1) and run the Ganache CLI here

  `ganache-cli`

* Open a second terminal (Terminal 2) and activate Vyper's virtual environment

  `source ~/vyper-venv/bin/activate`

* On Terminal 2, run the truper commmand to compile Vyper contracts. Refer [truper's github](https://github.com/maurelian/truper) to know more about the Truper tool

  `(vyper-venv) $ truper`

* Open a third terminal (Terminal 3) and run the tests using Truffle test suite

  `truffle test`

* To run tests using the Python test suite

    `pip install -r requirements.txt`

    `pytest`

_Note_: When the development / testing session ends, deactivate the virtualenv on Terminal 2: `(vyper-venv) $ deactivate`
