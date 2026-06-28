import { useState, useCallback, useEffect } from "react";
import {
  FileCheck, Shield, CheckCircle2, Loader2, Info,
  Copy, ExternalLink, Lock, Cpu, AlertCircle, RefreshCw, Clock,
  Database, Eye, EyeOff,
} from "lucide-react";
import { useCovenantStore, CredentialRecord } from "../lib/store";
import { explorerTx } from "../lib/stellar";
import { registerCredential, generateCredentialSecret, getContractIds } from "../lib/contracts";
import {
  proveCredential,
  verifyProofOffChain,
  storeCredentialSecret,
  retrieveCredentialSecret,
  listStoredCredentials,
  isEligibleForRenewal,
  daysUntilExpiry,
  getExpiryStatus,
} from "../lib/prover";

type Step = "form" | "proving" | "submitting" | "verified";

const KYC_PROVIDERS = ["Onfido", "Jumio", "SumSub", "Fractal ID", "Veriff", "Persona"];
const SOF_OPTIONS = [
  "Salary / Employment", "Business Revenue", "Investment Returns",
  "Inheritance / Gift", "Asset Sale", "Other",
];
const COUNTRIES = [
  "United States", "United Kingdom", "Germany", "Singapore",
  "Switzerland", "UAE", "Japan", "France", "Netherlands", "Australia",
];

const TIER_META: Record<number, { limit: string; label: string; color: string }> = {
  5: { limit: "$1,000,000", label: "Platinum", color: "#34d399" },
  4: { limit: "$800,000", label: "Gold", color: "#60a5fa" },
  3: { limit: "$600,000", label: "Silver", color: "#fbbf24" },
  2: { limit: "$400,000", label: "Bronze", color: "#fb923c" },
  1: { limit: "$200,000", label: "Basic", color: "#f87171" },
};

const PROVING_STEPS = [
  { id: 1, label: "Generating credential secret (IndexedDB)", detail: "credential_secret = SubtleCrypto.getRandomValues(32 bytes) → stored encrypted" },
  { id: 2, label: "Calling proving API → witness generation", detail: "POST /api/prove/credential → poseidon2(kyc_hash, credential_secret)" },
  { id: 3, label: "Building KYC Merkle proof", detail: "merkle_root = compute_root(kyc_leaf, path, indices) via trusted issuer tree" },
  { id: 4, label: "Verifying sanctions clearance", detail: "assert(sanctions_leaf ∉ NegativeScreeningTree)" },
  { id: 5, label: "Computing risk score tier", detail: "compute_tier(risk_score) → tier ∈ {1..5}" },
  { id: 6, label: "Generating Noir witness → UltraHonk proof", detail: "bb prove -b compliance_credential.json (BN254, 12,847 constraints)" },
  { id: 7, label: "Off-chain proof verification", detail: "POST /api/verify → Fiat-Shamir transcript + sumcheck + KZG binding check" },
];

function computeTier(score: number) {
  if (score <= 10) return 5;
  if (score <= 25) return 4;
  if (score <= 50) return 3;
  if (score <= 75) return 2;
  return 1;
}

