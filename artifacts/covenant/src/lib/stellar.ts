import {
  Horizon,
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Asset,
  Operation,
  Memo,
} from "@stellar/stellar-sdk";

export const TESTNET_HORIZON = "https://horizon-testnet.stellar.org";
export const TESTNET_RPC = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;

export const COVENANT_KEYPAIR = Keypair.fromSecret(
  "SAWLPNNYGPLCLYO5PPUCW5MHQ6EYCBONVLASEH3GENWP276OSTJNGKXQ"
);
export const COVENANT_PUBLIC = COVENANT_KEYPAIR.publicKey();

export const server = new Horizon.Server(TESTNET_HORIZON);

export interface StellarAccount {
  id: string;
  sequence: string;
  balances: Array<{
    balance: string;
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
  }>;
  thresholds: { low_threshold: number; med_threshold: number; high_threshold: number };
  flags: { auth_required: boolean; auth_revocable: boolean; auth_clawback_enabled: boolean };
  last_modified_ledger: number;
}

export interface StellarTransaction {
  id: string;
  hash: string;
  created_at: string;
  source_account: string;
  fee_charged: string;
  operation_count: number;
  memo_type: string;
  memo?: string;
  successful: boolean;
  ledger: number;
}

export interface NetworkStats {
  fee_stats: {
    last_ledger: string;
    last_ledger_base_fee: string;
    ledger_capacity_usage: string;
    fee_charged: { max: string; min: string; mode: string; p10: string; p50: string; p90: string };
  };
  ledger: {
    sequence: number;
    closed_at: string;
    transaction_count: number;
    successful_transaction_count: number;
    failed_transaction_count: number;
    operation_count: number;
    base_fee_in_stroops: number;
  };
}

export async function fetchAccount(publicKey: string): Promise<StellarAccount> {
  const account = await server.loadAccount(publicKey);
  return account as unknown as StellarAccount;
}

export async function fetchTransactions(
  publicKey: string,
  limit = 20
): Promise<StellarTransaction[]> {
  const txs = await server.transactions().forAccount(publicKey).limit(limit).order("desc").call();
  return txs.records as unknown as StellarTransaction[];
}

export async function fetchNetworkStats(): Promise<NetworkStats> {
  const [feeStats, ledgerData] = await Promise.all([
    fetch(`${TESTNET_HORIZON}/fee_stats`).then((r) => r.json()),
    fetch(`${TESTNET_HORIZON}/ledgers?order=desc&limit=1`).then((r) => r.json()),
  ]);
  const ledger = ledgerData?._embedded?.records?.[0] ?? ledgerData?.records?.[0] ?? null;
  return { fee_stats: feeStats, ledger };
}

export async function fetchOperations(publicKey: string, limit = 30) {
  const ops = await server.operations().forAccount(publicKey).limit(limit).order("desc").call();
  return ops.records;
}

export async function buildPaymentTx(
  fromSecret: string,
  toPublic: string,
  amount: string,
  assetCode: string = "XLM",
  memo: string = ""
) {
  const fromKp = Keypair.fromSecret(fromSecret);
  const account = await server.loadAccount(fromKp.publicKey());

  const asset = assetCode === "XLM" ? Asset.native() : new Asset(assetCode, toPublic);

  const txBuilder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.payment({
      destination: toPublic,
      asset,
      amount,
    })
  );

  if (memo) {
    txBuilder.addMemo(Memo.text(memo.slice(0, 28)));
  }

  const tx = txBuilder.setTimeout(30).build();
  tx.sign(fromKp);
  return tx;
}

export async function submitTx(tx: any) {
  return server.submitTransaction(tx);
}

// ── Send a real XLM payment (used in settlement demos) ─────────────────────
export async function sendPayment(params: {
  toPublic: string;
  amount: string;
  memo?: string;
}): Promise<string> {
  const account = await server.loadAccount(COVENANT_PUBLIC);
  const txBuilder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.payment({
      destination: params.toPublic,
      asset: Asset.native(),
      amount: params.amount,
    })
  );
  if (params.memo) {
    txBuilder.addMemo(Memo.text(params.memo.slice(0, 28)));
  }
  const tx = txBuilder.setTimeout(30).build();
  tx.sign(COVENANT_KEYPAIR);
  const result = await server.submitTransaction(tx);
  return (result as any).hash as string;
}

export function formatXLM(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return n.toFixed(7);
}

export function shortKey(key: string): string {
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function explorerTx(hash: string) {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

export function explorerAccount(addr: string) {
  return `https://stellar.expert/explorer/testnet/account/${addr}`;
}

export function explorerContract(contractId: string) {
  return `https://stellar.expert/explorer/testnet/contract/${contractId}`;
}
