import {
  Client,
  AccountId,
  PrivateKey,
  TokenCreateTransaction,
  TokenAssociateTransaction,
  EntityIdHelper,
  TokenType,
  FileCreateTransaction,
  ContractCreateTransaction,
} from "@hashgraph/sdk";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet } from "@ethersproject/wallet";
import { ContractFactory, Contract } from "@ethersproject/contracts";
import { ethers } from "ethers";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import * as queries from "./utils/queries.js";
import {
  convert,
  getContractIdFromEvmAddress,
  transferFtFcn,
} from "./utils/queries.js";
import abi_ERC20 from "./utils/abi.ERC20.js";

dotenv.config();

async function createToken(client, operatorKey, accountId) {
  const tokenCreateTx = new TokenCreateTransaction()
    .setTransactionMemo(`Hello Future World token`)
    .setTokenType(TokenType.FungibleCommon)
    .setTokenName(`tUSDC coin`)
    .setTokenSymbol("tUSDC")
    .setDecimals(2)
    .setInitialSupply(1_000_000)
    .setTreasuryAccountId(accountId)
    .setFreezeDefault(false)
    .freezeWith(client);

  const tokenCreateTxSigned = await tokenCreateTx.sign(operatorKey);
  const tokenCreateTxSubmitted = await tokenCreateTxSigned.execute(client);
  const tokenCreateTxReceipt = await tokenCreateTxSubmitted.getReceipt(client);

  const tokenId = tokenCreateTxReceipt.tokenId;
  const tokenAddress = convert(tokenId.toString());

  return { tokenId, tokenAddress };
}

async function deployControllerContract(accountWallet, tokenAddress) {
  const controllerAbi = await fs.readFile(
    "./controller_sol_ZeroComController.abi",
    { encoding: "utf8" }
  );
  const controllerBytecode = await fs.readFile(
    "./controller_sol_ZeroComController.bin",
    { encoding: "utf8" }
  );

  const controllerFactory = new ContractFactory(
    controllerAbi,
    controllerBytecode,
    accountWallet
  );
  const controllerContract = await controllerFactory.deploy(tokenAddress);
  await controllerContract.deployTransaction.wait();

  return controllerContract;
}

async function deployAgentContract(accountWallet, controllerAddress) {
  const agentAbi = await fs.readFile("./agent_sol_ZeroComAgent.abi", {
    encoding: "utf8",
  });
  const agentBytecode = await fs.readFile("./agent_sol_ZeroComAgent.bin", {
    encoding: "utf8",
  });

  const agentFactory = new ContractFactory(
    agentAbi,
    agentBytecode,
    accountWallet
  );

  const agentContract = await agentFactory.deploy(controllerAddress, {
    gasLimit: 15000000,
  });
  await agentContract.deployTransaction.wait();

  return agentContract;
}

