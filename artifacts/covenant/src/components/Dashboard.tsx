import { Shield, Lock, Eye, Zap, Globe, Activity, FileCheck, Database } from "lucide-react";

const stats = [
  { label: "Credentials Issued", value: "1,247", change: "+12%", icon: <Shield size={20} />, color: "#3b82f6" },
  { label: "Private Settlements", value: "8,932", change: "+28%", icon: <Lock size={20} />, color: "#8b5cf6" },
  { label: "Cross-Currency", value: "3,456", change: "+15%", icon: <Globe size={20} />, color: "#06b6d4" },
  { label: "Regulator Audits", value: "156", change: "+5%", icon: <Eye size={20} />, color: "#10b981" },
];

const recentActivity = [
  { type: "credential", tier: 5, user: "0x7a3f...9e2d", time: "2 min ago", status: "verified" },
  { type: "settlement", amount: "$50,000", asset: "USDC → EURC", time: "5 min ago", status: "completed" },
  { type: "audit", regulator: "FCA", settlement: "0x9a2b...4c1e", time: "12 min ago", status: "audited" },
  { type: "credential", tier: 3, user: "0x3e8a...7f4c", time: "18 min ago", status: "verified" },
  { type: "settlement", amount: "$125,000", asset: "EURC → PYUSD", time: "31 min ago", status: "completed" },
];

const proofFlow = [
  { step: 1, label: "Generate ZK Proof", desc: "Noir circuit computes compliance credential off-chain", color: "#3b82f6" },
  { step: 2, label: "Register On-Chain", desc: "UltraHonk proof submitted to CovenantRegistry", color: "#8b5cf6" },
  { step: 3, label: "Private Settlement", desc: "Settlement hash stored, identity stays private", color: "#06b6d4" },
  { step: 4, label: "Regulator Audit", desc: "View key unlocks compliance trail on demand", color: "#10b981" },
];

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div className="glass-panel p-8 glow-border">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--color-primary)" }}>
            <Shield size={14} />
            Stellar Hacks: Real-World ZK · June 2026
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight">
            Private Settlement with{" "}
            <span style={{ color: "#60a5fa" }}>Provable Compliance</span>
          </h2>
          <p className="text-base leading-relaxed max-w-2xl" style={{ color: "var(--color-text-muted)" }}>
            Covenant enables institutions to execute cross-border stablecoin settlements with
            zero-knowledge compliance verification. Prove KYC, sanctions clearance, and risk scores
            without revealing identity or transaction details on the public ledger.
          </p>
          <div className="flex flex-wrap gap-6 pt-2">
            <div className="flex items-center gap-2" style={{ color: "#34d399" }}>
              <Zap size={16} />
              <span className="text-sm font-medium">Noir ZK Circuits</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: "#60a5fa" }}>
              <Activity size={16} />
              <span className="text-sm font-medium">Soroban Smart Contracts</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: "#a78bfa" }}>
              <Shield size={16} />
              <span className="text-sm font-medium">Stellar Protocol 26</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: "#38bdf8" }}>
              <Eye size={16} />
              <span className="text-sm font-medium">UltraHonk Proof System</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: `${stat.color}18`, color: stat.color }}
              >
                {stat.icon}
              </div>
              <span
                className="text-xs font-semibold px-2 py-1 rounded-full"
                style={{ background: "rgba(16,185,129,0.1)", color: "#34d399" }}
              >
                {stat.change}
              </span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
            <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 glass-panel p-6">
          <h3 className="text-base font-semibold text-white mb-5">System Architecture</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#60a5fa" }}>
                Layer 1 — Noir ZK Circuits
              </div>
              <div className="layer-card">
                <div className="flex items-center gap-2 mb-1">
                  <FileCheck size={14} style={{ color: "#60a5fa" }} />
                  <span className="text-sm font-medium text-white">Compliance Credential</span>
                </div>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Proves KYC, sanctions, risk score, expiry
                </p>
              </div>
              <div className="layer-card">
                <div className="flex items-center gap-2 mb-1">
                  <Lock size={14} style={{ color: "#60a5fa" }} />
                  <span className="text-sm font-medium text-white">Private Settlement</span>
                </div>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Proves balance + compliance constraints
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#a78bfa" }}>
                Layer 2 — Soroban Contracts
              </div>
              {[
                { name: "CovenantRegistry", desc: "Credentials & nullifiers" },
                { name: "CovenantSettlement", desc: "Private settlement exec" },
                { name: "ComplianceBridge", desc: "Cross-currency settlement" },
                { name: "UltraHonkVerifier", desc: "ZK proof verification" },
              ].map((c, i) => (
                <div key={i} className="layer-card">
                  <div className="flex items-center gap-2 mb-1">
                    <Database size={13} style={{ color: "#a78bfa" }} />
                    <span className="text-xs font-medium text-white">{c.name}</span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{c.desc}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#34d399" }}>
                Layer 3 — Compliance
              </div>
              <div className="layer-card">
                <div className="flex items-center gap-2 mb-1">
                  <Eye size={14} style={{ color: "#34d399" }} />
                  <span className="text-sm font-medium text-white">View Key System</span>
                </div>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Selective disclosure for regulators
                </p>
              </div>
              <div className="layer-card">
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={14} style={{ color: "#34d399" }} />
                  <span className="text-sm font-medium text-white">Stellar Compliance</span>
                </div>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Native freeze, clawback, authorization
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6">
          <h3 className="text-base font-semibold text-white mb-5">ZK Proof Flow</h3>
          <div className="space-y-4">
            {proofFlow.map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: `${step.color}20`, color: step.color, border: `1px solid ${step.color}40` }}
                  >
                    {step.step}
                  </div>
                  {i < proofFlow.length - 1 && (
                    <div className="w-px flex-1 mt-1" style={{ background: "var(--color-border)" }} />
                  )}
                </div>
                <div className="pb-4">
                  <div className="text-sm font-medium text-white">{step.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel p-6">
        <h3 className="text-base font-semibold text-white mb-4">Recent Activity</h3>
        <div className="space-y-2">
          {recentActivity.map((activity, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3.5 rounded-lg"
              style={{ background: "rgba(30,41,59,0.4)", border: "1px solid rgba(30,45,69,0.6)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{
                    background:
                      activity.type === "credential"
                        ? "rgba(59,130,246,0.12)"
                        : activity.type === "settlement"
                          ? "rgba(139,92,246,0.12)"
                          : "rgba(16,185,129,0.12)",
                    color:
                      activity.type === "credential"
                        ? "#60a5fa"
                        : activity.type === "settlement"
                          ? "#a78bfa"
                          : "#34d399",
                  }}
                >
                  {activity.type === "credential" ? (
                    <FileCheck size={16} />
                  ) : activity.type === "settlement" ? (
                    <Lock size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    {activity.type === "credential" && `Tier ${activity.tier} Credential Issued`}
                    {activity.type === "settlement" && `Private Settlement ${activity.amount}`}
                    {activity.type === "audit" && `Regulator Audit by ${activity.regulator}`}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {activity.user || activity.asset || activity.settlement} · {activity.time}
                  </div>
                </div>
              </div>
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{
                  background:
                    activity.status === "verified"
                      ? "rgba(59,130,246,0.12)"
                      : activity.status === "completed"
                        ? "rgba(16,185,129,0.12)"
                        : "rgba(139,92,246,0.12)",
                  color:
                    activity.status === "verified"
                      ? "#60a5fa"
                      : activity.status === "completed"
                        ? "#34d399"
                        : "#a78bfa",
                }}
              >
                {activity.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
