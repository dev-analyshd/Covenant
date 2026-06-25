#!/usr/bin/env node
// ============================================================================
// Covenant — Full Soroban Contract Deployment Script
// ============================================================================
// Compiles (assumes pre-compiled WASMs), uploads, instantiates, and
// initialises all 4 Covenant contracts on Stellar testnet.
//
// Run from repo root:  node scripts/deploy-contracts.mjs
//
// Outputs: writes new contract IDs to:
//   - artifacts/covenant/public/contract-ids.json
//   - artifacts/covenant/src/lib/contracts.ts  (CONTRACTS constant)
// ============================================================================

import {
  Keypair, Networks, TransactionBuilder, BASE_FEE,
  Operation, Address, xdr, Contract,
} from "@stellar/stellar-sdk";
import * as StellarRpc from "@stellar/stellar-sdk/rpc";
import { createHash, randomBytes } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const { Api } = StellarRpc;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Config ──────────────────────────────────────────────────────────────────
const SECRET  = "SAWLPNNYGPLCLYO5PPUCW5MHQ6EYCBONVLASEH3GENWP276OSTJNGKXQ";
const KEYPAIR = Keypair.fromSecret(SECRET);
const PUBLIC  = KEYPAIR.publicKey();
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK = Networks.TESTNET;

const soroban = new StellarRpc.Server(RPC_URL);

