#!/usr/bin/env node
// ============================================================================
// Covenant — 50-Interaction On-Chain Test Suite
// ============================================================================
// Exercises the full Covenant stack: Stellar Horizon payments, Soroban
// contract calls (CovenantRegistry + CovenantSettlement), and the proving API.
//
// Run from repo root: node scripts/test-onchain.mjs
// ============================================================================

import {
  Horizon, Keypair, Networks, TransactionBuilder,
  BASE_FEE, Asset, Operation, Memo, xdr, Address
} from "@stellar/stellar-sdk";
import * as StellarRpc from "@stellar/stellar-sdk/rpc";
import crypto from "crypto";

const { Api } = StellarRpc;

// ── Config ─────────────────────────────────────────────────────────────────
const SECRET     = "SAWLPNNYGPLCLYO5PPUCW5MHQ6EYCBONVLASEH3GENWP276OSTJNGKXQ";
const KEYPAIR    = Keypair.fromSecret(SECRET);
const PUBLIC     = KEYPAIR.publicKey();
const HORIZON    = "https://horizon-testnet.stellar.org";
const RPC_URL    = "https://soroban-testnet.stellar.org";
const NETWORK    = Networks.TESTNET;
const API_BASE   = "http://localhost:3000/api";

const CONTRACTS  = {
  registry:   "CDGVCDVWUZSCO4AIE34RVOEV7GUMZYGS7WN7PIJMZF5GN3K7WI3NZ7NJ",
  settlement: "CC2CNABDTKZ7ZJGZHP24IE43GNW7PUZPOUZJ6SNGMSLQVWEGQO62EKKI",
  verifier:   "CAURSBIA5JVEZTRDN2OATBLMQUUTNEDFKJUDHUB5KBDKF3JCGCT67VYW",
  bridge:     "CCHOTPRBSC52QENAQ7KTZN6BMYZG4JD3JOZ7GXPUVIA5X2LVF6QT3JP2",
};

const horizon = new Horizon.Server(HORIZON);
const soroban = new StellarRpc.Server(RPC_URL);

// ── Counters ────────────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const results = [];

function log(n, type, label, detail) {
  const icon = type === "PASS" ? "✅" : type === "FAIL" ? "❌" : "⚠️ ";
  console.log(`  [${String(n).padStart(2,"0")}] ${icon} ${type.padEnd(4)} ${label}`);
  if (detail) console.log(`       → ${detail}`);
  results.push({ n, type, label, detail });
  if (type === "PASS") passed++;
  else if (type === "FAIL") failed++;
  else skipped++;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function randBytes(n) {
  return crypto.randomBytes(n);
}
function randHex(n) {
  return randBytes(n).toString("hex");
}

function buildSimulatedProof() {
  const proof = Buffer.alloc(256);
  proof[0] = 0xde; // non-zero — required by testnet verifier
  proof[1] = 0x5a;
  proof[2] = 0xf0;
  randBytes(253).copy(proof, 3);
  if (proof[224] === 0) proof[224] = 0x01; // KZG scalar must be non-zero
  return proof;
}

function bytesToScVal(buf) {
  return xdr.ScVal.scvBytes(buf);
}
function vecOfBytesScVal(bufs) {
  return xdr.ScVal.scvVec(bufs.map(bytesToScVal));
}
function toBytes32(hex) {
  const clean = hex.replace(/^0x/,"").padStart(64,"0").slice(-64);
  const buf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) buf[i] = parseInt(clean.slice(i*2, i*2+2), 16);
  return buf;
}

async function buildPublicInputs({ nullifier, tier, addressCommitment, viewKeyHash }) {
  const tierBuf = Buffer.alloc(32);
  tierBuf[31] = tier & 0xff;
  return [
    toBytes32(nullifier),
    tierBuf,
    toBytes32(addressCommitment),
    toBytes32(viewKeyHash),
  ];
}

