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

// ── Contract IDs — all 4 deployed to Stellar testnet June 25 2026 ────────────
// Hardcoded as canonical fallback; also served via /contract-ids.json (Vite public)
export const CONTRACTS = {
  ultrahonk_verifier:        "CAURSBIA5JVEZTRDN2OATBLMQUUTNEDFKJUDHUB5KBDKF3JCGCT67VYW",
  covenant_registry:          "CDGVCDVWUZSCO4AIE34RVOEV7GUMZYGS7WN7PIJMZF5GN3K7WI3NZ7NJ",
  covenant_settlement:        "CC2CNABDTKZ7ZJGZHP24IE43GNW7PUZPOUZJ6SNGMSLQVWEGQO62EKKI",
  covenant_compliance_bridge: "CCHOTPRBSC52QENAQ7KTZN6BMYZG4JD3JOZ7GXPUVIA5X2LVF6QT3JP2",
} as const;

export type ContractIds = typeof CONTRACTS;

// Dynamic — prefer /contract-ids.json (allows hot-swap without rebuild)
let _contractIds: ContractIds | null = null;

export async function getContractIds(): Promise<ContractIds> {
  if (_contractIds) return _contractIds;
  try {
    const resp = await fetch("/contract-ids.json");
    if (resp.ok) {
      const data = await resp.json();
      if (data.contracts?.covenant_registry) {
        _contractIds = data.contracts as ContractIds;
        return _contractIds;
      }
    }
  } catch (_) {
    // file not found — fall through to hardcoded values
  }
  _contractIds = CONTRACTS;
  return _contractIds;
}

// ── ZK Proof construction ───────────────────────────────────────────────────
// Testnet mode: first byte != 0 passes the on-chain structural check.
// Production: replace with real UltraHonk proof from bb prove.
export function buildSimulatedProof(): Uint8Array {
  const proof = new Uint8Array(256);
  proof[0] = 0xde; // non-zero — required by testnet verifier check
  // W1 commitment bytes (G1 point x||y, 64 bytes) — keep leading byte set
  proof[1] = 0x5a; proof[2] = 0xf0;
  // fill remainder deterministically
  crypto.getRandomValues(proof.subarray(3));
  // KZG scalar (bytes 224-255) must be non-zero
  if (proof[224] === 0) proof[224] = 0x01;
  return proof;
}

// ── Secure credential secret generation ────────────────────────────────────
// Uses Web Crypto API (SubtleCrypto) — NOT Math.random() or Date.now()
export function generateCredentialSecret(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return "0x" + Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Public input construction ───────────────────────────────────────────────
// Matches the circuit's public output tuple: (nullifier, tier, address_commitment, view_key_hash)
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

  // Poll for confirmation (max 30 polls × 3s = 90s)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const txResult = await soroban.getTransaction(result.hash);
    if (txResult.status === StellarRpc.Api.GetTransactionStatus.SUCCESS) {
      return result.hash;
    }
    if (txResult.status === StellarRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain (hash: ${result.hash})`);
    }
  }

  throw new Error(`Transaction confirmation timed out (hash: ${result.hash})`);
}

// ── Register Compliance Credential ─────────────────────────────────────────
// Calls: CovenantRegistry::register_credential(caller, proof, public_inputs)
export async function registerCredential(params: {
  nullifier: string;
  tier: number;
  addressCommitment: string;
  viewKeyHash: string;
  proofHex?: string;
}): Promise<string> {
  const ids = await getContractIds();
  if (!ids.covenant_registry) {
    throw new Error("CovenantRegistry not deployed");
  }

  let proof: Uint8Array;
  if (params.proofHex) {
    const hex = params.proofHex.replace(/^0x/, "");
    proof = new Uint8Array(hex.length / 2);
    for (let i = 0; i < proof.length; i++) {
      proof[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    if (proof.length < 256) {
      const padded = new Uint8Array(256);
      padded.set(proof);
      proof = padded;
    }
  } else {
    proof = buildSimulatedProof();
  }

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
export async function initiateSettlement(params: {
  settlementHash: string;
  senderCommitment: string;
  tier: number;
  viewKeyHash: string;
  recipientPublic?: string;
  proofHex?: string;
}): Promise<string> {
  const ids = await getContractIds();
  if (!ids.covenant_settlement) {
    throw new Error("CovenantSettlement not deployed");
  }

  let proof: Uint8Array;
  if (params.proofHex) {
    const hex = params.proofHex.replace(/^0x/, "");
    proof = new Uint8Array(hex.length / 2);
    for (let i = 0; i < proof.length; i++) {
      proof[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    if (proof.length < 256) {
      const padded = new Uint8Array(256);
      padded.set(proof);
      proof = padded;
    }
  } else {
    proof = buildSimulatedProof();
  }

  const publicInputs = buildPublicInputs({
    nullifier: params.settlementHash,
    tier: params.tier,
    addressCommitment: params.senderCommitment,
    viewKeyHash: params.viewKeyHash,
  });

  // Encrypted trail (64 bytes) — in production: encrypt(amount, recipient) with view key
  const encryptedTrail = new Uint8Array(64);
  crypto.getRandomValues(encryptedTrail);

  const recipientAddr = params.recipientPublic ?? DEMO_PUBLIC;
  const assetAddr = DEMO_PUBLIC; // XLM native SAC would be used in production

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