// Function to top up agent contract and grant allowance to the controller
async function topUpAgent(
  client,
  provider,
  accountId,
  accountWallet,
  agentId,
  agentAddress,
  controllerAddress,
  tokenAddress,
  tokenId,
  amount,
  operatorKey
) {
  const tokenContract = new Contract(tokenAddress, abi_ERC20, accountWallet);

  // STEP 2 ===================================
  console.log(`\nSTEP 2 ===================================\n`);
  console.log(`- Subscribe to Transfer events...\n`);

  tokenContract.on("Transfer", (from, to, amount, event) => {
    console.log(`\n-NEW TRANSFER EVENT: ====================`);
    console.log(`From: ${from}, To: ${to}, Amount: ${amount.toString()}`);
  });

  // STEP 3 ===================================
  console.log(`\nSTEP 3 ===================================\n`);
  console.log(
    `- Perform Transfers: (Treasury => Agent) + (A=>T) + (T=>A) & listen to events...\n`
  );

  await queries.balanceCheckerFcn(accountId, tokenId, client);
  await queries.balanceCheckerFcn(agentId, tokenId, client);

  //format token

  await new Promise((resolve) => setTimeout(resolve, 3000));

  // set up agent contract
  const agentAbi = await fs.readFile("./agent_sol_ZeroComAgent.abi", {
    encoding: "utf8",
  });

  const AgentContract = new Contract(agentAddress, agentAbi, accountWallet);

  // agent Intitialize
  let initAgent = await AgentContract.functions.initializeAgent(
    tokenAddress,
    "0x6d9eae5f89b1d7e0f3b8c0f1d9b3e7c1a0a9b5e1f9d4c8a6d7e8f0a9b5c6d7e8"
  );

  let initAgentTxn = await initAgent.wait();
  let initAgentTxnHash = initAgentTxn.transactionHash;
  console.log(`\n- Transfer status: ${initAgentTxn.status}`);
  console.log(`- https://hashscan.io/testnet/tx/${initAgentTxnHash}\n`);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  let [transferFtRx, transferFtTx] = await queries.transferFtFcn(
    tokenId,
    accountId,
    agentId,
    amount,
    operatorKey,
    client
  );
  console.log(`\n- Transfer1 status: ${transferFtRx.status}`);
  console.log(
    `- https://hashscan.io/testnet/transaction/${transferFtTx.transactionId}\n`
  );

  console.log(`Transferred ${amount} tokens to agent at ${agentId}`);

  await new Promise((resolve) => setTimeout(resolve, 3000));
}

async function main() {
  if (
    !process.env.ACCOUNT_ID ||
    !process.env.ACCOUNT_PRIVATE_KEY ||
    !process.env.RPC_URL
  ) {
    throw new Error("Please set required keys in .env file.");
  }

  const rpcUrl = process.env.RPC_URL;
  const accountKey = process.env.ACCOUNT_PRIVATE_KEY;
  const accountId = AccountId.fromString(process.env.ACCOUNT_ID);
  const operatorKey = PrivateKey.fromStringECDSA(accountKey);
  const rpcProvider = new JsonRpcProvider(rpcUrl);
  const accountWallet = new Wallet(accountKey, rpcProvider);
  const client = Client.forTestnet().setOperator(accountId, operatorKey);

  // transfer HBar
  // let x = await queries.trfHBar(accountId, operatorKey, client);
  // console.log(x);
  // return;

  console.log("Creating token...");
  // const { tokenId, tokenAddress } = await createToken(
  //   client,
  //   operatorKey,
  //   accountId
  // );
  // console.log("Token created at address:", tokenAddress);
  // 000000000000000000000000000000000047c209
  const tokenId = "0.0.4705149";
  const tokenAddress = "000000000000000000000000000000000047cb7d";

  console.log("Deploying controller contract...");
  const controllerContract = await deployControllerContract(
    accountWallet,
    tokenAddress
  );
  console.log(`Controller deployed at: ${controllerContract.address}`);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const controllerId = await getContractIdFromEvmAddress(
    controllerContract.address
  );
  console.log("Controller Hedera ID:", controllerId);

  console.log("Deploying agent contract...");

  const agentContract = await deployAgentContract(
    accountWallet,
    controllerContract.address
  );
  console.log(`Agent deployed at: ${agentContract.address}`);

  return;

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const agentId = await getContractIdFromEvmAddress(agentContract.address);

  console.log("Agent Hedera ID:", agentId);

  let tBal = 5_000;
  await topUpAgent(
    client,
    rpcProvider,
    accountId,
    accountWallet,
    agentId,
    agentContract.address,
    controllerContract.address,
    tokenAddress,
    tokenId,
    tBal,
    operatorKey
  );

  // now we return the tokens back to the account owner assuming a txn was processed
  let remittance = await controllerContract.functions.deductFee(
    agentContract.address,
    convert(accountId.toString()),
    tBal
  );

  let remittanceTxn = await remittance.wait();
  let remittanceTxnHash = remittanceTxn.transactionHash;
  console.log(`\n- Transfer status: ${remittanceTxn.status}`);
  console.log(`- https://hashscan.io/testnet/tx/${remittanceTxnHash}\n`);

  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export default main;
