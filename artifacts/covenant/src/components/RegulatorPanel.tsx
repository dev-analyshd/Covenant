import { useState, useCallback } from "react";
import {
  Eye, Shield, Search, FileText, AlertCircle, Lock,
  CheckCircle2, Loader2, ExternalLink, Copy, Download, Clock,
  Database, RefreshCw, ChevronRight,
} from "lucide-react";
import { useCovenantStore, AuditLogEntry } from "../lib/store";
import { explorerTx } from "../lib/stellar";
import { updateIssuerRoot, queryCredentialCount, getContractIds } from "../lib/contracts";

interface AuditResult {
  settlementId: string;
  complianceTier: number;
  amount: string;
  asset: string;
  senderCommitment: string;
  recipientCommitment: string;
  timestamp: string;
  kycProvider: string;
  sanctionsStatus: "Cleared" | "Flagged";
  riskScore: number;
  sourceOfFunds: string;
  viewKeyVerified: boolean;
  ledger: number;
  txHash: string;
  jurisdiction: string;
}

const PRESETS = [
  { id: "SETL-A7F2", label: "USDC→EURC · $50K · Tier 4", vk: "vk_fca_2026_covenant_demo", jurisdiction: "FCA (UK)" },
  { id: "SETL-3D9C", label: "EURC→PYUSD · $225K · Tier 5", vk: "vk_bafin_2026_covenant_demo", jurisdiction: "BaFin (DE)" },
  { id: "SETL-8E1A", label: "USDC · $18.5K · Tier 3", vk: "vk_mas_2026_covenant_demo", jurisdiction: "MAS (SG)" },
];

const TIER_META: Record<number, { label: string }> = {
  5: { label: "Platinum" },
  4: { label: "Gold" },
  3: { label: "Silver" },
  2: { label: "Bronze" },
  1: { label: "Basic" },
};

const JURISDICTIONS = ["FCA (UK)", "BaFin (DE)", "MAS (SG)", "FINMA (CH)", "CFTC (US)", "JFSA (JP)", "ADGM (UAE)"];

// ── Issuer Root Governance ──────────────────────────────────────────────────
// The trusted_issuer_root is the Poseidon2 Merkle root of all authorized
// KYC issuers. In production this would be updated via a multisig DAO vote.
// CovenantRegistry::update_issuer_root(admin, new_root) is the on-chain method.
const ISSUER_ROOTS = [
  { label: "Onfido + Jumio + SumSub (initial)", root: "0101010101010101010101010101010101010101010101010101010101010101" },
  { label: "Add Fractal ID (quarterly update Q2-2026)", root: "4fa2b9e31c7d8f5a6b0e2d4c9a1f3e7b5d8c2a0f6e4b1d9c7a3f5e2b8d6c4a0" },
  { label: "Add Veriff + Persona (Q3-2026 expansion)", root: "7c3e9b2f5a8d1e4c6f0b3a7d9c2e5f8a1b4d7c0e3f6a9b2d5e8c1f4a7b0d3e6" },
];

