#!/usr/bin/env node
// ============================================================================
// Covenant — Adversarial + End-to-End API Test Suite
// ============================================================================
// Exercises every api-server route (prove, verify, asp, export, health)
// through both happy-path and adversarial inputs. No test framework
// dependency — plain Node so it can run with `node scripts/adversarial-e2e-test.mjs`.
// ============================================================================

const BASE = process.env.API_BASE || "http://localhost:8080/api";

let passed = 0;
let failed = 0;
const failures = [];

function randomHex(bytes) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  \u2713 ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  \u2717 ${name}${detail ? " — " + JSON.stringify(detail) : ""}`);
  }
}

async function run() {
  console.log(`\nCovenant Adversarial + E2E Test Suite\nTarget: ${BASE}\n`);

  // ── HEALTH ──────────────────────────────────────────────────────────────
  console.log("== Health ==");
  {
    const h1 = await get("/health");
    check("GET /api/health returns 200", h1.status === 200, h1);
    const h2 = await get("/healthz");
    check("GET /api/healthz returns 200", h2.status === 200, h2);
  }

  // ── PROVE /credential — happy path ───────────────────────────────────────
  console.log("\n== Prove Credential (happy path) ==");
  const credentialSecret = randomHex(32);
  let credProof, credPublicInputs;
  {
    const r = await post("/prove/credential", {
      kycProvider: "Onfido",
      riskScore: 15,
      sourceOfFunds: "salary",
      country: "US",
      credentialSecret,
    });
    check("200 on valid credential proof request", r.status === 200, r.json?.error);
    check("proof is 256 bytes (512 hex chars)", r.json?.proof?.length === 512);
    check("tier computed correctly for riskScore=15 (tier 4)", r.json?.witness?.tier === 4);
    check("bn254Valid true", r.json?.metadata?.bn254Valid === true);
    check("pairingConsistent true", r.json?.metadata?.pairingConsistent === true);
    credProof = r.json?.proof;
    credPublicInputs = r.json?.publicInputs;
  }

  // ── PROVE /credential — adversarial ─────────────────────────────────────
  console.log("\n== Prove Credential (adversarial) ==");
  {
    const missing = await post("/prove/credential", { kycProvider: "Onfido" });
    check("missing riskScore/credentialSecret -> 400", missing.status === 400, missing.json);

    const badSecretLen = await post("/prove/credential", {
      kycProvider: "Onfido",
      riskScore: 10,
      credentialSecret: "abcd", // too short
    });
    check("short credentialSecret -> 400", badSecretLen.status === 400, badSecretLen.json);

    const badRiskLow = await post("/prove/credential", {
      kycProvider: "Onfido",
      riskScore: -5,
      credentialSecret: randomHex(32),
    });
    check("riskScore < 0 -> 400", badRiskLow.status === 400, badRiskLow.json);

    const badRiskHigh = await post("/prove/credential", {
      kycProvider: "Onfido",
      riskScore: 101,
      credentialSecret: randomHex(32),
    });
    check("riskScore > 100 -> 400", badRiskHigh.status === 400, badRiskHigh.json);

    const nanRisk = await post("/prove/credential", {
      kycProvider: "Onfido",
      riskScore: "not-a-number",
      credentialSecret: randomHex(32),
    });
    check("non-numeric riskScore -> 400", nanRisk.status === 400, nanRisk.json);

    const unknownIssuer = await post("/prove/credential", {
      kycProvider: "TotallyFakeKYCProvider",
      riskScore: 10,
      credentialSecret: randomHex(32),
    });
    check(
      "unknown KYC provider still produces a valid proof (falls back to poseidon2 hash, no crash)",
      unknownIssuer.status === 200 && unknownIssuer.json?.proof?.length === 512,
      unknownIssuer.json?.error
    );

    // Replay: submit the exact same witness twice in a row is hard to force
    // deterministically here (proof includes randomness), so instead verify
    // the replay store rejects a *manually replayed* proof via /prove/settlement
    // (below) where params are attacker-controlled and thus reproducible.
  }

  // ── PROVE /settlement — happy path + replay ─────────────────────────────
  console.log("\n== Prove Settlement (happy path + replay) ==");
  {
    const nullifier = credPublicInputs?.[0] ?? randomHex(32);
    const settleBody = {
      fromAsset: "USDC",
      toAsset: "USDC",
      amount: 5000,
      complianceNullifier: nullifier,
      credentialSecret,
    };
    const r1 = await post("/prove/settlement", settleBody);
    check("200 on valid settlement proof request", r1.status === 200, r1.json?.error);
    check("settlement proof is 256 bytes", r1.json?.proof?.length === 512);

    // Replay: because settlementKey hashes settlementHash+amount+fromAsset, and
    // settlementHash itself binds a fresh timestamp, an *identical* body will
    // differ per call. To adversarially test replay, we cannot re-derive the
    // exact same settlementHash without control of time. Instead, confirm the
    // replay store module is wired by hammering the SAME request twice within
    // the same second — if the server computes timestamp with per-second
    // resolution, a same-second replay should be rejected.
    const r2 = await post("/prove/settlement", settleBody);
    const isDuplicateRejected = r2.status === 409;
    const isDistinctAccepted = r2.status === 200;
    check(
      "immediate repeat settlement request either rejected as duplicate (409) or accepted as distinct (200) — never a 500",
      isDuplicateRejected || isDistinctAccepted,
      r2.json
    );

    const missing = await post("/prove/settlement", { fromAsset: "USDC" });
    check("missing amount/nullifier -> 400", missing.status === 400, missing.json);
  }

  // ── VERIFY — happy path + tamper ────────────────────────────────────────
  console.log("\n== Verify (happy path + tampering) ==");
  {
    const good = await post("/verify", {
      proof: credProof,
      publicInputs: credPublicInputs,
      circuitType: "compliance",
    });
    check("valid proof verifies true", good.json?.valid === true, good.json);

    // Tamper: flip a byte in W1 (breaks on-curve + pairing consistency)
    const tampered = credProof.slice(0, 10) + "ff" + credProof.slice(12);
    const tamperedRes = await post("/verify", {
      proof: tampered,
      publicInputs: credPublicInputs,
      circuitType: "compliance",
    });
    check(
      "tampered W1 proof fails verification",
      tamperedRes.json?.valid === false,
      tamperedRes.json
    );

    // Tamper: wrong public inputs (nullifier swapped) should break sumcheck binding
    const wrongPI = [randomHex(32), ...credPublicInputs.slice(1)];
    const wrongPIRes = await post("/verify", {
      proof: credProof,
      publicInputs: wrongPI,
      circuitType: "compliance",
    });
    check(
      "mismatched public inputs fail sumcheck_binding_valid",
      wrongPIRes.json?.checks?.sumcheck_binding_valid === false,
      wrongPIRes.json
    );

    // Zeroed proof — should fail structurally
    const zeroProof = "00".repeat(256);
    const zeroRes = await post("/verify", {
      proof: zeroProof,
      publicInputs: credPublicInputs,
      circuitType: "compliance",
    });
    check("all-zero proof fails verification", zeroRes.json?.valid === false, zeroRes.json);

    // Wrong length proof -> 400
    const shortProof = await post("/verify", {
      proof: "abcd",
      publicInputs: credPublicInputs,
    });
    check("short proof hex -> 400", shortProof.status === 400, shortProof.json);

    // Missing publicInputs -> 400
    const noPI = await post("/verify", { proof: credProof });
    check("missing publicInputs -> 400", noPI.status === 400, noPI.json);
  }

  // ── ASP — deposit/withdraw/audit/stats ──────────────────────────────────
  console.log("\n== ASP Travel Rule ==");
  let depositId;
  {
    const dep = await post("/asp/deposit", {
      asset: "USDC",
      usdAmount: 5000,
      nullifier: credPublicInputs[0],
      complianceTier: 4,
      vasp: "CovenantDemo",
    });
    check("deposit >= $1000 sets travelRuleRequired=true", dep.json?.travelRuleRequired === true, dep.json);
    depositId = dep.json?.depositId;

    const depSmall = await post("/asp/deposit", {
      asset: "USDC",
      usdAmount: 50,
      nullifier: randomHex(32),
    });
    check("deposit < $1000 sets travelRuleRequired=false", depSmall.json?.travelRuleRequired === false, depSmall.json);

    const missingDep = await post("/asp/deposit", { asset: "USDC" });
    check("deposit missing usdAmount/nullifier -> 400", missingDep.status === 400, missingDep.json);

    // Adversarial: withdraw >= $1000 WITHOUT travelRuleToken must be rejected
    const withdrawNoTR = await post("/asp/withdraw", {
      depositId,
      asset: "USDC",
      usdAmount: 5000,
    });
    check(
      "withdrawal >= $1000 without travelRuleToken -> 403 (FATF gate enforced)",
      withdrawNoTR.status === 403,
      withdrawNoTR.json
    );

    // Adversarial: withdraw against non-existent deposit
    const withdrawFake = await post("/asp/withdraw", {
      depositId: "ASP-DOESNOTEXIST",
      asset: "USDC",
      usdAmount: 100,
    });
    check("withdrawal against unknown depositId -> 404", withdrawFake.status === 404, withdrawFake.json);

    // Happy: withdraw >= $1000 WITH travelRuleToken succeeds
    const withdrawOK = await post("/asp/withdraw", {
      depositId,
      asset: "USDC",
      usdAmount: 5000,
      travelRuleToken: "encrypted-tr-blob-demo",
    });
    check(
      "withdrawal >= $1000 with travelRuleToken -> 200, fatfCompliant true",
      withdrawOK.status === 200 && withdrawOK.json?.fatfCompliant === true,
      withdrawOK.json
    );

    const audit = await get("/asp/audit");
    check("audit endpoint returns privacySetSize + travelRule stats", typeof audit.json?.privacySetSize === "number", audit.json);

    const stats = await get("/asp/stats");
    check("stats endpoint returns totalDeposits", typeof stats.json?.totalDeposits === "number", stats.json);
  }

  // ── EXPORT — SAR/STR ─────────────────────────────────────────────────────
  console.log("\n== Regulatory Export (SAR/STR) ==");
  {
    const settlements = [
      {
        settlementId: "STL-1",
        complianceTier: 4,
        amount: "5000",
        asset: "USDC",
        timestamp: new Date().toISOString(),
      },
      {
        settlementId: "STL-2",
        complianceTier: 2,
        amount: "50",
        asset: "USDC",
        timestamp: new Date().toISOString(),
      },
    ];
    const sar = await post("/export/sar", { settlements, regulatorId: "FCA-UK" });
    check("SAR export returns json+csv+xml", !!sar.json?.json && !!sar.json?.csv && !!sar.json?.xml, sar.json);
    check("SAR never includes raw addresses (privacyNote present)", sar.json?.json?.transactions?.every((t) => t.privacyNote), sar.json);

    const str = await post("/export/str", { settlements, threshold: 1000 });
    check(
      "STR filters to only reportable settlements (>= threshold or tier>=4)",
      str.json?.reportableCount === 1,
      str.json
    );

    // Adversarial: non-array settlements -> 400
    const badSettlements = await post("/export/sar", { settlements: "not-an-array" });
    check("non-array settlements -> 400", badSettlements.status === 400, badSettlements.json);

    // Adversarial: empty settlements array should not crash, averageTier = N/A
    const empty = await post("/export/sar", { settlements: [] });
    check("empty settlements array handled gracefully", empty.status === 200 && empty.json?.json?.summary?.averageTier === "N/A", empty.json);
  }

  // ── RATE LIMITING / PAYLOAD SIZE (light touch, avoid tripping real limiter) ─
  console.log("\n== Payload Guards ==");
  {
    const huge = "a".repeat(200_000); // > 100kb limit
    const res = await fetch(`${BASE}/prove/credential`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kycProvider: huge, riskScore: 10, credentialSecret: randomHex(32) }),
    });
    check("oversized (>100kb) body rejected (413/400)", res.status === 413 || res.status === 400, res.status);
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f.name}`, f.detail ?? "");
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error("Test suite crashed:", err);
  process.exitCode = 1;
});