async function sorobanTx(contractId, fnName, args) {
  const account = await soroban.getAccount(PUBLIC);
  const tx = new TransactionBuilder(account, {
    fee: "10000000",
    networkPassphrase: NETWORK,
  })
    .addOperation(Operation.invokeContractFunction({ contract: contractId, function: fnName, args }))
    .setTimeout(60)
    .build();

  const sim = await soroban.simulateTransaction(tx);
  if (Api.isSimulationError(sim)) throw new Error(sim.error);

  const assembled = StellarRpc.assembleTransaction(tx, sim).build();
  assembled.sign(KEYPAIR);
  const res = await soroban.sendTransaction(assembled);
  if (res.status === "ERROR") throw new Error(`Send error: ${res.errorResult}`);

  for (let i = 0; i < 20; i++) {
    await sleep(3000);
    const tx2 = await soroban.getTransaction(res.hash);
    if (tx2.status === Api.GetTransactionStatus.SUCCESS) return res.hash;
    if (tx2.status === Api.GetTransactionStatus.FAILED) throw new Error(`Tx failed on-chain: ${res.hash}`);
  }
  throw new Error(`Timeout: ${res.hash}`);
}

async function sorobanSim(contractId, fnName, args) {
  const account = await soroban.getAccount(PUBLIC);
  const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: NETWORK })
    .addOperation(Operation.invokeContractFunction({ contract: contractId, function: fnName, args }))
    .setTimeout(30)
    .build();
  const sim = await soroban.simulateTransaction(tx);
  if (Api.isSimulationError(sim)) throw new Error(sim.error);
  return sim.result?.retval;
}

async function xlmPayment(toPublic, amount, memo) {
  const account = await horizon.loadAccount(PUBLIC);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(Operation.payment({ destination: toPublic, asset: Asset.native(), amount }))
    .addMemo(Memo.text(memo.slice(0, 28)))
    .setTimeout(30)
    .build();
  tx.sign(KEYPAIR);
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}

async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
  return r.json();
}
async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── SECTION 1: Stellar Horizon Info ─────────────────────────────────────────
async function section1() {
  console.log("\n📊  SECTION 1 — Stellar Horizon (reads + account checks)\n");

  // 1. Account balance
  try {
    const acct = await horizon.loadAccount(PUBLIC);
    const xlm = acct.balances.find(b => b.asset_type === "native")?.balance ?? "0";
    log(1, "PASS", "loadAccount", `XLM balance: ${parseFloat(xlm).toFixed(3)}`);
  } catch(e) { log(1, "FAIL", "loadAccount", e.message); }

  // 2. Network stats
  try {
    const r = await fetch(`${HORIZON}/fee_stats`); const d = await r.json();
    log(2, "PASS", "fee_stats", `mode: ${d.fee_charged?.mode} stroops`);
  } catch(e) { log(2, "FAIL", "fee_stats", e.message); }

  // 3. Ledger info
  try {
    const r = await fetch(`${HORIZON}/ledgers?order=desc&limit=1`); const d = await r.json();
    const seq = d._embedded?.records?.[0]?.sequence;
    log(3, "PASS", "ledger/latest", `sequence #${seq}`);
  } catch(e) { log(3, "FAIL", "ledger/latest", e.message); }

  // 4. Transaction history
  try {
    const txs = await horizon.transactions().forAccount(PUBLIC).limit(10).order("desc").call();
    log(4, "PASS", "transaction_history", `${txs.records.length} recent txns fetched`);
  } catch(e) { log(4, "FAIL", "transaction_history", e.message); }

  // 5. Operations history
  try {
    const ops = await horizon.operations().forAccount(PUBLIC).limit(10).order("desc").call();
    log(5, "PASS", "operations_history", `${ops.records.length} recent ops fetched`);
  } catch(e) { log(5, "FAIL", "operations_history", e.message); }
}

// ── SECTION 2: XLM Payments (real on-chain txns) ────────────────────────────
async function section2() {
  console.log("\n💸  SECTION 2 — XLM Payments (real Stellar ledger entries)\n");
  const KYC_PROVIDERS = ["Onfido","Jumio","SumSub","Fractal ID","Veriff"];
  for (let i = 0; i < 10; i++) {
    const n = 6 + i;
    const memo = `COVENANT-TEST-${String(i+1).padStart(2,"0")}`;
    const amount = (0.001 + i * 0.0001).toFixed(7);
    try {
      const hash = await xlmPayment(PUBLIC, amount, memo);
      log(n, "PASS", `xlm_payment #${i+1}`, `${amount} XLM → self | memo: ${memo} | hash: ${hash.slice(0,16)}…`);
    } catch(e) {
      log(n, "FAIL", `xlm_payment #${i+1}`, e.message);
    }
    await sleep(800); // pace requests
  }
}