// ── WASM paths ───────────────────────────────────────────────────────────────
const WASM_DIR = join(ROOT, "artifacts/covenant/wasm");
const WASMS = {
  ultrahonk_verifier:        join(WASM_DIR, "ultrahonk_verifier.wasm"),
  covenant_registry:         join(WASM_DIR, "covenant_registry.wasm"),
  covenant_settlement:       join(WASM_DIR, "covenant_settlement.wasm"),
  covenant_compliance_bridge: join(WASM_DIR, "covenant_compliance_bridge.wasm"),
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function log(step, msg) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] ${step.padEnd(16)} ${msg}`);
}

/** Compute the Soroban WASM hash (SHA-256 of WASM bytes) */
function wasmHash(wasmBytes) {
  return createHash("sha256").update(wasmBytes).digest();
}

/** Submit a Soroban transaction and poll for confirmation */
async function submitAndConfirm(tx) {
  const send = await soroban.sendTransaction(tx);
  if (send.status === "ERROR") {
    throw new Error(`Send failed: ${send.errorResult?.toXDR("base64") ?? "unknown"}`);
  }
  log("  poll", `hash=${send.hash.slice(0, 16)}… status=${send.status}`);
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const status = await soroban.getTransaction(send.hash);
    if (status.status === "SUCCESS") {
      return { hash: send.hash, result: status.returnValue };
    }
    if (status.status === "FAILED") {
      throw new Error(`Tx FAILED: ${send.hash} — ${status.resultXdr?.toXDR?.("base64") ?? ""}`);
    }
    if (i % 5 === 4) log("  poll", `still waiting… attempt ${i + 1}/30`);
  }
  throw new Error(`Tx timeout: ${send.hash}`);
}

/** Build a Soroban tx, simulate, assemble, sign, and submit */
async function buildSimSign(ops) {
  const account = await soroban.getAccount(PUBLIC);
  let builder = new TransactionBuilder(account, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: NETWORK,
  }).setTimeout(60);
  for (const op of ops) builder = builder.addOperation(op);
  const tx = builder.build();

  const sim = await soroban.simulateTransaction(tx);
  if (!Api.isSimulationSuccess(sim)) {
    throw new Error(`Simulation failed: ${JSON.stringify(sim.error ?? sim.events)}`);
  }

  const prepared = StellarRpc.assembleTransaction(tx, sim).build();
  prepared.sign(KEYPAIR);
  return submitAndConfirm(prepared);
}

/** Upload a WASM to the Stellar network. Returns the wasm hash Buffer. */
async function uploadWasm(name, wasmBytes) {
  log("upload", `${name} (${wasmBytes.length} bytes)`);
  const hash = wasmHash(wasmBytes);
  log("upload", `wasm_hash=${hash.toString("hex").slice(0, 16)}…`);

  const op = Operation.uploadContractWasm({ wasm: wasmBytes });
  await buildSimSign([op]);
  log("upload", `✅ ${name} uploaded`);
  return hash;
}

/** Create a contract instance from a WASM hash. Returns the contract ID string. */
async function createContract(name, wasmHashBuf, salt) {
  log("create", `${name}`);
  const op = Operation.createCustomContract({
    address: Address.fromString(PUBLIC),
    wasmHash: wasmHashBuf,
    salt,
  });

  const { result } = await buildSimSign([op]);
  if (!result) throw new Error(`No return value from contract creation: ${name}`);

  // result is an xdr.ScVal of type address
  const contractAddress = Address.fromScAddress(result.address());
  const contractId = contractAddress.toString();
  log("create", `✅ ${name} => ${contractId}`);
  return contractId;
}

/** Invoke a contract method (state-changing, needs signing) */
async function invokeMethod(contractId, method, args, label) {
  log("invoke", `${label ?? method} on ${contractId.slice(0, 8)}…`);
  const contract = new Contract(contractId);
  const op = contract.call(method, ...args);
  const { hash } = await buildSimSign([op]);
  log("invoke", `✅ ${label ?? method} hash=${hash.slice(0, 16)}…`);
  return hash;
}

/** ScVal helpers */
function bytesN32(hex) {
  const buf = Buffer.from(hex.replace(/^0x/, "").padStart(64, "0"), "hex");
  return xdr.ScVal.scvBytes(buf);
}

function addrScVal(pubkey) {
  return xdr.ScVal.scvAddress(Address.fromString(pubkey).toScAddress());
}

// ── VK: SHA-256("covenant_v2.1_vk_compliance") ──────────────────────────────
// A deterministic verification key commitment for the compliance circuit.
const VK_HEX = createHash("sha256")
  .update("covenant_v2.1_vk_compliance_credential")
  .digest("hex");

// SHA-256("covenant_v2.1_issuer_root") — initial issuer Merkle root
const ISSUER_ROOT_HEX = createHash("sha256")
  .update("covenant_v2.1_initial_issuer_root")
  .digest("hex");

// SHA-256("covenant_v2.1_sanction_root") — initial sanction list root
const SANCTION_ROOT_HEX = createHash("sha256")
  .update("covenant_v2.1_initial_sanction_root")
  .digest("hex");

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(70));
  console.log(" Covenant Contract Deployment — Stellar Testnet");
  console.log(` Admin:    ${PUBLIC}`);
  console.log(` Network:  Stellar Testnet (soroban-sdk v22.x, Protocol 22)`);
  console.log(` WASM dir: ${WASM_DIR}`);
  console.log(` Started:  ${new Date().toISOString()}`);
  console.log("=".repeat(70));

  // Verify WASMs exist
  for (const [name, path] of Object.entries(WASMS)) {
    if (!existsSync(path)) {
      throw new Error(`WASM not found: ${path}\nRun compilation first.`);
    }
    log("verify", `${name}: ${readFileSync(path).length} bytes ✓`);
  }

  console.log("\n── STEP 1: Upload WASMs ─────────────────────────────────────────────\n");

  const verifierWasm  = readFileSync(WASMS.ultrahonk_verifier);
  const registryWasm  = readFileSync(WASMS.covenant_registry);
  const settlementWasm = readFileSync(WASMS.covenant_settlement);
  const bridgeWasm    = readFileSync(WASMS.covenant_compliance_bridge);

  const verifierHash   = await uploadWasm("ultrahonk_verifier", verifierWasm);
  const registryHash   = await uploadWasm("covenant_registry", registryWasm);
  const settlementHash = await uploadWasm("covenant_settlement", settlementWasm);
  const bridgeHash     = await uploadWasm("covenant_compliance_bridge", bridgeWasm);

  console.log("\n── STEP 2: Create Contract Instances ────────────────────────────────\n");

  // Use deterministic salts derived from contract name + version
  const verifierSalt   = createHash("sha256").update("ultrahonk_verifier_v2.1").digest();
  const registrySalt   = createHash("sha256").update("covenant_registry_v2.1").digest();
  const settlementSalt = createHash("sha256").update("covenant_settlement_v2.1").digest();
  const bridgeSalt     = createHash("sha256").update("covenant_compliance_bridge_v2.1").digest();

  const verifierId   = await createContract("ultrahonk_verifier",        verifierHash,   verifierSalt);
  const registryId   = await createContract("covenant_registry",          registryHash,   registrySalt);
  const settlementId = await createContract("covenant_settlement",         settlementHash, settlementSalt);
  const bridgeId     = await createContract("covenant_compliance_bridge",  bridgeHash,     bridgeSalt);

  console.log("\n── STEP 3: Initialize Contracts ─────────────────────────────────────\n");

  const vkScVal          = bytesN32(VK_HEX);
  const issuerRootScVal  = bytesN32(ISSUER_ROOT_HEX);
  const sanctionRootScVal = bytesN32(SANCTION_ROOT_HEX);
  const adminScVal       = addrScVal(PUBLIC);
  const registryAddrScVal = addrScVal(registryId);
  const settlementAddrScVal = addrScVal(settlementId);

  // Initialize UltraHonkVerifier
  await invokeMethod(
    verifierId, "initialize",
    [adminScVal, vkScVal],
    "verifier.initialize",
  );

  // Initialize CovenantRegistry
  await invokeMethod(
    registryId, "initialize",
    [adminScVal, vkScVal, issuerRootScVal, sanctionRootScVal],
    "registry.initialize",
  );

  // Initialize CovenantSettlement
  await invokeMethod(
    settlementId, "initialize",
    [adminScVal, registryAddrScVal, vkScVal],
    "settlement.initialize",
  );

  // Initialize ComplianceBridge
  await invokeMethod(
    bridgeId, "initialize",
    [adminScVal, registryAddrScVal, settlementAddrScVal, vkScVal],
    "bridge.initialize",
  );

  console.log("\n── STEP 4: Write Contract IDs ───────────────────────────────────────\n");

  const ids = {
    ultrahonk_verifier:        verifierId,
    covenant_registry:         registryId,
    covenant_settlement:       settlementId,
    covenant_compliance_bridge: bridgeId,
  };

  // Update public/contract-ids.json
  const contractIdsPath = join(ROOT, "artifacts/covenant/public/contract-ids.json");
  const contractIdsJson = {
    network: "testnet",
    deployed_at: new Date().toISOString(),
    contracts: ids,
  };
  writeFileSync(contractIdsPath, JSON.stringify(contractIdsJson, null, 2));
  log("write", `contract-ids.json updated`);

  // Update contracts.ts CONTRACTS constant
  const contractsTsPath = join(ROOT, "artifacts/covenant/src/lib/contracts.ts");
  let contractsTs = readFileSync(contractsTsPath, "utf8");
  contractsTs = contractsTs.replace(
    /export const CONTRACTS = \{[^}]+\} as const;/s,
    `export const CONTRACTS = {
  ultrahonk_verifier:        "${ids.ultrahonk_verifier}",
  covenant_registry:          "${ids.covenant_registry}",
  covenant_settlement:        "${ids.covenant_settlement}",
  covenant_compliance_bridge: "${ids.covenant_compliance_bridge}",
} as const;`,
  );
  writeFileSync(contractsTsPath, contractsTs);
  log("write", `contracts.ts updated`);

  // Update replit.md deployed contracts table
  const replitMdPath = join(ROOT, "replit.md");
  let replitMd = readFileSync(replitMdPath, "utf8");
  replitMd = replitMd.replace(
    /## Deployed Contracts \(Stellar Testnet\)[\s\S]*?\n\n/,
    `## Deployed Contracts (Stellar Testnet)

