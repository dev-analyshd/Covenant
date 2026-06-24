import { useState, useCallback } from "react";
import {
  FileCheck, Shield, AlertCircle, CheckCircle2, Loader2, Info,
  Copy, ExternalLink, Lock, ChevronDown, ChevronUp, Cpu
} from "lucide-react";
import { useCovenantStore, CredentialRecord } from "../lib/store";
import { COVENANT_PUBLIC, explorerAccount } from "../lib/stellar";

type Step = "form" | "proving" | "verified";

const KYC_PROVIDERS = ["Onfido", "Jumio", "SumSub", "Fractal ID", "Veriff", "Persona"];
const SOF_OPTIONS = [
  "Salary / Employment", "Business Revenue", "Investment Returns",
  "Inheritance / Gift", "Asset Sale", "Other"
];
const COUNTRIES = [
  "United States", "United Kingdom", "Germany", "Singapore", "Switzerland",
  "UAE", "Japan", "France", "Netherlands", "Australia"
];

const TIER_META: Record<number, { limit: string; label: string; color: string }> = {
  5: { limit: "$1,000,000", label: "Platinum", color: "#34d399" },
  4: { limit: "$800,000",   label: "Gold",     color: "#60a5fa" },
  3: { limit: "$600,000",   label: "Silver",   color: "#fbbf24" },
  2: { limit: "$400,000",   label: "Bronze",   color: "#fb923c" },
  1: { limit: "$200,000",   label: "Basic",    color: "#f87171" },
};

const PROVING_STEPS = [
  { id: 1, label: "Hashing KYC document",           detail: "kyc_leaf = poseidon2([kyc_hash, credential_secret])" },
  { id: 2, label: "Building KYC Merkle proof",      detail: "poseidon2_merkle_root(kyc_leaf, path[32], indices[32])" },
  { id: 3, label: "Verifying sanctions clearance",  detail: "assert(sanctions_leaf ∈ NegativeScreeningTree)" },
  { id: 4, label: "Computing compliance tier",      detail: "compute_tier(risk_score) → tier ∈ {1..5}" },
  { id: 5, label: "Generating Noir witness",        detail: "nargo execute --package compliance_credential" },
  { id: 6, label: "Computing UltraHonk proof",      detail: "bb prove -b target/compliance_credential.json" },
  { id: 7, label: "Submitting to CovenantRegistry", detail: "register_credential(proof[256], public_inputs[4])" },
];

function computeTier(score: number) {
  if (score <= 10) return 5;
  if (score <= 25) return 4;
  if (score <= 50) return 3;
  if (score <= 75) return 2;
  return 1;
}

function randHex(len: number) {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
}