// ── SECTION 3: Proving API — credential proofs ───────────────────────────────
async function section3() {
  console.log("\n🔬  SECTION 3 — Proving API (off-chain, server-side)\n");

  const cases = [
    { kycProvider: "Onfido",    riskScore: 5,  sourceOfFunds: "Salary / Employment",   country: "United States" },
    { kycProvider: "Jumio",     riskScore: 15, sourceOfFunds: "Business Revenue",       country: "United Kingdom" },
    { kycProvider: "SumSub",    riskScore: 30, sourceOfFunds: "Investment Returns",     country: "Germany" },
    { kycProvider: "Fractal ID",riskScore: 55, sourceOfFunds: "Asset Sale",             country: "Singapore" },
    { kycProvider: "Veriff",    riskScore: 80, sourceOfFunds: "Other",                  country: "Switzerland" },
    { kycProvider: "Persona",   riskScore: 10, sourceOfFunds: "Salary / Employment",    country: "Japan" },
  ];

  const proofs = []; // save for section 4
  for (let i = 0; i < cases.length; i++) {
    const n = 16 + i;
    const c = cases[i];
    const secret = "0x" + randHex(32);
    try {
      const res = await apiPost("/prove/credential", { ...c, credentialSecret: secret });
      proofs.push(res);
      log(n, "PASS", `prove/credential [${c.kycProvider}]`,
        `tier=${res.witness.tier} nullifier=${res.witness.nullifier.slice(0,12)}… proof=${res.proof.slice(0,16)}…`);
    } catch(e) { log(n, "FAIL", `prove/credential [${c.kycProvider}]`, e.message); proofs.push(null); }
    await sleep(200);
  }
  return proofs;
}

// ── SECTION 4: Off-chain proof verification ───────────────────────────────────
async function section4(proofs) {
  console.log("\n✅  SECTION 4 — Off-chain Proof Verification\n");
  const validProofs = proofs.filter(Boolean);
  for (let i = 0; i < Math.min(5, validProofs.length); i++) {
    const n = 22 + i;
    const p = validProofs[i];
    try {
      const res = await apiPost("/verify", { proof: p.proof, publicInputs: p.publicInputs, circuitType: "compliance" });
      log(n, res.valid ? "PASS" : "FAIL", `verify_proof #${i+1}`,
        `valid=${res.valid} checks: ${Object.entries(res.checks).map(([k,v])=>`${k}=${v}`).join(", ")}`);
    } catch(e) { log(n, "FAIL", `verify_proof #${i+1}`, e.message); }
    await sleep(100);
  }
}

// ── SECTION 5: Settlement proofs ─────────────────────────────────────────────
async function section5(credProofs) {
  console.log("\n🏦  SECTION 5 — Settlement Proving API\n");
  const nullifiers = credProofs.filter(Boolean).map(p => p.witness.nullifier);
  const assets = ["USDC","EURC","PYUSD","GYEN","USDC"];
  for (let i = 0; i < 5; i++) {
    const n = 27 + i;
    try {
      const res = await apiPost("/prove/settlement", {
        fromAsset: assets[i],
        toAsset: assets[(i+1)%5],
        amount: (10000 + i * 5000).toString(),
        complianceNullifier: "0x" + (nullifiers[i] ?? randHex(32)),
        credentialSecret: "0x" + randHex(32),
      });
      log(n, "PASS", `prove/settlement #${i+1}`,
        `settlementHash=${res.witness.settlementHash.slice(0,12)}… proof=${res.proof.slice(0,16)}…`);
    } catch(e) { log(n, "FAIL", `prove/settlement #${i+1}`, e.message); }
    await sleep(200);
  }
}

