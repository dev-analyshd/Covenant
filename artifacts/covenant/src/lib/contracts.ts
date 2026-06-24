// ============================================================================
// Covenant — Soroban Contract IDs & On-Chain Helpers
// ============================================================================
// All 4 contracts deployed to Stellar testnet via Protocol 26.
//
// Proof system: Noir UltraHonk (BN254 — Protocol 26 host functions)
// NOTE on curve: Stellar Protocol 26 adds bn254_add, bn254_mul, bn254_pairing
// host functions. Noir/Barretenberg uses BN254 (not BLS12-381). This is the
// correct curve for UltraHonk/PLONK — do NOT confuse with Circom groth16
// which can use either curve. Covenant uses Noir + BN254 on Protocol 26.
// ============================================================================

import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  xdr,
  Address,
} from "@stellar/stellar-sdk";
import * as StellarRpc from "@stellar/stellar-sdk/rpc";
const { Api: RpcApi } = StellarRpc;

// ── Network config ──────────────────────────────────────────────────────────
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK = Networks.TESTNET;

// ── Soroban RPC server ───────────────────────────────────────────────────────
export const soroban = new StellarRpc.Server(RPC_URL);

// ── Testnet keypair (compromised — demo only, never use in production) ───────
export const DEMO_SECRET = "SAWLPNNYGPLCLYO5PPUCW5MHQ6EYCBONVLASEH3GENWP276OSTJNGKXQ";
export const DEMO_KEYPAIR = Keypair.fromSecret(DEMO_SECRET);
export const DEMO_PUBLIC = DEMO_KEYPAIR.publicKey();

// ── Contract IDs (updated by deploy-node.mjs after deployment) ───────────────
// These are populated after running: node scripts/deploy-node.mjs
// Fallback to empty strings = UI shows "Not Deployed" state gracefully
export const CONTRACTS = {
  ultrahonk_verifier: "",
  covenant_registry: "",
  covenant_settlement: "",
  covenant_compliance_bridge: "",
} as const;

// Dynamic — loaded from contract-ids.json if available
let _contractIds: typeof CONTRACTS | null = null;

export async function getContractIds(): Promise<typeof CONTRACTS> {
  if (_contractIds) return _contractIds;
  try {
    const resp = await fetch("/contract-ids.json");
    if (resp.ok) {
      const data = await resp.json();
      _contractIds = data.contracts as typeof CONTRACTS;
      return _contractIds;
    }
  } catch (_) {
    // file not found — contracts not yet deployed
  }
  return CONTRACTS;
}

// ── ZK Proof construction (simulated — Barretenberg in browser requires WASM) ─
// In production: use bb.js (Barretenberg WASM) to generate real UltraHonk proofs
// For testnet demo: construct structurally valid proof bytes (first byte != 0)
// The on-chain verifier checks proof[0] != 0 in testnet mode (see contracts/ultrahonk_verifier)
export function buildSimulatedProof(): Uint8Array {
  const proof = new Uint8Array(256);
  // First byte must be non-zero for testnet verifier to accept
  proof[0] = 0xde;
  // Fill remaining bytes with deterministic pseudo-random data
  // using crypto.getRandomValues for unpredictability (but not cryptographic security)
  crypto.getRandomValues(proof.subarray(1));
  return proof;
}

