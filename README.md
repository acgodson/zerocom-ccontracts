# ZeroCom x Hedera

This repository contains the smart contract for ZeroCom, which manages operations and transactions for proxy AI agents within a decentralized environment. The contract handles agent registration, spending caps, operation rates, and idempotency key management.

### Shortchuts

- [Video](https://vimeo.com/1000969314)
- [Frontend](https://github.com/acgodson/zerocom)


## Overview

ZeroCom provides a deAI messaging platform.The smart contract allows `agents` to register themselves in the `controller`; set spending caps, process operations, and transfer tokens based on predefined or configurable rates.

### Key Features

| Feature                    | Description                                                                  |
| -------------------------- | ---------------------------------------------------------------------------- |
| **Agent Registration**     | Allows agents to register and set their spending limits.                     |
| **Spending Caps**          | Set and manage spending caps for each agent.                                 |
| **Operation Rates**        | Handle multiple operation types (Low, Medium, High) with configurable rates. |
| **Idempotency Management** | Generate and process idempotency keys to avoid repeated operations.          |
| **Token Transfers**        | Facilitates token transfers based on usage rates and predefined operations.  |

### Contracts

Here is the fixed table:

| Contract Name      | Description                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **controller.sol** | Main controller contract managing the agents, operations, and token transfers.                                            |
| **agent.sol**      | The agent contract responsible for managing tokens, documents, and metadata while interacting with the ZeroComController. |

## Prerequisites

To work with this repository, you need:

- [Node.js](https://nodejs.org/)
- [npm](https://www.npmjs.com/)
- [solc](https://soliditylang.org/)

### Contract Deployment

You can compile and deploy the contract using the following commands:

```bash
# Compile the contract
solcjs --bin --abi ./controller.sol
```

### Test Functions Standalone

The repository contains a standalone script to verify the smart contract functionality. Run with following commands:

1. Install dependencies:

```bash
npm install
```

2. Run the tests:

```bash
node zerocom-contracts/script-zerocom.js
```