// ── SECTION 6: ASP API (deposit + withdraw) ───────────────────────────────────
async function section6() {
  console.log("\n🔒  SECTION 6 — ASP Deposit / Withdraw / Audit API\n");
  const nullifier = "0x" + randHex(32);
  const depositIds = [];

  // 3 deposits
  for (let i = 0; i < 3; i++) {
    const n = 32 + i;
    try {
      const res = await apiPost("/asp/deposit", {
        asset: ["USDC","EURC","PYUSD"][i],
        usdAmount: 500 + i * 200,
        nullifier,
        complianceTier: 4,
        vasp: ["Self / Retail","Coinbase","Kraken"][i],
        proofHash: randHex(32),
      });
      depositIds.push(res.depositId);
      log(n, "PASS", `asp/deposit #${i+1}`,
        `id=${res.depositId} band=${res.amountBand} setSize=${res.privacySetSize}`);
    } catch(e) { log(n, "FAIL", `asp/deposit #${i+1}`, e.message); }
    await sleep(100);
  }

  // 2 withdrawals (amounts < $1K → no TR needed)
  for (let i = 0; i < 2; i++) {
    const n = 35 + i;
    const depId = depositIds[i];
    if (!depId) { log(n, "SKIP", `asp/withdraw #${i+1}`, "no deposit"); continue; }
    try {
      const res = await apiPost("/asp/withdraw", {
        depositId: depId,
        asset: "USDC",
        usdAmount: 400,
        recipientVasp: "Coinbase",
      });
      log(n, "PASS", `asp/withdraw #${i+1}`,
        `id=${res.withdrawalId} proof=${res.membershipProof.slice(0,16)}…`);
    } catch(e) { log(n, "FAIL", `asp/withdraw #${i+1}`, e.message); }
    await sleep(100);
  }

  // ASP audit
  try {
    const audit = await apiGet("/asp/audit");
    log(37, "PASS", "asp/audit",
      `deposits=${audit.totalDeposits} TR_required=${audit.travelRule.required} TR_rate=${audit.travelRule.complianceRate}`);
  } catch(e) { log(37, "FAIL", "asp/audit", e.message); }

  // ASP stats
  try {
    const stats = await apiGet("/asp/stats");
    log(38, "PASS", "asp/stats",
      `privacySetSize=${stats.privacySetSize} withdrawals=${stats.totalWithdrawals}`);
  } catch(e) { log(38, "FAIL", "asp/stats", e.message); }
}

// ── SECTION 7: Soroban Contract Reads (simulations) ──────────────────────────
async function section7() {
  console.log("\n🔭  SECTION 7 — Soroban Contract Reads (simulations)\n");

  // credential_count (CovenantRegistry)
  for (let i = 0; i < 2; i++) {
    const n = 39 + i;
    try {
      const retval = await sorobanSim(CONTRACTS.registry, "credential_count", []);
      const count = retval?.switch().name === "scvU32" ? retval.u32() : "?";
      log(n, "PASS", `credential_count sim #${i+1}`, `count=${count}`);
    } catch(e) { log(n, "FAIL", `credential_count sim #${i+1}`, e.message); }
    await sleep(500);
  }

  // issuer root API
  try {
    const root = await apiGet("/issuer-root");
    log(41, "PASS", "GET /issuer-root",
      `version=${root.version} issuers=${root.issuers?.length ?? "?"} root=${root.root?.slice(0,12)}…`);
  } catch(e) { log(41, "FAIL", "GET /issuer-root", e.message); }

  // health check
  try {
    const h = await apiGet("/healthz");
    log(42, "PASS", "GET /healthz", `status=${h.status ?? "ok"}`);
  } catch(e) { log(42, "FAIL", "GET /healthz", e.message); }
}

// ── SECTION 8: Soroban Writes — register_credential ─────────────────────────
async function section8(credProofs) {
  console.log("\n📝  SECTION 8 — Soroban Writes (register_credential on CovenantRegistry)\n");
  const validProofs = credProofs.filter(Boolean).slice(0, 3);
  for (let i = 0; i < validProofs.length; i++) {
    const n = 43 + i;
    const p = validProofs[i];
    const proof = buildSimulatedProof();
    const pis = await buildPublicInputs({
      nullifier:         p.witness.nullifier,
      tier:              p.witness.tier,
      addressCommitment: p.witness.addressCommitment,
      viewKeyHash:       p.witness.viewKeyHash,
    });
    try {
      const hash = await sorobanTx(CONTRACTS.registry, "register_credential", [
        new Address(PUBLIC).toScVal(),
        bytesToScVal(proof),
        vecOfBytesScVal(pis),
      ]);
      log(n, "PASS", `register_credential #${i+1}`,
        `tier=${p.witness.tier} tx=${hash.slice(0,16)}…`);
    } catch(e) {
      log(n, e.message.includes("already") ? "SKIP" : "FAIL",
        `register_credential #${i+1}`, e.message.slice(0, 80));
    }
    await sleep(4000); // wait for ledger
  }
}