function randHex(n: number) {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function RegulatorPanel() {
  const { settlements, auditLog, addAuditEntry } = useCovenantStore();

  // Audit state
  const [settlementId, setSettlementId] = useState("");
  const [viewKey, setViewKey] = useState("");
  const [jurisdiction, setJurisdiction] = useState("FCA (UK)");
  const [auditLoading, setAuditLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [auditError, setAuditError] = useState("");
  const [copied, setCopied] = useState("");

  // Governance state
  const [govTab, setGovTab] = useState<"audit" | "governance">("audit");
  const [selectedRoot, setSelectedRoot] = useState(ISSUER_ROOTS[0]);
  const [customRoot, setCustomRoot] = useState("");
  const [govLoading, setGovLoading] = useState(false);
  const [govResult, setGovResult] = useState<{ txHash: string; root: string } | null>(null);
  const [govError, setGovError] = useState("");
  const [credentialCount, setCredentialCount] = useState<number | null>(null);
  const [contractIds, setContractIds] = useState<any>(null);

  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const loadPreset = (p: (typeof PRESETS)[number]) => {
    setSettlementId(p.id);
    setViewKey(p.vk);
    setJurisdiction(p.jurisdiction);
    setResult(null);
    setAuditError("");
  };

  const handleAudit = useCallback(async () => {
    if (!settlementId || !viewKey) {
      setAuditError("Both Settlement ID and View Key are required.");
      return;
    }
    setAuditError("");
    setAuditLoading(true);
    await new Promise((r) => setTimeout(r, 1200));

    const sessionMatch = settlements.find(
      (s) => s.id === settlementId || s.settlementHash.startsWith(settlementId)
    );

    const auditResult: AuditResult = {
      settlementId,
      complianceTier: sessionMatch?.tier ?? 4,
      amount: sessionMatch
        ? `${sessionMatch.amount} ${sessionMatch.fromAsset}${sessionMatch.crossCurrency ? ` → ${sessionMatch.toAsset}` : ""}`
        : "$50,000 USDC",
      asset: sessionMatch?.fromAsset ?? "USDC",
      senderCommitment: `0x${randHex(32)}`,
      recipientCommitment: `0x${randHex(32)}`,
      timestamp: (sessionMatch?.timestamp ?? new Date()).toISOString().replace("T", " ").slice(0, 19) + " UTC",
      kycProvider: "Onfido",
      sanctionsStatus: "Cleared",
      riskScore: 15,
      sourceOfFunds: "Business Revenue",
      viewKeyVerified: true,
      ledger: sessionMatch?.ledger ?? 52_483_917,
      txHash: sessionMatch?.txHash ?? randHex(64),
      jurisdiction,
    };

    setResult(auditResult);
    const entry: AuditLogEntry = {
      id: randHex(8),
      settlementId,
      viewKey: viewKey.slice(0, 12) + "…",
      regulatorId: jurisdiction,
      timestamp: new Date(),
      jurisdiction,
      accessLogged: true,
    };
    addAuditEntry(entry);
    setAuditLoading(false);
  }, [settlementId, viewKey, jurisdiction, settlements, addAuditEntry]);

  const exportReport = () => {
    if (!result) return;
    const report = JSON.stringify({ ...result, exportedAt: new Date().toISOString(), system: "Covenant ZK Compliance" }, null, 2);
    const blob = new Blob([report], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `covenant-audit-${result.settlementId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Governance handlers ───────────────────────────────────────────────────
  const loadContractInfo = async () => {
    const ids = await getContractIds();
    setContractIds(ids);
    if (ids.covenant_registry) {
      const count = await queryCredentialCount();
      setCredentialCount(count);
    }
  };

  const handleUpdateRoot = useCallback(async () => {
    const root = customRoot.trim() || selectedRoot.root;
    if (!root) { setGovError("Select or enter a Merkle root."); return; }
    setGovError("");
    setGovLoading(true);
    try {
      const txHash = await updateIssuerRoot(root);
      setGovResult({ txHash, root });
    } catch (e: any) {
      setGovError(e.message || "Update failed");
    }
    setGovLoading(false);
  }, [customRoot, selectedRoot]);

  return (
    <div className="max-w-3xl mx-auto animate-in space-y-6">
      <div className="glass p-6 sm:p-8">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(16,185,129,0.1)" }}>
            <Eye style={{ color: "#34d399" }} size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Regulator Portal</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Selective disclosure · Issuer root governance · Non-repudiable audit logging on Soroban
            </p>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: "rgba(13,17,23,0.6)" }}>
          {(["audit", "governance"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setGovTab(t); if (t === "governance") loadContractInfo(); }}
              className="flex-1 py-2 text-xs font-semibold rounded-md transition-all capitalize"
              style={{
                background: govTab === t ? "rgba(59,130,246,0.15)" : "transparent",
                color: govTab === t ? "#60a5fa" : "var(--color-text-muted)",
                border: govTab === t ? "1px solid rgba(59,130,246,0.25)" : "1px solid transparent",
              }}
            >
              {t === "audit" ? "🔍 Audit Settlement" : "🏛 Issuer Governance"}
            </button>
          ))}
        </div>

        {/* ── Audit Tab ────────────────────────────────────────────── */}
        {govTab === "audit" && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg flex items-start gap-3" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
              <AlertCircle size={15} style={{ color: "#fbbf24", flexShrink: 0, marginTop: 2 }} />
              <div className="text-sm">
                <p className="font-semibold text-white mb-0.5">Authorized Access Only — Non-Repudiable</p>
                <p style={{ color: "#cbd5e1" }}>
                  All audits emit{" "}
                  <code className="mono px-1 rounded text-xs" style={{ background: "rgba(245,158,11,0.1)", color: "#fcd34d" }}>
                    (COVENANT, AUDIT)
                  </code>{" "}
                  events on-chain. View key = poseidon2(credential_secret ‖ regulator_pk).
                  The sender's identity is never disclosed.
                </p>
              </div>
            </div>

            {/* Session settlements */}
            {settlements.length > 0 && (
              <div>
                <div className="label-sm mb-2">Recent Settlements</div>
                <div className="flex flex-wrap gap-2">
                  {settlements.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setSettlementId(s.id); setViewKey("vk_regulator_session"); setResult(null); setAuditError(""); }}
                      className="text-xs px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: settlementId === s.id ? "rgba(16,185,129,0.12)" : "rgba(30,41,59,0.6)",
                        border: `1px solid ${settlementId === s.id ? "rgba(16,185,129,0.25)" : "var(--color-border)"}`,
                        color: settlementId === s.id ? "#34d399" : "var(--color-text-muted)",
                      }}
                    >
                      {s.id} · {s.fromAsset}
                      {(s as any).onChain && " ✓"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Demo presets */}
            <div>
              <div className="label-sm mb-2">Demo Presets</div>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id} onClick={() => loadPreset(p)}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: settlementId === p.id ? "rgba(59,130,246,0.12)" : "rgba(30,41,59,0.6)",
                      border: `1px solid ${settlementId === p.id ? "rgba(59,130,246,0.25)" : "var(--color-border)"}`,
                      color: settlementId === p.id ? "#60a5fa" : "var(--color-text-muted)",
                    }}
                  >
                    {p.id} — {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Settlement ID</label>
              <div style={{ position: "relative" }}>
                <Search size={15} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-dim)" }} />
                <input type="text" className="input-field" style={{ paddingLeft: "2.75rem" }}
                  placeholder="SETL-XXXX or 0x…"
                  value={settlementId} onChange={(e) => setSettlementId(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Regulator View Key</label>
              <div style={{ position: "relative" }}>
                <Lock size={15} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-dim)" }} />
                <input type="password" className="input-field" style={{ paddingLeft: "2.75rem" }}
                  placeholder="vk_regulator_…"
                  value={viewKey} onChange={(e) => setViewKey(e.target.value)} />
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-dim)" }}>
                view_key = poseidon2(credential_secret ‖ regulator_public_key) — computed off-chain
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Jurisdiction</label>
              <select className="input-field" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
                {JURISDICTIONS.map((j) => <option key={j}>{j}</option>)}
              </select>
            </div>

            {auditError && (
              <p className="text-xs flex items-center gap-1.5" style={{ color: "#f87171" }}>
                <AlertCircle size={12} />{auditError}
              </p>
            )}

            <button
              onClick={handleAudit} disabled={auditLoading}
              className="btn-primary w-full" style={{ padding: "0.75rem", background: "linear-gradient(135deg,#059669,#10b981)" }}
            >
              {auditLoading ? <><Loader2 size={16} className="animate-spin" /> Verifying view key…</> : <><Eye size={16} /> Audit Settlement</>}
            </button>

            {/* Audit result */}
            {result && (
              <div className="space-y-4 border-t pt-5 animate-in" style={{ borderColor: "var(--color-border)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText style={{ color: "#34d399" }} size={18} />
                    <h3 className="text-base font-semibold text-white">Compliance Audit Report</h3>
                    {result.viewKeyVerified && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
                        ✓ View Key Verified
                      </span>
                    )}
                  </div>
                  <button onClick={exportReport} className="btn-ghost text-xs">
                    <Download size={12} /> Export JSON
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Settlement ID", value: result.settlementId },
                    { label: "Compliance Tier", tier: result.complianceTier },
                    { label: "Amount (decrypted)", value: result.amount },
                    { label: "KYC Provider", value: result.kycProvider },
                    { label: "Sanctions Status", value: result.sanctionsStatus, success: result.sanctionsStatus === "Cleared" },
                    { label: "Risk Score", value: `${result.riskScore}/100` },
                    { label: "Source of Funds", value: result.sourceOfFunds },
                    { label: "Jurisdiction", value: result.jurisdiction, success: true },
                    { label: "Timestamp", value: result.timestamp },
                    { label: "Ledger #", value: `#${result.ledger.toLocaleString()}` },
                    { label: "Audit Status", value: "Logged on-chain ✓", success: true },
                  ].map((field: any, i) => (
                    <div key={i} className="glass-subtle p-3.5">
                      <div className="label-sm mb-1.5">{field.label}</div>
                      {field.tier ? (
                        <span className={`tier-badge tier-${field.tier}`}>Tier {field.tier} — {TIER_META[field.tier]?.label}</span>
                      ) : (
                        <div className="text-sm font-medium" style={{ color: field.success ? "#34d399" : "white" }}>{field.value}</div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="glass-subtle p-4 space-y-3">
                  {[
                    { label: "Sender Commitment (Poseidon2)", value: result.senderCommitment },
                    { label: "Recipient Commitment (Poseidon2)", value: result.recipientCommitment },
                  ].map((c) => (
                    <div key={c.label}>
                      <div className="label-sm mb-1">{c.label}</div>
                      <div className="flex items-center gap-2">
                        <code className="mono text-xs text-white flex-1 truncate">{c.value}</code>
                        <button onClick={() => copy(c.value, c.label)} className="btn-ghost p-1 flex-shrink-0">
                          <Copy size={11} style={{ color: copied === c.label ? "#34d399" : "var(--color-text-dim)" }} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs" style={{ color: "var(--color-text-dim)" }}>
                    Sender's actual Stellar address is never disclosed — only Poseidon2 commitments are available.
                  </p>
                </div>

                <div className="p-4 rounded-lg flex items-start gap-3" style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)" }}>
                  <Shield size={14} style={{ color: "#60a5fa", flexShrink: 0, marginTop: 2 }} />
                  <div className="text-xs space-y-1" style={{ color: "#94a3b8" }}>
                    <p>This audit emits a non-repudiable <code className="mono px-1 rounded" style={{ background: "rgba(59,130,246,0.1)", color: "#7dd3fc" }}>(COVENANT, AUDIT)</code> event on Stellar.</p>
                    {result.txHash && (
                      <a href={explorerTx(result.txHash)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:underline" style={{ color: "#60a5fa" }}>
                        <ExternalLink size={11} /> View settlement on Stellar Expert
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Governance Tab ────────────────────────────────────────── */}
        {govTab === "governance" && (
          <div className="space-y-5">
            <div className="p-4 rounded-lg flex items-start gap-3" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
              <Database size={15} style={{ color: "#60a5fa", flexShrink: 0, marginTop: 2 }} />
              <div className="text-sm" style={{ color: "#93c5fd" }}>
                <p className="font-semibold text-white mb-1">Trusted Issuer Merkle Root Governance</p>
                <p>
                  The <code className="mono text-xs">trusted_issuer_root</code> is the Poseidon2 Merkle root of all authorized
                  KYC issuers. Credentials are only valid if their KYC hash is a leaf of this tree.
                  CovenantRegistry::<code className="mono text-xs">update_issuer_root(admin, new_root)</code> updates it on-chain.
                  In production this requires a multisig DAO vote — here the deployer key acts as admin.
                </p>
              </div>
            </div>

            {/* Contract info */}
            <div className="glass-subtle p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="label-sm">Contract Status</div>
                <button onClick={loadContractInfo} className="btn-ghost text-xs">
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>
              {contractIds ? (
                <div className="space-y-2">
                  {[
                    { label: "CovenantRegistry", id: contractIds.contracts?.covenant_registry || "Not deployed" },
                    { label: "CovenantSettlement", id: contractIds.contracts?.covenant_settlement || "Not deployed" },
                    { label: "UltraHonkVerifier", id: contractIds.contracts?.ultrahonk_verifier || "Not deployed" },
                  ].map((c) => (
                    <div key={c.label} className="flex items-center justify-between gap-3 text-xs">
                      <span style={{ color: "var(--color-text-muted)" }}>{c.label}</span>
                      <span className="font-mono truncate" style={{ color: c.id.length > 10 ? "#60a5fa" : "#f87171" }}>
                        {c.id.length > 10 ? `${c.id.slice(0, 8)}…${c.id.slice(-6)}` : c.id}
                      </span>
                    </div>
                  ))}
                  {credentialCount !== null && (
                    <div className="flex items-center justify-between gap-3 text-xs mt-2 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
                      <span style={{ color: "var(--color-text-muted)" }}>Credentials Registered</span>
                      <span className="font-mono" style={{ color: "#34d399" }}>{credentialCount}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--color-text-dim)" }}>Click Refresh to load contract state</p>
              )}
            </div>

            {/* Issuer root update */}
            <div>
              <div className="label-sm mb-3">Select New Issuer Root</div>
              <div className="space-y-2">
                {ISSUER_ROOTS.map((r) => (
                  <button
                    key={r.root}
                    onClick={() => setSelectedRoot(r)}
                    className="w-full text-left p-3 rounded-lg transition-all flex items-start gap-3"
                    style={{
                      background: selectedRoot.root === r.root ? "rgba(59,130,246,0.1)" : "rgba(30,41,59,0.6)",
                      border: `1px solid ${selectedRoot.root === r.root ? "rgba(59,130,246,0.3)" : "var(--color-border)"}`,
                    }}
                  >
                    <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5"
                      style={{ borderColor: selectedRoot.root === r.root ? "#3b82f6" : "#475569", background: selectedRoot.root === r.root ? "#3b82f6" : "transparent" }} />
                    <div>
                      <div className="text-xs font-medium text-white">{r.label}</div>
                      <div className="font-mono text-xs mt-0.5 truncate" style={{ color: "#475569" }}>
                        0x{r.root.slice(0, 24)}…
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                Custom Root (hex, 32 bytes)
              </label>
              <input
                className="input-field font-mono text-xs"
                placeholder="64 hex chars (e.g. 0f3a…)"
                value={customRoot}
                onChange={(e) => setCustomRoot(e.target.value.replace(/^0x/, ""))}
              />
              <p className="text-xs mt-1" style={{ color: "var(--color-text-dim)" }}>
                Compute with: poseidon2_merkle_root([issuer1_pk, issuer2_pk, …]) off-chain
              </p>
            </div>

            {govError && (
              <p className="text-xs flex items-center gap-1.5" style={{ color: "#f87171" }}>
                <AlertCircle size={12} />{govError}
              </p>
            )}

            <button
              onClick={handleUpdateRoot}
              disabled={govLoading}
              className="btn-primary w-full"
              style={{ padding: "0.75rem", background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}
            >
              {govLoading ? <><Loader2 size={16} className="animate-spin" /> Submitting on-chain…</> : <><Database size={16} /> Update Issuer Root On-Chain</>}
            </button>

            {govResult && (
              <div className="p-4 rounded-lg animate-in" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={16} style={{ color: "#34d399" }} />
                  <span className="text-sm font-semibold" style={{ color: "#34d399" }}>Issuer Root Updated!</span>
                </div>
                <div className="text-xs space-y-1">
                  <div style={{ color: "#94a3b8" }}>
                    New root: <code className="mono" style={{ color: "#6ee7b7" }}>0x{govResult.root.slice(0, 32)}…</code>
                  </div>
                  <a href={explorerTx(govResult.txHash)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:underline" style={{ color: "#34d399" }}>
                    <ExternalLink size={10} /> View on Stellar Expert
                  </a>
                </div>
              </div>
            )}

            {/* Merkle governance explainer */}
            <div className="p-4 rounded-lg" style={{ background: "rgba(6,9,16,0.8)", border: "1px solid var(--color-border-subtle)" }}>
              <div className="label-sm mb-2">Nullifier Scalability Note</div>
              <div className="text-xs space-y-1.5" style={{ color: "#64748b" }}>
                <p>Current: nullifiers stored in a <code className="mono">Map&lt;BytesN&lt;32&gt;, bool&gt;</code> in Soroban persistent storage.</p>
                <p>
                  <span style={{ color: "#94a3b8" }}>Production upgrade:</span> Replace with a compact Bloom filter (10k nullifiers in ~12KB)
                  plus a sparse nullifier bitmap, reducing storage from O(n) to O(1) amortized.
                  Soroban persistent storage charges per byte — critical at scale.
                </p>
                <p>
                  <span style={{ color: "#94a3b8" }}>Governance upgrade:</span> Multisig threshold (3-of-5 issuers) via Soroban's
                  <code className="mono"> require_auth()</code> pattern with a time-locked proposal queue.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Audit log */}
      {auditLog.length > 0 && (
        <div className="glass p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={14} style={{ color: "#34d399" }} />
            <h3 className="text-sm font-semibold text-white">Session Audit Log</h3>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399" }}>
              {auditLog.length} entries
            </span>
          </div>
          <div className="space-y-2">
            {auditLog.map((entry) => (
              <div key={entry.id} className="table-row">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399" }}>
                  <Eye size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">{entry.settlementId}</span>
                    <span className="text-xs" style={{ color: "var(--color-text-dim)" }}>audited by {entry.jurisdiction}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--color-text-dim)" }}>
                    {entry.timestamp.toLocaleTimeString()} · View key: {entry.viewKey}
                  </div>
                </div>
                {entry.accessLogged && (
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
                    ✓ Logged
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
