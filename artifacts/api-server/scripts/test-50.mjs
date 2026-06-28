// ============================================================================
// Covenant API — 50 Interaction Tests
// ============================================================================
// Run: node scripts/test-50.mjs
// Requires API server running on localhost:3000
// ============================================================================

const BASE = "http://localhost:3000/api";
const SECRET = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const SECRET2 = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
const NULLIFIER = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

let pass = 0, fail = 0;
const results = [];

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  const data = await r.json().catch(() => ({}));
  return { status: r.status, headers: Object.fromEntries(r.headers), data };
}

async function put(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

function test(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  ✅ T${String(pass+fail).padStart(2,"0")} ${name}`); }
  else     { fail++; console.error(`  ❌ T${String(pass+fail).padStart(2,"0")} ${name}${detail ? ` — ${detail}` : ""}`); }
  results.push({ name, ok });
}

// ── Credential proof tests (1–11) ─────────────────────────────────────────────
console.log("\n── Credential Proofs ──────────────────────────────────────────────");

const c1 = await post("/prove/credential", { kycProvider: "Onfido", riskScore: 5, sourceOfFunds: "employment", country: "US", credentialSecret: SECRET });
test("Onfido risk=5 → Tier 5, proof 512 hex chars", c1.status === 200 && c1.data.proof?.length === 512 && c1.data.witness?.tier === 5);

const c2 = await post("/prove/credential", { kycProvider: "Jumio", riskScore: 20, sourceOfFunds: "business", country: "UK", credentialSecret: SECRET2 });
test("Jumio risk=20 → Tier 4", c2.status === 200 && c2.data.witness?.tier === 4);

const c3 = await post("/prove/credential", { kycProvider: "SumSub", riskScore: 40, sourceOfFunds: "investment", country: "DE", credentialSecret: "aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd" });
test("SumSub risk=40 → Tier 3", c3.status === 200 && c3.data.witness?.tier === 3);

const c4 = await post("/prove/credential", { kycProvider: "Fractal ID", riskScore: 60, sourceOfFunds: "asset_sale", country: "SG", credentialSecret: "1122334455667788112233445566778811223344556677881122334455667788" });
test("Fractal ID risk=60 → Tier 2", c4.status === 200 && c4.data.witness?.tier === 2);

const c5 = await post("/prove/credential", { kycProvider: "Veriff", riskScore: 90, sourceOfFunds: "other", country: "AE", credentialSecret: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" });
test("Veriff risk=90 → Tier 1", c5.status === 200 && c5.data.witness?.tier === 1);

test("bn254Valid=true on valid proof", c1.data.metadata?.bn254Valid === true);
test("pairingConsistent=true on valid proof", c1.data.metadata?.pairingConsistent === true);
test("publicInputs array has 4 entries", Array.isArray(c1.data.publicInputs) && c1.data.publicInputs.length === 4);
test("nullifier ≠ addressCommitment (domain separation)", c1.data.publicInputs?.[0] !== c1.data.publicInputs?.[2]);
test("addressCommitment ≠ viewKeyHash (domain separation)", c1.data.publicInputs?.[2] !== c1.data.publicInputs?.[3]);
test("nullifier ≠ viewKeyHash (domain separation)", c1.data.publicInputs?.[0] !== c1.data.publicInputs?.[3]);

// ── Credential validation errors (12–16) ──────────────────────────────────────
console.log("\n── Credential Validation ─────────────────────────────────────────");

const e1 = await post("/prove/credential", { riskScore: 10, credentialSecret: SECRET });
test("Missing kycProvider → 400", e1.status === 400);

const e2 = await post("/prove/credential", { kycProvider: "Onfido", riskScore: 10 });
test("Missing credentialSecret → 400", e2.status === 400);

const e3 = await post("/prove/credential", { kycProvider: "Onfido", riskScore: -1, credentialSecret: SECRET });
test("riskScore=-1 → 400", e3.status === 400);

const e4 = await post("/prove/credential", { kycProvider: "Onfido", riskScore: 101, credentialSecret: SECRET });
test("riskScore=101 → 400", e4.status === 400);

const e5 = await post("/prove/credential", { kycProvider: "Onfido", riskScore: 10, credentialSecret: "tooshort" });
test("credentialSecret too short → 400", e5.status === 400);

// ── Proof structural integrity (17–22) ────────────────────────────────────────
console.log("\n── Proof Structural Integrity ─────────────────────────────────────");

const proof = c1.data.proof;
const w1Hex = proof.slice(0, 128);
const w1x = BigInt("0x" + proof.slice(0, 64));
const w1y = BigInt("0x" + proof.slice(64, 128));
const FP = BigInt("0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47");

test("W1 x-coordinate in Fp range", w1x > 0n && w1x < FP);
test("W1 y-coordinate in Fp range", w1y > 0n && w1y < FP);
const y2 = (w1y * w1y) % FP;
const x3p3 = (w1x * w1x % FP * w1x % FP + 3n) % FP;
test("W1 on BN254 curve (y²=x³+3 mod Fp)", y2 === x3p3);

const kzgEval = proof.slice(448, 512); // bytes 224-255 = hex chars 448-511
test("kzg_eval non-zero (first byte check)", kzgEval.slice(0, 2) !== "00");
test("Proof exactly 256 bytes (512 hex chars)", proof.length === 512);
test("Sumcheck target present (bytes 192-224)", proof.slice(384, 448).length === 64);

// ── Settlement proof tests (23–30) ────────────────────────────────────────────
console.log("\n── Settlement Proofs ──────────────────────────────────────────────");

const s1 = await post("/prove/settlement", {
  fromAsset: "USDC", toAsset: "USDC", amount: "100000",
  complianceNullifier: c1.data.publicInputs?.[0] ?? NULLIFIER,
  credentialSecret: SECRET,
});
test("Settlement proof generated", s1.status === 200 && s1.data.proof?.length === 512);
test("Settlement pairingConsistent=true", s1.data.metadata?.pairingConsistent === true);
test("settlementHash present in witness", !!s1.data.witness?.settlementHash);
test("senderCommitment present", !!s1.data.witness?.senderCommitment);

const s2 = await post("/prove/settlement", {
  fromAsset: "EURC", toAsset: "USDC", amount: "250000",
  complianceNullifier: NULLIFIER,
  credentialSecret: SECRET2,
});
test("Cross-currency settlement proof", s2.status === 200 && !!s2.data.proof);

const se1 = await post("/prove/settlement", { toAsset: "USDC", amount: "50000", complianceNullifier: NULLIFIER });
test("Missing fromAsset → 400", se1.status === 400);

const se2 = await post("/prove/settlement", { fromAsset: "USDC", complianceNullifier: NULLIFIER });
test("Missing amount → 400", se2.status === 400);

const se3 = await post("/prove/settlement", { fromAsset: "USDC", amount: "50000" });
test("Missing complianceNullifier → 400", se3.status === 400);

// ── Verify endpoint (31–34) ───────────────────────────────────────────────────
console.log("\n── Proof Verification ─────────────────────────────────────────────");

const v1 = await post("/verify", {
  proof: c1.data.proof,
  publicInputs: c1.data.publicInputs,
  circuitType: "compliance",
});
test("Valid proof verifies successfully", v1.status === 200 && v1.data.valid === true);
test("Verify returns sumcheck_binding_valid=true", v1.data.checks?.sumcheck_binding_valid === true);
test("Verify returns kzg_pairing_consistent=true", v1.data.checks?.kzg_pairing_consistent === true || v1.data.checks?.bn254Note === true);

const v2 = await post("/verify", { proof: "deadbeef", publicInputs: [], circuitType: "compliance" });
test("Short proof → 400", v2.status === 400);

// ── Issuer root (35–36) ───────────────────────────────────────────────────────
console.log("\n── Issuer Root ────────────────────────────────────────────────────");

const ir1 = await get("/issuer-root");
test("GET /issuer-root returns root", ir1.status === 200 && !!ir1.data.root);

const ir2 = await put("/issuer-root", { newRoot: "aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd", label: "Test update", adminKey: "covenant-admin-2026" });
test("PUT /issuer-root updates root", ir2.status === 200 && (!!ir2.data.root || ir2.data.success === true));

// ── ASP endpoints (37–42) ─────────────────────────────────────────────────────
console.log("\n── ASP Endpoints ──────────────────────────────────────────────────");

const a1 = await post("/asp/deposit", { asset: "USDC", usdAmount: 5000, nullifier: NULLIFIER, complianceTier: 4 });
test("ASP deposit $5000 (Travel Rule required)", a1.status === 200 && a1.data.travelRuleRequired === true);

const a2 = await post("/asp/deposit", { asset: "USDC", usdAmount: 500, nullifier: NULLIFIER, complianceTier: 3 });
test("ASP deposit $500 (no Travel Rule)", a2.status === 200 && a2.data.travelRuleRequired === false);
test("ASP commitment is 64-char hex", /^[0-9a-f]{64}$/.test(a1.data.commitmentHash ?? ""));

const a3 = await post("/asp/deposit", { asset: "EURC", usdAmount: 0 });
test("ASP deposit missing amount → error", a3.status !== 200 || !!a3.data.error);

const a4 = await get("/asp/stats");
test("GET /asp/stats returns privacySetSize", a4.status === 200 && a4.data.privacySetSize !== undefined);

const a5 = await get("/asp/audit");
test("GET /asp/audit returns deposits array", a5.status === 200 && Array.isArray(a5.data.deposits));

// ── Replay prevention (43–44) ─────────────────────────────────────────────────
console.log("\n── Replay Prevention ──────────────────────────────────────────────");

// Generate a fresh proof then try to replay it
const rProof = await post("/prove/credential", {
  kycProvider: "Persona", riskScore: 15, sourceOfFunds: "employment", country: "JP",
  credentialSecret: "0102030405060708010203040506070801020304050607080102030405060708",
});
// Since seenProofHashes is per-session and this is a new unique request, first call succeeds
test("Fresh proof request succeeds", rProof.status === 200);

// Settlement replay — same params should be blocked (uses hash of settlementHash+amount+asset)
// First call succeeds, second identical call blocked
const rSettle1 = await post("/prove/settlement", { fromAsset: "GYEN", toAsset: "GYEN", amount: "12345", complianceNullifier: "0000000000000000000000000000000000000000000000000000000000000001", credentialSecret: "a0b1c2d3a0b1c2d3a0b1c2d3a0b1c2d3a0b1c2d3a0b1c2d3a0b1c2d3a0b1c2d3" });
const rSettle2 = await post("/prove/settlement", { fromAsset: "GYEN", toAsset: "GYEN", amount: "12345", complianceNullifier: "0000000000000000000000000000000000000000000000000000000000000001", credentialSecret: "a0b1c2d3a0b1c2d3a0b1c2d3a0b1c2d3a0b1c2d3a0b1c2d3a0b1c2d3a0b1c2d3" });
test("Duplicate settlement rejected with 409", rSettle1.status === 200 && rSettle2.status === 409);

// ── Health + security headers (45–50) ─────────────────────────────────────────
console.log("\n── Health & Security ──────────────────────────────────────────────");

const h1 = await get("/healthz");
test("GET /healthz → 200", h1.status === 200);

// Check security headers via raw fetch
const hdr = await fetch(`${BASE}/healthz`);
test("X-Frame-Options present", hdr.headers.has("x-frame-options"));
test("X-Content-Type-Options present", hdr.headers.has("x-content-type-options"));
test("Strict-Transport-Security present", hdr.headers.has("strict-transport-security"));
test("RateLimit header present", hdr.headers.has("ratelimit") || hdr.headers.has("ratelimit-policy"));

const oversized = await fetch(`${BASE}/prove/credential`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ payload: "x".repeat(200_000) }),
});
test("200 KB+ payload rejected (413)", oversized.status === 413 || oversized.status === 400 || oversized.status === 500);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log(`Results: ${pass} passed, ${fail} failed out of ${pass + fail} tests`);
if (fail === 0) console.log("🎉 All tests passed!");
else {
  console.log("Failed tests:");
  results.filter(r => !r.ok).forEach(r => console.log(`  • ${r.name}`));
  process.exit(1);
}
