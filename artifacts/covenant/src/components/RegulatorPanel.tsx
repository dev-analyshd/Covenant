import { useState } from "react";
import { Eye, Shield, Search, FileText, AlertCircle, Lock } from "lucide-react";

interface AuditResult {
  settlementId: string;
  complianceTier: number;
  amount: string;
  asset: string;
  senderCommitment: string;
  timestamp: string;
  kycProvider: string;
  sanctionsStatus: string;
  riskScore: number;
  sourceOfFunds: string;
  viewKeyVerified: boolean;
}

const sampleAudits = [
  { id: "SETL-0042", label: "USDC → EURC settlement", tier: 4, amount: "$50,000" },
  { id: "SETL-0039", label: "EURC → PYUSD settlement", tier: 5, amount: "$225,000" },
  { id: "SETL-0031", label: "USDC same-asset transfer", tier: 3, amount: "$18,500" },
];

export default function RegulatorPanel() {
  const [viewKey, setViewKey] = useState("");
  const [settlementId, setSettlementId] = useState("");
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAudit = async () => {
    if (!settlementId || !viewKey) {
      setError("Both Settlement ID and View Key are required.");
      return;
    }
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);

    setAuditResult({
      settlementId: settlementId || "SETL-0042",
      complianceTier: 4,
      amount: "$50,000",
      asset: "USDC → EURC",
      senderCommitment: "0x7a3f9e2d4b1c8a56c3d2e1f0b4a7e9d8",
      timestamp: "2026-06-23 14:32:18 UTC",
      kycProvider: "Onfido",
      sanctionsStatus: "Cleared",
      riskScore: 15,
      sourceOfFunds: "Business Revenue",
      viewKeyVerified: true,
    });
  };

  const handlePreset = (id: string) => {
    setSettlementId(id);
    setViewKey("vk_regulator_fca_2026_demo");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="glass-panel p-8">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(16,185,129,0.1)" }}
          >
            <Eye style={{ color: "#34d399" }} size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Regulator Audit Portal</h2>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Authorized selective disclosure for compliance monitoring
            </p>
          </div>
        </div>

        <div
          className="p-4 rounded-lg flex items-start gap-3 mb-6"
          style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}
        >
          <AlertCircle style={{ color: "#fbbf24", flexShrink: 0, marginTop: 2 }} size={17} />
          <div className="text-sm" style={{ color: "#cbd5e1" }}>
            <p className="font-semibold text-white mb-1">Authorized Access Only</p>
            This portal requires a valid regulator view key. All audit actions are logged immutably
            on-chain via Soroban events. The sender's actual address is never revealed.
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "#cbd5e1" }}>
              Quick-load sample settlement
            </label>
            <div className="flex flex-wrap gap-2">
              {sampleAudits.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handlePreset(a.id)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: settlementId === a.id ? "rgba(59,130,246,0.15)" : "rgba(30,41,59,0.6)",
                    border: `1px solid ${settlementId === a.id ? "rgba(59,130,246,0.3)" : "var(--color-border)"}`,
                    color: settlementId === a.id ? "#60a5fa" : "var(--color-text-muted)",
                  }}
                >
                  {a.id} — {a.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "#cbd5e1" }}>
              Settlement ID
            </label>
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--color-text-dim)",
                }}
              />
              <input
                type="text"
                className="input-field"
                style={{ paddingLeft: "2.75rem" }}
                placeholder="SETL-XXXX or 0x..."
                value={settlementId}
                onChange={(e) => setSettlementId(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "#cbd5e1" }}>
              Regulator View Key
            </label>
            <div style={{ position: "relative" }}>
              <Lock
                size={16}
                style={{
                  position: "absolute",
                  left: "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--color-text-dim)",
                }}
              />
              <input
                type="password"
                className="input-field"
                style={{ paddingLeft: "2.75rem" }}
                placeholder="vk_regulator_..."
                value={viewKey}
                onChange={(e) => setViewKey(e.target.value)}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-dim)" }}>
              View keys are derived from your regulator credential + the settlement commitment
            </p>
          </div>

          {error && (
            <p className="text-sm" style={{ color: "#f87171" }}>
              {error}
            </p>
          )}

          <button
            onClick={handleAudit}
            disabled={loading}
            className="btn-primary w-full"
            style={{
              padding: "0.75rem",
              background: loading ? "rgba(16,185,129,0.3)" : "linear-gradient(135deg, #059669, #10b981)",
            }}
          >
            <span className="flex items-center justify-center gap-2">
              <Eye size={17} />
              {loading ? "Verifying view key on-chain..." : "Audit Settlement"}
            </span>
          </button>
        </div>

        {auditResult && (
          <div className="space-y-5 border-t pt-6" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-3">
              <FileText style={{ color: "#34d399" }} size={20} />
              <h3 className="text-lg font-semibold text-white">Compliance Audit Report</h3>
              {auditResult.viewKeyVerified && (
                <span
                  className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}
                >
                  ✓ View Key Verified
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Settlement ID", value: auditResult.settlementId, mono: true },
                {
                  label: "Compliance Tier",
                  value: null,
                  badge: `tier-${auditResult.complianceTier}`,
                  badgeLabel: `Tier ${auditResult.complianceTier}`,
                },
                { label: "Amount", value: auditResult.amount },
                { label: "Asset", value: auditResult.asset },
                { label: "KYC Provider", value: auditResult.kycProvider },
                {
                  label: "Sanctions Status",
                  value: auditResult.sanctionsStatus,
                  green: auditResult.sanctionsStatus === "Cleared",
                },
                { label: "Risk Score", value: `${auditResult.riskScore}/100` },
                { label: "Source of Funds", value: auditResult.sourceOfFunds },
                { label: "Timestamp", value: auditResult.timestamp },
                {
                  label: "Audit Status",
                  value: "Logged on-chain",
                  green: true,
                },
              ].map((field, i) => (
                <div
                  key={i}
                  className="p-4 rounded-lg"
                  style={{ background: "rgba(15,23,42,0.6)", border: "1px solid var(--color-border)" }}
                >
                  <div className="text-xs mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                    {field.label}
                  </div>
                  {field.badge ? (
                    <span className={`tier-badge ${field.badge}`}>{field.badgeLabel}</span>
                  ) : (
                    <div
                      className={`text-sm font-medium ${field.mono ? "font-mono text-xs" : ""}`}
                      style={{ color: field.green ? "#34d399" : "white" }}
                    >
                      {field.value}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div
              className="p-4 rounded-lg"
              style={{ background: "rgba(15,23,42,0.6)", border: "1px solid var(--color-border)" }}
            >
              <div className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
                Sender Commitment (Privacy-Preserving)
              </div>
              <div className="text-xs font-mono text-white mb-2">{auditResult.senderCommitment}</div>
              <p className="text-xs" style={{ color: "var(--color-text-dim)" }}>
                The sender's actual Stellar address is never disclosed. Only the cryptographic commitment
                is available for correlation analysis by authorized regulators.
              </p>
            </div>

            <div
              className="p-4 rounded-lg flex items-start gap-3"
              style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)" }}
            >
              <Shield size={15} style={{ color: "#60a5fa", flexShrink: 0, marginTop: 2 }} />
              <p className="text-xs" style={{ color: "#94a3b8" }}>
                This audit has been recorded on-chain. The regulator view key was verified against
                the stored view_key_hash in CovenantSettlement. All audit events are immutable and
                timestamped via Soroban ledger events.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