// ── Secure credential secret generation ────────────────────────────────────
// Uses Web Crypto API (SubtleCrypto) — NOT Math.random() or Date.now()
// This is the credential_secret private input to the Noir circuit.
// In production this would be derived from a user's wallet signing key.
export function generateCredentialSecret(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return "0x" + Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Public input construction ───────────────────────────────────────────────
// Matches the circuit's public output tuple: (nullifier, tier, address_commitment, view_key_hash)
// In production: derived from the actual Noir circuit execution
export function buildPublicInputs(params: {
  nullifier: string;
  tier: number;
  addressCommitment: string;
  viewKeyHash: string;
}): Uint8Array[] {
  const toBytes32 = (hex: string): Uint8Array => {
    const clean = hex.replace(/^0x/, "").padStart(64, "0").slice(-64);
    const arr = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      arr[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return arr;
  };

  // Tier is encoded as big-endian u32 in the last byte of a 32-byte field element
  const tierBytes = new Uint8Array(32);
  tierBytes[31] = params.tier & 0xff;

  return [
    toBytes32(params.nullifier),
    tierBytes,
    toBytes32(params.addressCommitment),
    toBytes32(params.viewKeyHash),
  ];
}

// ── XDR helpers ────────────────────────────────────────────────────────────
function bytesToScVal(bytes: Uint8Array): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.from(bytes));
}

function vecOfBytesToScVal(bytesArr: Uint8Array[]): xdr.ScVal {
  return xdr.ScVal.scvVec(bytesArr.map(bytesToScVal));
}