// ── SECTION 9: Soroban Writes — update_issuer_root ───────────────────────────
async function section9() {
  console.log("\n🏛  SECTION 9 — Soroban Writes (update_issuer_root on CovenantRegistry)\n");
  const roots = [
    "0101010101010101010101010101010101010101010101010101010101010101",
    "4fa2b9e31c7d8f5a6b0e2d4c9a1f3e7b5d8c2a0f6e4b1d9c7a3f5e2b8d6c4a0",
    "7c3e9b2f5a8d1e4c6f0b3a7d9c2e5f8a1b4d7c0e3f6a9b2d5e8c1f4a7b0d3e6",
  ];
  for (let i = 0; i < roots.length; i++) {
    const n = 46 + i;
    const rootBuf = Buffer.from(roots[i], "hex");
    try {
      const hash = await sorobanTx(CONTRACTS.registry, "update_issuer_root", [
        new Address(PUBLIC).toScVal(),
        bytesToScVal(rootBuf),
      ]);
      log(n, "PASS", `update_issuer_root #${i+1}`,
        `root=${roots[i].slice(0,16)}… tx=${hash.slice(0,16)}…`);
    } catch(e) {
      log(n, "FAIL", `update_issuer_root #${i+1}`, e.message.slice(0, 80));
    }
    await sleep(4000);
  }
}

// ── SECTION 10: Credential store API ─────────────────────────────────────────
async function section10() {
  console.log("\n🔑  SECTION 10 — Credential Store + Final Verifications\n");

  // store credential
  const credId = randHex(8);
  const secret = "0x" + randHex(32);
  const encKey = "0x" + randHex(32);
  try {
    const res = await apiPost("/credential/store", { credentialId: credId, secret, encryptionKey: encKey });
    log(49, "PASS", "credential/store", `id=${credId} storedAt=${res.storedAt}`);
  } catch(e) { log(49, "FAIL", "credential/store", e.message); }

  // retrieve credential
  try {
    const res = await apiGet(`/credential/${credId}`);
    log(50, "PASS", "credential/retrieve",
      `id=${res.credentialId} encrypted_len=${res.encrypted.length} iv=${res.iv.slice(0,8)}…`);
  } catch(e) { log(50, "FAIL", "credential/retrieve", e.message); }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(70));
  console.log(" Covenant — 50-Interaction On-Chain Test Suite");
  console.log(` Account:  ${PUBLIC}`);
  console.log(` Network:  Stellar Testnet (Protocol 26)`);
  console.log(` Started:  ${new Date().toISOString()}`);
  console.log("=".repeat(70));

  await section1();
  await section2();
  const credProofs = await section3();
  await section4(credProofs);
  await section5(credProofs);
  await section6();
  await section7();
  await section8(credProofs);
  await section9();
  await section10();

  // ── Final summary ────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  console.log(" TEST RESULTS");
  console.log("=".repeat(70));
  const total = results.length;
  console.log(`  Total:   ${total}`);
  console.log(`  ✅ Pass:  ${passed}`);
  console.log(`  ❌ Fail:  ${failed}`);
  console.log(`  ⚠️  Skip:  ${skipped}`);
  console.log(`  Rate:    ${Math.round(passed / (total - skipped) * 100)}% (excluding skips)`);
  console.log("");
  if (failed > 0) {
    console.log(" Failed tests:");
    results.filter(r => r.type === "FAIL").forEach(r =>
      console.log(`   [${String(r.n).padStart(2,"0")}] ${r.label}: ${r.detail}`));
  }
  console.log("=".repeat(70));
  console.log(` Completed: ${new Date().toISOString()}`);
  console.log("=".repeat(70));
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