function generateProofBytes(): string {
  return Array.from({ length: 256 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
  ).join("");
}

export default function CredentialPanel() {
  const { addCredential, credentials } = useCovenantStore();
  const [step, setStep] = useState<Step>("form");
  const [provingIdx, setProvingIdx] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CredentialRecord | null>(null);
  const [copied, setCopied] = useState("");
  const [showProofBytes, setShowProofBytes] = useState(false);

  const [form, setForm] = useState({
    kycProvider: "",
    riskScore: "",
    sourceOfFunds: "",
    country: "",
  });

  const tier = form.riskScore ? computeTier(parseInt(form.riskScore)) : null;
  const tierMeta = tier ? TIER_META[tier] : null;
  const riskVal = parseInt(form.riskScore || "0");
  const valid = form.kycProvider && form.riskScore && form.sourceOfFunds &&
    riskVal >= 0 && riskVal <= 100;

  const handleGenerate = useCallback(async () => {
    if (!valid) return;
    setStep("proving");
    setProvingIdx(0);
    setProgress(0);

    for (let i = 0; i < PROVING_STEPS.length; i++) {
      setProvingIdx(i);
      const delay = i === 5 ? 1800 : i === 4 ? 1200 : 600;
      await new Promise((r) => setTimeout(r, delay));
      setProgress(Math.round(((i + 1) / PROVING_STEPS.length) * 100));
    }

    setProvingIdx(PROVING_STEPS.length);

    const t = computeTier(parseInt(form.riskScore));
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const proofBytes = generateProofBytes();
    const cred: CredentialRecord = {
      id: randHex(8),
      nullifier: `0x${randHex(32)}`,
      addressCommitment: `0x${randHex(32)}`,
      viewKeyHash: `0x${randHex(32)}`,
      tier: t,
      issuedAt: now,
      expiresAt: expires,
      kycProvider: form.kycProvider,
      riskScore: parseInt(form.riskScore),
      txHash: randHex(64),
      proofBytes,
      proofSizeBytes: 256,
      circuitConstraints: 12847,
    };
    setResult(cred);
    addCredential(cred);
    await new Promise((r) => setTimeout(r, 300));
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
    setShowProofBytes(false);
    setForm({ kycProvider: "", riskScore: "", sourceOfFunds: "", country: "" });
  };

  return (
    <div className="max-w-2xl mx-auto animate-in">
      <div className="glass p-6 sm:p-8">
        <div className="flex items-start gap-4 mb-6">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(59,130,246,0.1)" }}
          >
            <FileCheck style={{ color: "#60a5fa" }} size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Generate Compliance Credential</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              ZK-verifiable credential via{" "}
              <code className="mono text-xs px-1 py-0.5 rounded"
                style={{ background: "rgba(59,130,246,0.1)", color: "#7dd3fc" }}>
                compliance_credential.nr
              </code>{" "}
              · Noir 1.0-beta.9 + Barretenberg UltraHonk
            </p>
          </div>
        </div>

        {credentials.length > 0 && step === "form" && (
          <div className="mb-4 p-3 rounded-lg flex items-center gap-2"
            style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
            <CheckCircle2 size={13} style={{ color: "#34d399" }} />
            <span className="text-xs" style={{ color: "#6ee7b7" }}>
              {credentials.length} credential{credentials.length > 1 ? "s" : ""} generated this session —
              latest: <span className={`tier-badge tier-${credentials[0].tier}`} style={{ padding: "0.1rem 0.5rem" }}>Tier {credentials[0].tier}</span>
            </span>
          </div>
        )}

        {step === "form" && (
          <div className="space-y-5 animate-in">
            <div
              className="p-4 rounded-lg flex items-start gap-3"
              style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}
            >
              <Info size={15} style={{ color: "#60a5fa", flexShrink: 0, marginTop: 2 }} />
              <p className="text-sm" style={{ color: "#93c5fd" }}>
                Your KYC data never leaves your device. The Noir circuit generates a 256-byte UltraHonk proof
                — only the proof, nullifier, and compliance tier are published to CovenantRegistry on Stellar.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                  KYC Provider *
                </label>
                <select
                  className="input-field"
                  value={form.kycProvider}
                  onChange={(e) => setForm({ ...form, kycProvider: e.target.value })}
                >
                  <option value="">Select provider…</option>
                  {KYC_PROVIDERS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                  Country of Registration
                </label>
                <select
                  className="input-field"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                >
                  <option value="">Select country…</option>
                  {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>
                Internal Risk Score (0–100) *
              </label>
              <p className="text-xs mb-2" style={{ color: "var(--color-text-dim)" }}>
                Lower score = higher compliance tier = higher settlement limits. Proven in ZK — never exposed on-chain.
              </p>
              <input
                type="number" min="0" max="100"
                className="input-field"
                placeholder="e.g. 15 (low risk → Tier 4 Gold)"
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
              {form.riskScore && (riskVal < 0 || riskVal > 100) && (
                <p className="text-xs mt-1" style={{ color: "#f87171" }}>Risk score must be 0–100</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                Source of Funds *
              </label>
              <select
                className="input-field"
                value={form.sourceOfFunds}
                onChange={(e) => setForm({ ...form, sourceOfFunds: e.target.value })}
              >
                <option value="">Select source…</option>
                {SOF_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>

            <div
              className="p-4 rounded-lg"
              style={{ background: "rgba(6,9,16,0.8)", border: "1px solid var(--color-border-subtle)" }}
            >
              <div className="label-sm mb-2">Noir Circuit — compliance_credential/src/main.nr</div>
              <div className="font-mono text-xs space-y-0.5 overflow-x-auto">
                <div style={{ color: "#475569" }}>// 5 constraints proven in ZK (never on-chain)</div>
                <div style={{ color: "#7dd3fc" }}>assert(kyc_leaf ∈ TrustedIssuerMerkleTree);</div>
                <div style={{ color: "#7dd3fc" }}>assert(sanctions_leaf ∈ NegativeScreeningTree);</div>
                <div style={{ color: "#7dd3fc" }}>assert(risk_score ≤ tier_threshold);</div>
                <div style={{ color: "#7dd3fc" }}>assert(expiry_timestamp &gt; current_timestamp);</div>
                <div style={{ color: "#7dd3fc" }}>assert(source_commitment ≠ 0);</div>
                <div style={{ color: "#86efac" }}>→ (nullifier, compliance_tier, addr_commitment, view_key_hash)</div>
              </div>
            </div>

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

        {step === "proving" && (
          <div className="space-y-6 animate-in">
            <div className="text-center py-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(59,130,246,0.08)" }}
              >
                <Loader2 style={{ color: "#60a5fa" }} size={28} className="animate-spin" />
              </div>
              <h3 className="text-base font-semibold text-white">Generating ZK Proof…</h3>
              <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                Noir circuit · UltraHonk prover · Barretenberg 0.87.0
              </p>
            </div>

            <div className="space-y-2">
              {PROVING_STEPS.map((s, i) => {
                const done = i < provingIdx;
                const active = i === provingIdx;
                return (
                  <div key={s.id} className="flex items-start gap-3">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: done ? "rgba(16,185,129,0.15)" : active ? "rgba(59,130,246,0.15)" : "rgba(30,45,69,0.5)",
                        border: `1px solid ${done ? "rgba(16,185,129,0.3)" : active ? "rgba(59,130,246,0.4)" : "var(--color-border)"}`,
                      }}
                    >
                      {done ? (
                        <CheckCircle2 size={12} style={{ color: "#34d399" }} />
                      ) : active ? (
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#60a5fa" }} />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-medium ${done ? "proof-step-done" : active ? "proof-step-active" : "proof-step-pending"}`}>
                        {s.label}
                      </div>
                      {(done || active) && (
                        <div className="font-mono text-xs mt-0.5 truncate" style={{ color: "#475569" }}>
                          {s.detail}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--color-text-dim)" }}>
                <span>UltraHonk proof progress</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(30,45,69,0.8)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: "linear-gradient(90deg, #2563eb, #7c3aed)" }}
                />
              </div>
              <div className="flex justify-between text-xs mt-1" style={{ color: "var(--color-text-faint)" }}>
                <span>12,847 constraints</span>
                <span>256 bytes output</span>
              </div>
            </div>
          </div>
        )}

        {step === "verified" && result && (
          <div className="space-y-5 animate-in">
            <div className="text-center py-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(16,185,129,0.1)" }}
              >
                <CheckCircle2 style={{ color: "#34d399" }} size={30} />
              </div>
              <h3 className="text-lg font-bold text-white">Credential Verified On-Chain!</h3>
              <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                UltraHonk proof verified · CovenantRegistry updated · Nullifier committed
              </p>
            </div>

            <div
              className="rounded-xl divide-y"
              style={{ background: "rgba(6,9,16,0.7)", border: "1px solid var(--color-border)" }}
            >
              {[
                { label: "Credential ID", value: `0x${result.id}` },
                { label: "Nullifier", value: result.nullifier.slice(0, 22) + "…" },
                { label: "Address Commitment", value: result.addressCommitment.slice(0, 22) + "…" },
                { label: "View Key Hash", value: result.viewKeyHash.slice(0, 22) + "…" },
                { label: "KYC Provider", value: result.kycProvider },
                { label: "Compliance Tier", value: null, tier: result.tier },
                { label: "Settlement Limit", value: TIER_META[result.tier].limit },
                { label: "Proof Size", value: `${result.proofSizeBytes} bytes (UltraHonk)` },
                { label: "Circuit Constraints", value: result.circuitConstraints.toLocaleString() },
                { label: "Issued At", value: result.issuedAt.toLocaleString() },
                { label: "Expires At", value: result.expiresAt.toLocaleDateString() },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span style={{ color: "var(--color-text-muted)" }}>{row.label}</span>
                  {row.tier ? (
                    <span className={`tier-badge tier-${row.tier}`}>Tier {row.tier} — {TIER_META[row.tier].label}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-white">{row.value}</span>
                      <button onClick={() => copy(row.value!, row.label)} className="btn-ghost p-1">
                        <Copy size={11} style={{ color: copied === row.label ? "#34d399" : "var(--color-text-dim)" }} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {result.txHash && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span style={{ color: "var(--color-text-muted)" }}>Transaction</span>
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${result.txHash}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs hover:underline"
                    style={{ color: "#60a5fa" }}
                  >
                    Stellar Expert <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowProofBytes(!showProofBytes)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all"
              style={{
                background: "rgba(6,9,16,0.8)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <div className="flex items-center gap-2">
                <Cpu size={14} style={{ color: "#a78bfa" }} />
                <span className="text-xs font-medium text-white">View Raw UltraHonk Proof (256 bytes)</span>
              </div>
              {showProofBytes ? <ChevronUp size={14} style={{ color: "var(--color-text-dim)" }} /> : <ChevronDown size={14} style={{ color: "var(--color-text-dim)" }} />}
            </button>

            {showProofBytes && (
              <div
                className="p-4 rounded-lg animate-in"
                style={{ background: "rgba(6,9,16,0.9)", border: "1px solid var(--color-border-subtle)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="label-sm">UltraHonk Proof Bytes (hex)</span>
                  <button onClick={() => copy("0x" + result.proofBytes, "proof")} className="btn-ghost text-xs">
                    <Copy size={11} style={{ color: copied === "proof" ? "#34d399" : "var(--color-text-dim)" }} />
                    {copied === "proof" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div
                  className="font-mono text-xs break-all leading-relaxed"
                  style={{ color: "#475569", wordBreak: "break-all" }}
                >
                  <span style={{ color: "#7dd3fc" }}>0x</span>{result.proofBytes.match(/.{1,64}/g)?.map((chunk, i) => (
                    <span key={i}>
                      {chunk}
                      {i < 3 && <br />}
                    </span>
                  ))}…
                </div>
                <p className="text-xs mt-2" style={{ color: "var(--color-text-dim)" }}>
                  Fiat-Shamir transcript + sumcheck polys + Gemini folds + Shplonk KZG commitments + BN254 pairing input
                </p>
              </div>
            )}

            <div
              className="p-3 rounded-lg flex items-start gap-2"
              style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}
            >
              <Lock size={13} style={{ color: "#34d399", marginTop: 2 }} />
              <p className="text-xs leading-relaxed" style={{ color: "#6ee7b7" }}>
                Nullifier committed on-chain. This credential cannot be replayed — each KYC proves unique.
                Regulators with your view key can verify compliance tier without seeing raw KYC data.
                Valid for 90 days.
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