// ── Core Soroban transaction builder ───────────────────────────────────────
async function buildSorobanTx(
  contractId: string,
  functionName: string,
  args: xdr.ScVal[]
): Promise<string> {
  const account = await soroban.getAccount(DEMO_PUBLIC);

  const tx = new TransactionBuilder(account, {
    fee: "10000000",
    networkPassphrase: NETWORK,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: functionName,
        args,
      })
    )
    .setTimeout(60)
    .build();

  const sim = await soroban.simulateTransaction(tx);

  if (RpcApi.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  const assembled = StellarRpc.assembleTransaction(tx, sim).build();
  assembled.sign(DEMO_KEYPAIR);

  const result = await soroban.sendTransaction(assembled);
  if (result.status === "ERROR") {
    throw new Error(`Transaction failed: ${result.errorResult}`);
  }

  // Poll for confirmation
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const txResult = await soroban.getTransaction(result.hash);
    if (txResult.status === StellarRpc.GetTransactionStatus.SUCCESS) {
      return result.hash;
    }
    if (txResult.status === StellarRpc.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain`);
    }
  }

  throw new Error("Transaction confirmation timed out");
}

// ── Register Compliance Credential ─────────────────────────────────────────
// Calls: CovenantRegistry::register_credential(caller, proof, public_inputs)
// Returns: real Stellar transaction hash
export async function registerCredential(params: {
  nullifier: string;
  tier: number;
  addressCommitment: string;
  viewKeyHash: string;
}): Promise<string> {
  const ids = await getContractIds();
  if (!ids.covenant_registry) {
    throw new Error("CovenantRegistry not deployed — run: node scripts/deploy-node.mjs");
  }

  const proof = buildSimulatedProof();
  const publicInputs = buildPublicInputs(params);

  return buildSorobanTx(ids.covenant_registry, "register_credential", [
    new Address(DEMO_PUBLIC).toScVal(),
    bytesToScVal(proof),
    vecOfBytesToScVal(publicInputs),
  ]);
}

// ── Initiate Settlement (ZK-gated) ─────────────────────────────────────────
// Calls: CovenantSettlement::initiate_settlement(sender, proof, public_inputs,
//         asset, amount, recipient, encrypted_trail, view_key_hash)
// Returns: real Stellar transaction hash
export async function initiateSettlement(params: {
  settlementHash: string;
  senderCommitment: string;
  tier: number;
  viewKeyHash: string;
}): Promise<string> {
  const ids = await getContractIds();
  if (!ids.covenant_settlement) {
    throw new Error("CovenantSettlement not deployed — run: node scripts/deploy-node.mjs");
  }

  const proof = buildSimulatedProof();
  const publicInputs = buildPublicInputs({
    nullifier: params.settlementHash,
    tier: params.tier,
    addressCommitment: params.senderCommitment,
    viewKeyHash: params.viewKeyHash,
  });

  // Encrypted trail (64 bytes) — in production: encrypt(amount, recipient) with view key
  const encryptedTrail = new Uint8Array(64);
  crypto.getRandomValues(encryptedTrail);

  // For testnet demo: use our own account as both sender and recipient
  // Real settlement would route to counterparty
  const recipientAddr = DEMO_PUBLIC;

  // Asset: use DEMO_PUBLIC as placeholder asset address (XLM native SAC would be used in production)
  // For the demo we call with the admin key as asset address — the proof gating is what matters
  const assetAddr = DEMO_PUBLIC;

  return buildSorobanTx(ids.covenant_settlement, "initiate_settlement", [
    new Address(DEMO_PUBLIC).toScVal(),
    bytesToScVal(proof),
    vecOfBytesToScVal(publicInputs),
    new Address(assetAddr).toScVal(),
    xdr.ScVal.scvI128(
      new xdr.Int128Parts({ hi: xdr.Int64.fromString("0"), lo: xdr.Uint64.fromString("1") })
    ),
    new Address(recipientAddr).toScVal(),
    bytesToScVal(encryptedTrail),
    bytesToScVal(publicInputs[3]),
  ]);
}

// ── Query credential count ──────────────────────────────────────────────────
export async function queryCredentialCount(): Promise<number> {
  const ids = await getContractIds();
  if (!ids.covenant_registry) return 0;

  try {
    const account = await soroban.getAccount(DEMO_PUBLIC);
    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: NETWORK,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: ids.covenant_registry,
          function: "credential_count",
          args: [],
        })
      )
      .setTimeout(30)
      .build();

    const sim = await soroban.simulateTransaction(tx);
    if (!StellarRpc.Api.isSimulationError(sim) && sim.result) {
      const val = sim.result.retval;
      if (val.switch().name === "scvU32") {
        return val.u32();
      }
    }
  } catch (_) {
    // read-only query failure is non-critical
  }
  return 0;
}

// ── Verify credential on-chain ──────────────────────────────────────────────
export async function verifyCredentialOnChain(
  nullifierHex: string
): Promise<{ tier: number; expiry: number } | null> {
  const ids = await getContractIds();
  if (!ids.covenant_registry) return null;

  try {
    const nullifierBytes = new Uint8Array(32);
    const hex = nullifierHex.replace(/^0x/, "").padStart(64, "0");
    for (let i = 0; i < 32; i++) {
      nullifierBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }

    const account = await soroban.getAccount(DEMO_PUBLIC);
    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: NETWORK,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: ids.covenant_registry,
          function: "verify_credential",
          args: [bytesToScVal(nullifierBytes)],
        })
      )
      .setTimeout(30)
      .build();

    const sim = await soroban.simulateTransaction(tx);
    if (!StellarRpc.Api.isSimulationError(sim) && sim.result) {
      const tuple = sim.result.retval;
      if (tuple.switch().name === "scvVec") {
        const items = tuple.vec()!;
        const tier = items[0]?.u32() ?? 0;
        return { tier, expiry: 0 };
      }
    }
  } catch (_) {}
  return null;
}

// ── Update issuer Merkle root (admin governance) ────────────────────────────
// Calls: CovenantRegistry::update_issuer_root(admin, new_root)
// This is the on-chain governance for trusted issuer set management.
// In production: uses a multisig threshold or DAO vote to update the root.
export async function updateIssuerRoot(newRootHex: string): Promise<string> {
  const ids = await getContractIds();
  if (!ids.covenant_registry) {
    throw new Error("CovenantRegistry not deployed");
  }

  const rootBytes = new Uint8Array(32);
  const hex = newRootHex.replace(/^0x/, "").padStart(64, "0").slice(-64);
  for (let i = 0; i < 32; i++) {
    rootBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return buildSorobanTx(ids.covenant_registry, "update_issuer_root", [
    new Address(DEMO_PUBLIC).toScVal(),
    bytesToScVal(rootBytes),
  ]);
}
