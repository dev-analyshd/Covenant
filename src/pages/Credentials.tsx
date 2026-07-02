import { useCovenantStore } from "../lib/store";
import { useCredentialStore, TIER_LIMITS, PROOF_STEPS } from "../lib/credentialStore";
import { ProofGenerationPanel } from "../components/shared/ProofGenerationPanel";
import {
  FileBadge, Shield, CheckCircle2, Clock, AlertTriangle,
  ExternalLink, RefreshCw, Plus, ChevronRight, Calendar
} from "lucide-react";
import { explorerTx, shortKey } from "../lib/stellar";
import { toast } from "sonner";
import type { CredentialRecord } from "../lib/store";

function daysUntilExpiry(expiresAt: Date): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));
}

function CredentialCard({ cred }: { cred: CredentialRecord }) {
  const days = daysUntilExpiry(cred.expiresAt);
  const tier = TIER_LIMITS[cred.tier];
  const status = days <= 0 ? "expired" : days <= 14 ? "expiring" : "valid";

  const statusColor = {
    valid: "var(--accent-success)",
    expiring: "var(--accent-warning)",
    expired: "var(--accent-danger)",
  }[status];

  const statusBg = {
    valid: "var(--accent-success-subtle)",
    expiring: "var(--accent-warning-subtle)",
    expired: "var(--accent-danger-subtle)",
  }[status];

  return (
    <div
      className="p-5 rounded-xl transition-all"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--shielded-subtle)", color: "var(--shielded-primary)" }}
          >
            <Shield size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {cred.kycProvider.charAt(0).toUpperCase() + cred.kycProvider.slice(1)} KYC
            </p>
            <p className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
              {shortKey(cred.nullifier)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: statusBg, color: statusColor }}
          >
            {status === "valid" ? "Active" : status === "expiring" ? `${days}d left` : "Expired"}
          </span>
          {tier && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "var(--accent-primary-subtle)", color: "var(--accent-primary)" }}
            >
              Tier {cred.tier}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
        {[
          { label: "KYC Provider", value: cred.kycProvider },
          { label: "Risk Score", value: `${cred.riskScore}/100` },
          { label: "Limit", value: tier?.limit ?? "—" },
          { label: "Constraints", value: cred.circuitConstraints?.toLocaleString() ?? "—" },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: "var(--text-tertiary)" }}>{label}</p>
            <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
          <Calendar size={11} />
          Expires {new Date(cred.expiresAt).toLocaleDateString()}
        </div>
        {cred.txHash && (
          <a
            href={explorerTx(cred.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--accent-primary)" }}
          >
            <ExternalLink size={12} /> On-chain
          </a>
        )}
      </div>
    </div>
  );
}

export default function Credentials() {
  const { credentials } = useCovenantStore();
  const {
    kycProvider, riskScore, sourceOfFunds, country,
    isGenerating, currentStep, completedSteps, error, lastTxHash,
    setField, generate, reset,
  } = useCredentialStore();

  const predictedTier = Math.max(1, Math.min(5, Math.ceil((100 - riskScore) / 20)));
  const tier = TIER_LIMITS[predictedTier];

  const handleGenerate = async () => {
    await generate();
    if (!useCredentialStore.getState().error) {
      toast.success("Credential issued", { description: "ZK compliance credential registered on-chain" });
    }
  };

  const KYC_PROVIDERS = ["coinbase", "circle", "jumio", "sumsub", "onfido", "persona"];
  const COUNTRIES = ["US", "GB", "DE", "SG", "JP", "AU", "CA", "CH"];
  const SOURCES = ["employment", "business", "investment", "inheritance", "savings"];

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Credentials</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Issue and manage ZK compliance credentials
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Credential list */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Active Credentials ({credentials.length})
            </h2>
          </div>

          {credentials.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: "var(--bg-surface)", border: "1px dashed var(--border-default)" }}
            >
              <FileBadge size={32} className="mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
              <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>No credentials yet</p>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Issue your first ZK compliance credential to unlock private settlements
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {credentials.map((c) => <CredentialCard key={c.id} cred={c} />)}
            </div>
          )}
        </div>

        {/* Issue form */}
        <div
          className="lg:col-span-2 rounded-xl overflow-hidden"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Issue New Credential</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              ZK proof of KYC — identity never leaves your browser
            </p>
          </div>

          <div className="p-5 space-y-4">
            {isGenerating ? (
              <ProofGenerationPanel
                steps={PROOF_STEPS}
                currentStep={currentStep}
                completedSteps={completedSteps}
                error={error}
              />
            ) : lastTxHash ? (
              <div className="space-y-3">
                <div
                  className="p-4 rounded-lg flex items-center gap-3"
                  style={{ background: "var(--accent-success-subtle)" }}
                >
                  <CheckCircle2 size={18} style={{ color: "var(--accent-success)" }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--accent-success)" }}>Credential issued!</p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-tertiary)" }}>{shortKey(lastTxHash)}</p>
                  </div>
                </div>
                <button
                  onClick={reset}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
                >
                  <Plus size={14} /> Issue Another
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                    KYC Provider
                  </label>
                  <select
                    value={kycProvider}
                    onChange={(e) => setField("kycProvider", e.target.value as any)}
                    className="input-field"
                  >
                    {KYC_PROVIDERS.map((p) => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                    Risk Score: {riskScore}/100
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={99}
                    value={riskScore}
                    onChange={(e) => setField("riskScore", parseInt(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: "var(--accent-primary)" }}
                  />
                  <div className="flex justify-between text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                    <span>Low Risk</span><span>High Risk</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                    Source of Funds
                  </label>
                  <select
                    value={sourceOfFunds}
                    onChange={(e) => setField("sourceOfFunds", e.target.value as any)}
                    className="input-field"
                  >
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                    Jurisdiction
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setField("country", e.target.value as any)}
                    className="input-field"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Tier preview */}
                <div
                  className="p-3 rounded-lg flex items-center justify-between"
                  style={{ background: "var(--accent-primary-subtle)", border: "1px solid var(--border-default)" }}
                >
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                      Predicted Tier
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {tier?.limit ?? "—"} settlement limit
                    </p>
                  </div>
                  <div
                    className="text-lg font-bold"
                    style={{ color: tier?.color ?? "var(--accent-primary)" }}
                  >
                    Tier {predictedTier}
                  </div>
                </div>

                {error && (
                  <div
                    className="flex items-center gap-2 p-3 rounded-lg text-xs"
                    style={{ background: "var(--accent-danger-subtle)", color: "var(--accent-danger)" }}
                  >
                    <AlertTriangle size={13} />
                    {error}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: "var(--accent-primary)", color: "#fff" }}
                >
                  <Shield size={15} />
                  Generate ZK Credential
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