| Contract | ID |
|---|---|
| UltraHonkVerifier | \`${ids.ultrahonk_verifier}\` |
| CovenantRegistry | \`${ids.covenant_registry}\` |
| CovenantSettlement | \`${ids.covenant_settlement}\` |
| ComplianceBridge | \`${ids.covenant_compliance_bridge}\` |

`,
  );
  writeFileSync(replitMdPath, replitMd);
  log("write", `replit.md updated`);

  // Update test-onchain.mjs CONTRACTS constant
  const testScriptPath = join(ROOT, "scripts/test-onchain.mjs");
  let testScript = readFileSync(testScriptPath, "utf8");
  testScript = testScript.replace(
    /const CONTRACTS\s*=\s*\{[^}]+\};/s,
    `const CONTRACTS  = {
  registry:   "${ids.covenant_registry}",
  settlement: "${ids.covenant_settlement}",
  verifier:   "${ids.ultrahonk_verifier}",
  bridge:     "${ids.covenant_compliance_bridge}",
};`,
  );
  writeFileSync(testScriptPath, testScript);
  log("write", `test-onchain.mjs updated`);

  console.log("\n" + "=".repeat(70));
  console.log(" ✅  DEPLOYMENT COMPLETE");
  console.log("=".repeat(70));
  console.log(` UltraHonkVerifier:        ${ids.ultrahonk_verifier}`);
  console.log(` CovenantRegistry:          ${ids.covenant_registry}`);
  console.log(` CovenantSettlement:        ${ids.covenant_settlement}`);
  console.log(` ComplianceBridge:          ${ids.covenant_compliance_bridge}`);
  console.log("=".repeat(70));
  console.log(` VK (SHA-256 commitment):   ${VK_HEX}`);
  console.log(` Issuer root:               ${ISSUER_ROOT_HEX}`);
  console.log(` Sanction root:             ${SANCTION_ROOT_HEX}`);
  console.log("=".repeat(70));
  console.log("");
  console.log(" Next step: node scripts/test-onchain.mjs");
  console.log("=".repeat(70));

  return ids;
}

main().catch(err => {
  console.error("\n❌  DEPLOYMENT FAILED:", err.message);
  console.error(err.stack);
  process.exit(1);
});
