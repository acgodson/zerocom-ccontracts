import {
  TransactionRecordQuery,
  TokenInfoQuery,
  AccountBalanceQuery,
  EntityIdHelper,
  TransferTransaction,
  ContractInfo,
  Hbar,
} from "@hashgraph/sdk";

export async function txRecQueryFcn(txId, client) {
  const recQuery = await new TransactionRecordQuery()
    .setTransactionId(txId)
    .setIncludeChildren(true)
    .execute(client);
  return recQuery;
}

export async function tokenQueryFcn(tkId, client) {
  let info = await new TokenInfoQuery().setTokenId(tkId).execute(client);
  return info;
}

export async function convertEVMtoHedera(evemaddress) {
  let info = await new ContractInfoQuery().convertEvmToHederaAddress(
    evemaddress
  );
  return info;
}

export async function balanceCheckerFcn(acId, tkId, client) {
  let balanceCheckTx = [];
  try {
    balanceCheckTx = await new AccountBalanceQuery()
      .setAccountId(acId)
      .execute(client);
    console.log(
      `- Balance of account ${acId}: ${balanceCheckTx.hbars.toString()} + ${balanceCheckTx.tokens._map.get(
        tkId.toString()
      )} unit(s) of token ${tkId}`
    );
  } catch {
    balanceCheckTx = await new AccountBalanceQuery()
      .setContractId(acId)
      .execute(client);
    console.log(
      `- Balance of contract ${acId}: ${balanceCheckTx.hbars.toString()} + ${balanceCheckTx.tokens._map.get(
        tkId.toString()
      )} unit(s) of token ${tkId}`
    );
  }
}

export function convert(hederaNativeAddress) {
  const { shard, realm, num } = EntityIdHelper.fromString(hederaNativeAddress);
  return EntityIdHelper.toSolidityAddress([shard, realm, num]);
}

export async function getContractIdFromEvmAddress(evmAddress) {
  const baseUrl = "https://testnet.mirrornode.hedera.com/api/v1/contracts";
  const url = `${baseUrl}/${evmAddress}`;

  try {
    const response = await fetch(url);

    // Handle any non-200 HTTP responses
    if (!response.ok) {
      throw new Error(
        `Error fetching data: ${response.status} ${response.statusText}`
      );
    }
    const data = await response.json();
    // Check if the contract_id is available in the response
    if (data.contract_id) {
      return data.contract_id;
    } else {
      throw new Error("Contract ID not found in the response");
    }
  } catch (error) {
    console.error("Failed to fetch contract ID:", error.message);
    return null;
  }
}

// tokenId,
// accountId,
// agentId,
// Number(amount),
// accountKey,
// client

export async function transferFtFcn(
  tId,
  senderId,
  receiverId,
  amount,
  senderKey,
  client
) {
  const tokenTransferTx = new TransferTransaction()
    .addTokenTransfer(tId, senderId, amount * -1)
    .addTokenTransfer(tId, receiverId, amount)
    .freezeWith(client);
  const tokenTransferSign = await tokenTransferTx.sign(senderKey);

  const tokenTransferSubmit = await tokenTransferSign.execute(client);
  await new Promise((resolve) => setTimeout(resolve, 4000));

  const tokenTransferRx = await tokenTransferSubmit.getReceipt(client);

  return [tokenTransferRx, tokenTransferTx];
}

export async function trfHBar(senderId, senderKey, client) {
  // Verify the account balance
  const accountBalance = await new AccountBalanceQuery()
    .setAccountId(senderId)
    .execute(client);

  console.log(
    "\nNew account balance is: " +
      accountBalance.hbars.toTinybars() +
      " tinybars."
  );

  //Transfer HBAR
  const sendHbarTx = await new TransferTransaction()
    .addHbarTransfer(senderId, Hbar.fromTinybars(-10_000_000_000))
    .addHbarTransfer("0.0.4704575", Hbar.fromTinybars(10_000_000_000)) //Receiving account
    .execute(client);

  // Verify the transaction reached consensus
  const transactionReceipt = await sendHbarTx.getReceipt(client);
  console.log(
    "\nThe transfer transaction from my account to the new account was: " +
      transactionReceipt.status.toString()
  );

  await new Promise((resolve) => setTimeout(resolve, 4000));

  return [transactionReceipt.status.toString()];
}
