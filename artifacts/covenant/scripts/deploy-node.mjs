#!/usr/bin/env node
// ============================================================================
// Covenant — Soroban Contract Deployment (Node.js)
// Uses @stellar/stellar-sdk v16 Soroban RPC API
// ============================================================================

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  Keypair, Networks, TransactionBuilder, Operation, xdr, Address,
} from "@stellar/stellar-sdk";

import * as StellarRpc from "@stellar/stellar-sdk/rpc";

const { Api } = StellarRpc;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RPC_URL = "https://soroban-testnet.stellar.org";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK = Networks.TESTNET;
const SECRET = "SAWLPNNYGPLCLYO5PPUCW5MHQ6EYCBONVLASEH3GENWP276OSTJNGKXQ";
const keypair = Keypair.fromSecret(SECRET);
const PUBLIC = keypair.publicKey();
const server = new StellarRpc.Server(RPC_URL);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pollTx(hash, label) {
  process.stdout.write(`  ⏳ polling ${label}`);
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    try {
      const r = await server.getTransaction(hash);
      if (r.status === Api.GetTransactionStatus.SUCCESS) {
        console.log(` ✓ (${i + 1} polls)`);
        return r;
      }
      if (r.status === Api.GetTransactionStatus.FAILED) {
        throw new Error(`${label} FAILED`);
      }
    } catch (e) {
      if (e.message.includes("FAILED")) throw e;
    }
    process.stdout.write(".");
  }
  throw new Error(`${label} timed out`);
}

async function submitOp(ops, label, account) {
  const tx = new TransactionBuilder(account, { fee: "10000000", networkPassphrase: NETWORK });
  for (const op of ops) tx.addOperation(op);
  const built = tx.setTimeout(60).build();

  const sim = await server.simulateTransaction(built);
  if (Api.isSimulationError(sim)) throw new Error(`Sim failed (${label}): ${sim.error}`);

  const asm = StellarRpc.assembleTransaction(built, sim).build();
  asm.sign(keypair);

  console.log(`  → submit ${label}...`);
  const res = await server.sendTransaction(asm);
  if (res.status === "ERROR") throw new Error(`Send failed (${label}): ${JSON.stringify(res.errorResult)}`);

  return pollTx(res.hash, label);
}

async function uploadWasm(wasmPath, label) {
  const wasm = readFileSync(wasmPath);
  console.log(`\n📦 Upload ${label} (${wasm.length} bytes)`);
  const account = await server.getAccount(PUBLIC);
  const result = await submitOp([Operation.uploadContractWasm({ wasm })], `upload:${label}`, account);
  const rv = result.returnValue;
  if (!rv) throw new Error(`No return value from upload:${label}`);
  return Buffer.from(rv.bytes()).toString("hex");
}

async function deployContract(wasmHash, salt32) {
  const account = await server.getAccount(PUBLIC);
  const result = await submitOp(
    [Operation.createCustomContract({
      address: new Address(PUBLIC),
      wasmHash: Buffer.from(wasmHash, "hex"),
      salt: Buffer.from(salt32),
    })],
    `deploy:${wasmHash.slice(0, 8)}`,
    account
  );
  const rv = result.returnValue;
  if (!rv) throw new Error("No return value from deploy");
  return Address.fromScVal(rv).toString();
}

