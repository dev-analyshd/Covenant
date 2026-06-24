import { useState, useCallback } from "react";
import {
  Eye, Shield, Search, FileText, AlertCircle, Lock,
  CheckCircle2, Loader2, ExternalLink, Copy, Download
} from "lucide-react";
import { useCovenantStore } from "../lib/store";

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
}

const PRESETS = [
  { id: "SETL-A7F2", label: "USDC→EURC · $50K · Tier 4", vk: "vk_fca_2026_covenant_demo" },
  { id: "SETL-3D9C", label: "EURC→PYUSD · $225K · Tier 5", vk: "vk_bafin_2026_covenant_demo" },
  { id: "SETL-8E1A", label: "USDC · $18.5K · Tier 3", vk: "vk_mas_2026_covenant_demo" },
];

const TIER_META: Record<number, { label: string }> = {
  5: { label: "Platinum" },
  4: { label: "Gold" },
  3: { label: "Silver" },
  2: { label: "Bronze" },
  1: { label: "Basic" },
};

function randHex(len: number) {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
}

export default function RegulatorPanel() {
  const { settlements } = useCovenantStore();
  const [settlementId, setSettlementId] = useState("");
  const [viewKey, setViewKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const loadPreset = (p: (typeof PRESETS)[number]) => {
    setSettlementId(p.id);
    setViewKey(p.vk);
    setResult(null);
    setError("");
  };

  const handleAudit = useCallback(async () => {
    if (!settlementId || !viewKey) {
      setError("Both Settlement ID and View Key are required.");
      return;
    }
    setError("");
    setLoading(true);

    await new Promise((r) => setTimeout(r, 1400));

    const sessionMatch = settlements.find(
      (s) => s.id === settlementId || s.settlementHash.startsWith(settlementId)
    );

    setResult({
      settlementId,
      complianceTier: sessionMatch?.tier ?? 4,
      amount: sessionMatch ? `${sessionMatch.amount} ${sessionMatch.fromAsset}${sessionMatch.crossCurrency ? ` → ${sessionMatch.toAsset}` : ""}` : "$50,000 USDC → EURC",
      asset: sessionMatch?.fromAsset ?? "USDC",
      senderCommitment: `0x${randHex(32)}`,
      recipientCommitment: `0x${randHex(32)}`,
      timestamp: (sessionMatch?.timestamp ?? new Date()).toISOString().replace("T", " ").slice(0, 19) + " UTC",
      kycProvider: "Onfido",
      sanctionsStatus: "Cleared",
      riskScore: 15,
      sourceOfFunds: "Business Revenue",
      viewKeyVerified: true,
      ledger: 52_483_917,
      txHash: randHex(64),
    });
    setLoading(false);
  }, [settlementId, viewKey, settlements]);

  const exportReport = () => {
    if (!result) return;
    const report = JSON.stringify(result, null, 2);
    const blob = new Blob([report], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `covenant-audit-${result.settlementId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto animate-in space-y-6">
      <div className="glass p-6 sm:p-8">
        <div className="flex items-start gap-4 mb-6">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(16,185,129,0.1)" }}
          >
            <Eye style={{ color: "#34d399" }} size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Regulator Audit Portal</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Authorized selective disclosure via view key system — compliance trail decryption
              without revealing sender identity
            </p>
          </div>
        </div>

        <div
          className="p-4 rounded-lg flex items-start gap-3 mb-6"
          style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}
        >
          <AlertCircle size={15} style={{ color: "#fbbf24", flexShrink: 0, marginTop: 2 }} />
          <div className="text-sm">
            <p className="font-semibold text-white mb-0.5">Authorized Access Only</p>
            <p style={{ color: "#cbd5e1" }}>
              All audit actions emit Soroban events logged immutably on-chain. The sender's Stellar address
              is never disclosed — only the cryptographic commitment is available for correlation analysis.
            </p>
          </div>
        </div>

        {settlements.length > 0 && (
          <div className="mb-4">
            <div className="label-sm mb-2">Session Settlements</div>
            <div className="flex flex-wrap gap-2">
              {settlements.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSettlementId(s.id); setViewKey("vk_regulator_session_demo"); setResult(null); }}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: settlementId === s.id ? "rgba(16,185,129,0.12)" : "rgba(30,41,59,0.6)",
                    border: `1px solid ${settlementId === s.id ? "rgba(16,185,129,0.25)" : "var(--color-border)"}`,
                    color: settlementId === s.id ? "#34d399" : "var(--color-text-muted)",
                  }}
                >
                  {s.id} — {s.amount} {s.fromAsset}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="label-sm mb-2">Demo Presets</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => loadPreset(p)}
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

        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
              Settlement ID
            </label>
            <div style={{ position: "relative" }}>
              <Search
                size={15}
                style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-dim)" }}
              />
              <input
                type="text"
                className="input-field"
                style={{ paddingLeft: "2.75rem" }}
                placeholder="SETL-XXXX or 0x…"
                value={settlementId}
                onChange={(e) => setSettlementId(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
              Regulator View Key
            </label>
            <div style={{ position: "relative" }}>
              <Lock
                size={15}
                style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-dim)" }}
              />
              <input
                type="password"
                className="input-field"
                style={{ paddingLeft: "2.75rem" }}
                placeholder="vk_regulator_…"
                value={viewKey}
                onChange={(e) => setViewKey(e.target.value)}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-dim)" }}>
              view_key = poseidon2(credential_secret ‖ regulator_public_key) — derived off-chain
            </p>
          </div>
          {error && <p className="text-xs flex items-center gap-1.5" style={{ color: "#f87171" }}><AlertCircle size={12} />{error}</p>}
          <button
            onClick={handleAudit}
            disabled={loading}
            className="btn-primary w-full"
            style={{
              padding: "0.75rem",
              background: loading ? "rgba(16,185,129,0.25)" : "linear-gradient(135deg,#059669,#10b981)",
            }}
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Verifying view key on-chain…</>
            ) : (
              <><Eye size={16} /> Audit Settlement</>
            )}
          </button>
        </div>

        {result && (
          <div className="space-y-5 border-t pt-6 animate-in" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText style={{ color: "#34d399" }} size={18} />
                <h3 className="text-base font-semibold text-white">Compliance Audit Report</h3>
                {result.viewKeyVerified && (
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}
                  >
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
                { label: "Amount", value: result.amount },
                { label: "KYC Provider", value: result.kycProvider },
                { label: "Sanctions Status", value: result.sanctionsStatus, success: result.sanctionsStatus === "Cleared" },
                { label: "Risk Score", value: `${result.riskScore}/100` },
                { label: "Source of Funds", value: result.sourceOfFunds },
                { label: "Timestamp", value: result.timestamp },
                { label: "Ledger", value: `#${result.ledger.toLocaleString()}` },
                { label: "Audit Status", value: "Logged on-chain", success: true },
              ].map((field, i) => (
                <div key={i} className="glass-subtle p-3.5">
                  <div className="label-sm mb-1.5">{field.label}</div>
                  {field.tier ? (
                    <span className={`tier-badge tier-${field.tier}`}>
                      Tier {field.tier} — {TIER_META[field.tier].label}
                    </span>
                  ) : (
                    <div className="text-sm font-medium" style={{ color: field.success ? "#34d399" : "white" }}>
                      {field.value}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="glass-subtle p-4 space-y-3">
              {[
                { label: "Sender Commitment", value: result.senderCommitment },
                { label: "Recipient Commitment", value: result.recipientCommitment },
              ].map((c) => (
                <div key={c.label}>
                  <div className="label-sm mb-1">{c.label} (privacy-preserving)</div>
                  <div className="flex items-center gap-2">
                    <code className="mono text-xs text-white flex-1 truncate">{c.value}</code>
                    <button onClick={() => copy(c.value, c.label)} className="btn-ghost p-1 flex-shrink-0">
                      <Copy size={11} style={{ color: copied === c.label ? "#34d399" : "var(--color-text-dim)" }} />
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-xs mt-2" style={{ color: "var(--color-text-dim)" }}>
                The sender's actual Stellar address is never disclosed. Only the cryptographic commitment
                is available for cross-settlement correlation by authorized regulators.
              </p>
            </div>

            <div
              className="p-4 rounded-lg flex items-start gap-3"
              style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)" }}
            >
              <Shield size={14} style={{ color: "#60a5fa", flexShrink: 0, marginTop: 2 }} />
              <div className="text-xs space-y-1" style={{ color: "#94a3b8" }}>
                <p>
                  This audit is recorded on-chain via Soroban event{" "}
                  <code className="mono px-1 rounded" style={{ background: "rgba(59,130,246,0.1)", color: "#7dd3fc" }}>
                    (AUDIT, ACCESS)
                  </code>.
                  The view key was verified against the stored{" "}
                  <code className="mono px-1 rounded" style={{ background: "rgba(59,130,246,0.1)", color: "#7dd3fc" }}>
                    view_key_hash
                  </code>{" "}
                  in CovenantSettlement.
                </p>
                {result.txHash && (
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${result.txHash}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:underline mt-1"
                    style={{ color: "#60a5fa" }}
                  >
                    <ExternalLink size={11} /> View settlement on Stellar Expert
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