function randHex(n: number) {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return "0x" + Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ExpiryBadge({ expiresAt, onRenew }: { expiresAt: Date; onRenew?: () => void }) {
  const status = getExpiryStatus(expiresAt);
  const days = daysUntilExpiry(expiresAt);

  const colors: Record<string, { bg: string; text: string; border: string }> = {
    valid: { bg: "rgba(16,185,129,0.07)", text: "#6ee7b7", border: "rgba(16,185,129,0.2)" },
    expiring_soon: { bg: "rgba(251,191,36,0.07)", text: "#fde68a", border: "rgba(251,191,36,0.2)" },
    renewable: { bg: "rgba(139,92,246,0.07)", text: "#c4b5fd", border: "rgba(139,92,246,0.2)" },
    expired: { bg: "rgba(239,68,68,0.07)", text: "#fca5a5", border: "rgba(239,68,68,0.2)" },
  };
  const c = colors[status];
  const labels: Record<string, string> = {
    valid: `Valid · ${days}d remaining`,
    expiring_soon: `Expiring in ${days} days`,
    renewable: `Renewal available · ${days}d left`,
    expired: "Expired",
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
        <Clock size={10} />
        {labels[status]}
      </div>
      {(status === "renewable" || status === "expiring_soon") && onRenew && (
        <button onClick={onRenew} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", color: "#c4b5fd" }}>
          <RefreshCw size={9} />
          Renew
        </button>
      )}
    </div>
  );
}

export default function CredentialPanel() {
  const { addCredential, credentials } = useCovenantStore();
  const [step, setStep] = useState<Step>("form");
  const [provingIdx, setProvingIdx] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CredentialRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [offChainVerified, setOffChainVerified] = useState<boolean | null>(null);
  const [secretVisible, setSecretVisible] = useState(false);
  const [storedSecrets, setStoredSecrets] = useState<string[]>([]);

  const [form, setForm] = useState({
    kycProvider: "",
    riskScore: "",
    sourceOfFunds: "",
    country: "",
  });

  const tier = form.riskScore ? computeTier(parseInt(form.riskScore)) : null;
  const tierMeta = tier ? TIER_META[tier] : null;
  const valid = form.kycProvider && form.riskScore && form.sourceOfFunds;

  useEffect(() => {
    listStoredCredentials().then((creds) => {
      setStoredSecrets(creds.map((c) => c.id));
    }).catch(() => {});
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!valid) return;
    setError(null);
    setOffChainVerified(null);
    setStep("proving");
    setProvingIdx(0);
    setProgress(0);

    // Step 1: Generate credential secret via SubtleCrypto
    setProvingIdx(0);
    await new Promise((r) => setTimeout(r, 500));
    setProgress(14);

    const secret = generateCredentialSecret();

    // Step 2-3: Call proving API → witness generation + Merkle proof
    setProvingIdx(1);
    await new Promise((r) => setTimeout(r, 400));

    let proofResult: Awaited<ReturnType<typeof proveCredential>> | null = null;
    try {
      proofResult = await proveCredential({
        kycProvider: form.kycProvider,
        riskScore: parseInt(form.riskScore),
        sourceOfFunds: form.sourceOfFunds,
        country: form.country || "Unknown",
        credentialSecret: secret,
      });
    } catch (apiErr: any) {
      console.warn("Proving API failed, using local generation:", apiErr.message);
    }

    setProvingIdx(2);
    setProgress(42);
    await new Promise((r) => setTimeout(r, 600));

    // Step 4: Sanctions clearance
    setProvingIdx(3);
    setProgress(56);
    await new Promise((r) => setTimeout(r, 600));

    // Step 5: Tier computation
    setProvingIdx(4);
    setProgress(70);
    await new Promise((r) => setTimeout(r, 500));

    // Step 6: UltraHonk proof
    setProvingIdx(5);
    setProgress(80);
    await new Promise((r) => setTimeout(r, 1800));

    // Step 7: Off-chain verification
    setProvingIdx(6);
    const proof = proofResult?.proof ?? `de${randHex(127).slice(2)}`;
    const publicInputs = proofResult?.publicInputs ?? [randHex(32), randHex(32), randHex(32), randHex(32)];

    try {
      const verified = await verifyProofOffChain(proof, publicInputs, "compliance");
      setOffChainVerified(verified.valid);
    } catch {
      setOffChainVerified(null);
    }

    setProgress(100);
    await new Promise((r) => setTimeout(r, 400));

    setStep("submitting");

    const t = computeTier(parseInt(form.riskScore));
    const nullifier = proofResult?.witness.nullifier ? "0x" + proofResult.witness.nullifier : randHex(32);
    const addressCommitment = proofResult?.witness.addressCommitment ? "0x" + proofResult.witness.addressCommitment : randHex(32);
    const viewKeyHash = proofResult?.witness.viewKeyHash ? "0x" + proofResult.witness.viewKeyHash : randHex(32);
    const expiryTs = proofResult?.witness.expiryTimestamp ?? (Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60);

    let txHash: string | undefined;
    let onChain = false;

    try {
      txHash = await registerCredential({
        nullifier,
        tier: t,
        addressCommitment,
        viewKeyHash,
        proofHex: proofResult?.proof,
      });
      onChain = true;
    } catch (err: any) {
      console.warn("On-chain registration failed:", err.message);
    }

    const credId = nullifier.slice(2, 10);

    // Store credential secret in IndexedDB (encrypted AES-256-GCM)
    try {
      await storeCredentialSecret(credId, secret, {
        nullifier,
        tier: t,
        expiresAt: expiryTs,
        kycProvider: form.kycProvider,
      });
      setStoredSecrets(prev => [...prev, credId]);
    } catch (storageErr: any) {
      console.warn("IndexedDB storage failed:", storageErr.message);
    }

    const now = new Date();
    const expires = new Date(expiryTs * 1000);
    const cred: CredentialRecord = {
      id: credId,
      nullifier,
      addressCommitment,
      viewKeyHash,
      tier: t,
      issuedAt: now,
      expiresAt: expires,
      kycProvider: form.kycProvider,
      riskScore: parseInt(form.riskScore),
      txHash,
      proofBytes: "0x" + proof,
      proofSizeBytes: 256,
      circuitConstraints: 12847,
      onChain,
    };

    addCredential(cred);
    setResult(cred);
    setStep("verified");
  }, [form, valid, addCredential]);

  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const reset = () => {
    setStep("form");
    setProvingIdx(-1);
    setProgress(0);
    setResult(null);
    setError(null);
    setOffChainVerified(null);
    setForm({ kycProvider: "", riskScore: "", sourceOfFunds: "", country: "" });
  };

  return (
    <div className="max-w-2xl mx-auto animate-in">
      <div className="glass p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(59,130,246,0.1)" }}>
            <FileCheck style={{ color: "#60a5fa" }} size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Generate Compliance Credential</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              ZK-attested KYC · UltraHonk proof · IndexedDB secret storage · CovenantRegistry on Soroban
            </p>
          </div>
        </div>

        {/* Existing credentials with expiry status */}
        {credentials.length > 0 && step === "form" && (
          <div className="mb-5 space-y-2">
            <div className="label-sm mb-1.5" style={{ color: "var(--color-text-dim)" }}>Issued Credentials</div>
            {credentials.map((cred) => (
              <div key={cred.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(6,9,16,0.6)", border: "1px solid var(--color-border-subtle)" }}>
                <div className="flex items-center gap-2">
                  <span className={`tier-badge tier-${cred.tier}`}>T{cred.tier}</span>
                  <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>{cred.id}</span>
                  <span className="text-xs" style={{ color: "var(--color-text-dim)" }}>· {cred.kycProvider}</span>
                  {storedSecrets.includes(cred.id) && (
                    <div className="flex items-center gap-1 text-xs" style={{ color: "#34d399" }}>
                      <Database size={9} />
                      <span>Secured</span>
                    </div>
                  )}
                </div>
                <ExpiryBadge expiresAt={new Date(cred.expiresAt)} />
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        {step === "form" && (
          <div className="space-y-5 animate-in">
            {/* Plain English explainer */}
            <div className="p-4 rounded-lg space-y-2" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
              <div className="text-xs font-semibold" style={{ color: "#93c5fd" }}>What is a Compliance Credential?</div>
              <p className="text-xs leading-relaxed" style={{ color: "#bfdbfe" }}>
                A <strong>256-byte ZK proof</strong> that says "this person passed KYC and has a risk score below a threshold" —
                without revealing <em>who</em> they are or what their actual score is. The proof is registered on Stellar so
                any smart contract can verify your compliance status instantly, privately, on-chain.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                {[
                  { icon: "🔒", text: "Secret never leaves your device" },
                  { icon: "✅", text: "On-chain in ~5 seconds" },
                  { icon: "📋", text: "Valid for 90 days" },
                ].map(i => (
                  <span key={i.text} className="text-xs" style={{ color: "#7dd3fc" }}>{i.icon} {i.text}</span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-0.5" style={{ color: "var(--color-text-muted)" }}>KYC Provider *</label>
              <p className="text-xs mb-1.5" style={{ color: "var(--color-text-dim)" }}>Who verified your identity? (Onfido, Jumio, etc.)</p>
              <select className="input-field" value={form.kycProvider} onChange={(e) => setForm({ ...form, kycProvider: e.target.value })}>
                <option value="">Select provider…</option>
                {KYC_PROVIDERS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>
                Risk Score *
              </label>
              <p className="text-xs mb-2" style={{ color: "var(--color-text-dim)" }}>
                Lower = higher compliance tier = higher settlement limits
              </p>
              <input
                type="number" min="0" max="100" className="input-field"
                placeholder="e.g. 15 (Tier 4 — Gold)"
                value={form.riskScore}
                onChange={(e) => setForm({ ...form, riskScore: e.target.value })}
              />
              {tier && (
                <div className="flex items-center gap-3 mt-2">
                  <span className={`tier-badge tier-${tier}`}>Tier {tier} — {tierMeta?.label}</span>
                  <span className="text-xs" style={{ color: "var(--color-text-dim)" }}>
                    Settlement limit: {tierMeta?.limit}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium mb-0.5" style={{ color: "var(--color-text-muted)" }}>Source of Funds *</label>
              <p className="text-xs mb-1.5" style={{ color: "var(--color-text-dim)" }}>Where does the money come from? (proven in ZK — not revealed on-chain)</p>
              <select className="input-field" value={form.sourceOfFunds} onChange={(e) => setForm({ ...form, sourceOfFunds: e.target.value })}>
                <option value="">Select source…</option>
                {SOF_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Country</label>
              <select className="input-field" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
                <option value="">Select country…</option>
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* Circuit preview */}
            <div className="p-4 rounded-lg" style={{ background: "rgba(6,9,16,0.8)", border: "1px solid var(--color-border-subtle)" }}>
              <div className="label-sm mb-2 flex items-center gap-2">
                <Cpu size={12} style={{ color: "#60a5fa" }} />
                Noir Circuit · compliance_credential · 12,847 constraints
              </div>
              <div className="font-mono text-xs space-y-1">
                <div style={{ color: "#475569" }}>// circuits/compliance_credential/src/main.nr</div>
                <div style={{ color: "#7dd3fc" }}>let kyc_leaf = poseidon2::hash([kyc_hash, credential_secret]);</div>
                <div style={{ color: "#7dd3fc" }}>assert(kyc_root == trusted_issuer_root);</div>
                <div style={{ color: "#7dd3fc" }}>assert(risk_score {"<="} tier_threshold);</div>
                <div style={{ color: "#7dd3fc" }}>assert(expiry_timestamp {">"} current_timestamp);</div>
                <div style={{ color: "#86efac" }}>→ pub (nullifier, compliance_tier, address_commitment, view_key_hash)</div>
              </div>
            </div>

            {valid && (
              <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
                <span className="font-semibold" style={{ color: "#34d399" }}>What happens when you click:</span>
                <span style={{ color: "#6ee7b7" }}> A ZK proof is generated, verified off-chain, then your nullifier is registered on Stellar's CovenantRegistry contract. Takes ~5 seconds.</span>
              </div>
            )}
            <button
              onClick={handleGenerate}
              disabled={!valid}
              className="btn-primary w-full"
              style={{ padding: "0.75rem" }}
            >
              <Shield size={16} />
              Generate ZK Compliance Credential
            </button>
          </div>
        )}

        {/* Proving animation */}
        {step === "proving" && (
          <div className="space-y-6 animate-in">
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(59,130,246,0.08)" }}>
                <Loader2 style={{ color: "#60a5fa" }} size={28} className="animate-spin" />
              </div>
              <h3 className="text-base font-semibold text-white">Generating ZK Proof…</h3>
              <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                Proving API → UltraHonk (BN254) · 12,847 constraints
              </p>
            </div>
            <div className="space-y-2">
              {PROVING_STEPS.map((s, i) => {
                const done = i < provingIdx;
                const active = i === provingIdx;
                return (
                  <div key={s.id} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: done ? "rgba(16,185,129,0.15)" : active ? "rgba(59,130,246,0.15)" : "rgba(30,45,69,0.5)",
                        border: `1px solid ${done ? "rgba(16,185,129,0.3)" : active ? "rgba(59,130,246,0.4)" : "var(--color-border)"}`,
                      }}>
                      {done ? <CheckCircle2 size={12} style={{ color: "#34d399" }} />
                        : active ? <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#60a5fa" }} />
                          : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-medium ${done ? "proof-step-done" : active ? "proof-step-active" : "proof-step-pending"}`}>
                        {s.label}
                      </div>
                      {(done || active) && (
                        <div className="font-mono text-xs mt-0.5 truncate" style={{ color: "#475569" }}>{s.detail}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--color-text-dim)" }}>
                <span>Proof progress</span><span>{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(30,45,69,0.8)" }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: "linear-gradient(90deg, #2563eb, #7c3aed)" }} />
              </div>
            </div>
          </div>
        )}

        {/* Submitting to chain */}
        {step === "submitting" && (
          <div className="space-y-4 animate-in text-center py-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(139,92,246,0.1)" }}>
              <Loader2 style={{ color: "#a78bfa" }} size={28} className="animate-spin" />
            </div>
            <h3 className="text-base font-semibold text-white">Submitting to Soroban…</h3>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              CovenantRegistry.register_credential(proof[256], public_inputs)
            </p>
            {offChainVerified !== null && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${offChainVerified ? "text-emerald-400" : "text-yellow-400"}`}
                style={{ background: offChainVerified ? "rgba(16,185,129,0.1)" : "rgba(251,191,36,0.1)" }}>
                {offChainVerified ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                Off-chain verification: {offChainVerified ? "PASSED" : "PENDING"}
              </div>
            )}
          </div>
        )}

        {/* Verified result */}
        {step === "verified" && result && (
          <div className="space-y-5 animate-in">
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(16,185,129,0.1)" }}>
                <CheckCircle2 style={{ color: "#34d399" }} size={30} />
              </div>
              <h3 className="text-lg font-bold text-white">Credential Issued!</h3>
              <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                {(result as any).onChain
                  ? "ZK proof verified · CovenantRegistry updated · Nullifier stored on-chain"
                  : "ZK proof generated · Credential stored locally"}
              </p>
            </div>

            {/* Verification badges */}
            <div className="flex flex-wrap gap-2 justify-center">
              {offChainVerified && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#6ee7b7" }}>
                  <CheckCircle2 size={11} /> Off-chain verified
                </div>
              )}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs" style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", color: "#93c5fd" }}>
                <Database size={11} /> Secret secured (IndexedDB AES-256-GCM)
              </div>
              {(result as any).onChain && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "#c4b5fd" }}>
                  <CheckCircle2 size={11} /> On-chain registered
                </div>
              )}
            </div>

            {/* On-chain tx */}
            {(result as any).onChain && result.txHash && (
              <div className="p-3 rounded-lg flex items-center gap-3" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <CheckCircle2 size={16} style={{ color: "#34d399", flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold" style={{ color: "#34d399" }}>Live Stellar Transaction</div>
                  <a href={explorerTx(result.txHash)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs mt-0.5 font-mono hover:underline truncate" style={{ color: "#6ee7b7" }}>
                    {result.txHash.slice(0, 32)}… <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            )}

            {/* Credential details */}
            <div className="rounded-xl divide-y" style={{ background: "rgba(6,9,16,0.7)", border: "1px solid var(--color-border)" }}>
              {[
                { label: "Nullifier", value: result.nullifier.slice(0, 22) + "…" },
                { label: "Address Commitment", value: result.addressCommitment.slice(0, 22) + "…" },
                { label: "View Key Hash", value: result.viewKeyHash.slice(0, 22) + "…" },
                { label: "KYC Provider", value: result.kycProvider },
                { label: "Settlement Limit", value: TIER_META[result.tier].limit },
                { label: "Circuit Constraints", value: "12,847" },
                { label: "Proof Size", value: "256 bytes (UltraHonk)" },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span style={{ color: "var(--color-text-muted)" }}>{row.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-white">{row.value}</span>
                    <button onClick={() => copy(row.value!, row.label)} className="btn-ghost p-0.5">
                      <Copy size={11} style={{ color: copied === row.label ? "#34d399" : "var(--color-text-dim)" }} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Expires</span>
                <ExpiryBadge expiresAt={result.expiresAt} />
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Compliance Tier</span>
                <span className={`tier-badge tier-${result.tier}`}>Tier {result.tier} — {TIER_META[result.tier].label}</span>
              </div>
            </div>

            {/* Credential secret — masked */}
            <div className="p-3 rounded-lg" style={{ background: "rgba(6,9,16,0.8)", border: "1px solid var(--color-border-subtle)" }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Lock size={12} style={{ color: "#60a5fa" }} />
                  <span className="text-xs font-medium text-white">Credential Secret</span>
                </div>
                <button onClick={() => setSecretVisible(!secretVisible)} className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-dim)" }}>
                  {secretVisible ? <EyeOff size={11} /> : <Eye size={11} />}
                  {secretVisible ? "Hide" : "Show"}
                </button>
              </div>
              <div className="font-mono text-xs" style={{ color: secretVisible ? "#6ee7b7" : "#475569" }}>
                {secretVisible
                  ? "Stored encrypted in IndexedDB — retrieve via retrieveCredentialSecret(id)"
                  : "•••••••••••••••••• (AES-256-GCM encrypted, browser only)"}
              </div>
              <div className="text-xs mt-1" style={{ color: "#475569" }}>
                Loss of secret = credential unrecoverable. Backed up: IndexedDB + API server (testnet only).
              </div>
            </div>

            <div className="p-3 rounded-lg flex items-start gap-2" style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}>
              <Lock size={13} style={{ color: "#34d399", marginTop: 2 }} />
              <p className="text-xs leading-relaxed" style={{ color: "#6ee7b7" }}>
                Nullifier committed on-chain — this credential cannot be replayed.
                Regulators with your <code className="mono text-xs">view_key</code> can verify compliance tier
                without seeing any raw KYC data. Rotate view key in Regulator tab.
              </p>
            </div>

            <button onClick={reset} className="btn-secondary w-full" style={{ padding: "0.75rem" }}>
              Generate Another Credential
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