async function invokeInit(contractId, funcName, args, label) {
  const account = await server.getAccount(PUBLIC);
  console.log(`  🔧 init ${label}...`);
  try {
    await submitOp(
      [Operation.invokeContractFunction({ contract: contractId, function: funcName, args })],
      `init:${label}`,
      account
    );
    console.log(`  ✓ ${label} initialized`);
  } catch (e) {
    console.log(`  ⚠ ${label} init skipped: ${e.message.slice(0, 80)}`);
  }
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Covenant — Stellar Testnet Deployment");
  console.log(`  ${PUBLIC}`);
  console.log("═══════════════════════════════════════════");

  const xlm = await fetch(`${HORIZON_URL}/accounts/${PUBLIC}`)
    .then(r => r.json())
    .then(d => d.balances?.find(b => b.asset_type === "native")?.balance ?? "?");
  console.log(`\n  XLM: ${xlm}`);

  const wasmDir = join(ROOT, "target/wasm32-unknown-unknown/release");
  const WASMS = {
    ultrahonk_verifier:         join(wasmDir, "ultrahonk_verifier.wasm"),
    covenant_registry:          join(wasmDir, "covenant_registry.wasm"),
    covenant_settlement:        join(wasmDir, "covenant_settlement.wasm"),
    covenant_compliance_bridge: join(wasmDir, "covenant_compliance_bridge.wasm"),
  };

  for (const [n, p] of Object.entries(WASMS)) {
    if (!existsSync(p)) throw new Error(`WASM missing: ${p}`);
  }

  // ── Phase 1: Upload WASMs ──────────────────────────────────────
  console.log("\n═ Phase 1: Upload WASMs");
  const verifierHash  = await uploadWasm(WASMS.ultrahonk_verifier,         "UltraHonkVerifier");
  const registryHash  = await uploadWasm(WASMS.covenant_registry,           "CovenantRegistry");
  const settlementHash = await uploadWasm(WASMS.covenant_settlement,        "CovenantSettlement");
  const bridgeHash    = await uploadWasm(WASMS.covenant_compliance_bridge,  "ComplianceBridge");

  console.log("\n  WASM hashes:");
  console.log(`    verifier:   ${verifierHash}`);
  console.log(`    registry:   ${registryHash}`);
  console.log(`    settlement: ${settlementHash}`);
  console.log(`    bridge:     ${bridgeHash}`);

  // ── Phase 2: Deploy Contracts ───────────────────────────────────
  // Each contract needs a unique salt so multiple deploys work
  console.log("\n═ Phase 2: Deploy Contracts");
  const mkSalt = (label) => {
    const s = Buffer.alloc(32);
    Buffer.from(label).copy(s);
    return s;
  };

  console.log("\n📋 Deploy UltraHonkVerifier...");
  const verifierId   = await deployContract(verifierHash,   mkSalt("verifier_v1_covenant_2026"));
  console.log("\n📋 Deploy CovenantRegistry...");
  const registryId   = await deployContract(registryHash,   mkSalt("registry_v1_covenant_2026_"));
  console.log("\n📋 Deploy CovenantSettlement...");
  const settlementId = await deployContract(settlementHash, mkSalt("settlement_v1_covenant_202"));
  console.log("\n📋 Deploy ComplianceBridge...");
  const bridgeId     = await deployContract(bridgeHash,     mkSalt("bridge_v1_covenant_2026___"));

  console.log("\n  Contract IDs:");
  console.log(`    UltraHonkVerifier:  ${verifierId}`);
  console.log(`    CovenantRegistry:   ${registryId}`);
  console.log(`    CovenantSettlement: ${settlementId}`);
  console.log(`    ComplianceBridge:   ${bridgeId}`);

  // ── Phase 3: Initialize Contracts ──────────────────────────────
  console.log("\n═ Phase 3: Initialize");

  // UltraHonkVerifier.initialize(admin, compliance_vk: BytesN<128>, settlement_vk: BytesN<128>)
  await invokeInit(verifierId, "initialize", [
    new Address(PUBLIC).toScVal(),
    xdr.ScVal.scvBytes(Buffer.alloc(128, 1)),
    xdr.ScVal.scvBytes(Buffer.alloc(128, 2)),
  ], "UltraHonkVerifier");

  // CovenantRegistry.initialize(admin, issuer_root, sanction_root, vk)
  await invokeInit(registryId, "initialize", [
    new Address(PUBLIC).toScVal(),
    xdr.ScVal.scvBytes(Buffer.alloc(32, 1)),  // trusted_issuer_root (governance)
    xdr.ScVal.scvBytes(Buffer.alloc(32, 2)),  // negative_screening_root
    xdr.ScVal.scvBytes(Buffer.alloc(32, 3)),  // vk hash
  ], "CovenantRegistry");

  // CovenantSettlement.initialize(admin, registry, verifier, min_tier)
  await invokeInit(settlementId, "initialize", [
    new Address(PUBLIC).toScVal(),
    new Address(registryId).toScVal(),
    new Address(verifierId).toScVal(),
    xdr.ScVal.scvU32(2),
  ], "CovenantSettlement");

  // ComplianceBridge.initialize(admin, settlement_contract, min_tier)
  await invokeInit(bridgeId, "initialize", [
    new Address(PUBLIC).toScVal(),
    new Address(settlementId).toScVal(),
    xdr.ScVal.scvU32(2),
  ], "ComplianceBridge");

  // ── Save contract IDs ─────────────────────────────────────────
  const ids = {
    network: "testnet",
    deployer: PUBLIC,
    deployed_at: new Date().toISOString(),
    contracts: {
      ultrahonk_verifier: verifierId,
      covenant_registry: registryId,
      covenant_settlement: settlementId,
      covenant_compliance_bridge: bridgeId,
    },
  };

  writeFileSync(join(ROOT, "contract-ids.json"), JSON.stringify(ids, null, 2));
  writeFileSync(join(ROOT, "public/contract-ids.json"), JSON.stringify(ids, null, 2));
  console.log("\n  📄 contract-ids.json written");

  console.log("\n═══════════════════════════════════════════");
  console.log("  ✓ DEPLOYMENT COMPLETE");
  console.log(`  Registry:   ${registryId}`);
  console.log(`  Settlement: ${settlementId}`);
  console.log(`  Verifier:   ${verifierId}`);
  console.log(`  Bridge:     ${bridgeId}`);
  console.log(`\n  Stellar Expert: https://stellar.expert/explorer/testnet/account/${PUBLIC}`);
  console.log("═══════════════════════════════════════════");
}

main().catch(e => { console.error("\n✗ DEPLOY FAILED:", e.message); process.exit(1); });
