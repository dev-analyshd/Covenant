import {
  Shield, Lock, Eye, Zap, Globe, Activity, FileCheck,
  ExternalLink, CheckCircle2, AlertTriangle,
  TrendingUp, Server, Cpu, DollarSign, ArrowRight
} from "lucide-react";
import { useCovenantStore } from "../lib/store";
import {
  COVENANT_PUBLIC, shortKey, explorerTx, explorerAccount, explorerContract
} from "../lib/stellar";

const DEPLOYED_CONTRACTS = [
  { label: "CovenantRegistry",  id: "CDGVCDVWUZSCO4AIE34RVOEV7GUMZYGS7WN7PIJMZF5GN3K7WI3NZ7NJ" },
  { label: "CovenantSettlement", id: "CC2CNABDTKZ7ZJGZHP24IE43GNW7PUZPOUZJ6SNGMSLQVWEGQO62EKKI" },
  { label: "UltraHonkVerifier", id: "CAURSBIA5JVEZTRDN2OATBLMQUUTNEDFKJUDHUB5KBDKF3JCGCT67VYW" },
  { label: "ComplianceBridge",  id: "CCHOTPRBSC52QENAQ7KTZN6BMYZG4JD3JOZ7GXPUVIA5X2LVF6QT3JP2" },
];

function StatCard({
  label, value, sub, icon, color, loading
}: {
  label: string; value: string; sub: string; icon: React.ReactNode; color: string; loading?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}14`, color }}
        >
          {icon}
        </div>
        <span className="label-sm" style={{ color }}>Live</span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="skeleton h-7 w-24 rounded" />
          <div className="skeleton h-4 w-32 rounded" />
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold text-white mb-0.5 font-mono">{value}</div>
          <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>{label}</div>
          <div className="text-xs mt-1.5" style={{ color: "var(--color-text-dim)" }}>{sub}</div>
        </>
      )}
    </div>
  );
}

const ZK_FLOW = [
  { n: "1", label: "Off-chain Proving", desc: "Noir circuit computes witness & UltraHonk proof (256 bytes)", color: "#3b82f6" },
  { n: "2", label: "On-chain Verification", desc: "Soroban contract verifies via Protocol 26 BN254 host functions", color: "#8b5cf6" },
  { n: "3", label: "Credential Registry", desc: "Nullifier committed — credential usable once (Sybil-resistant)", color: "#06b6d4" },
  { n: "4", label: "Private Settlement", desc: "SAC token transfer behind ZK gate — amounts never on-chain", color: "#10b981" },
  { n: "5", label: "Regulator Audit", desc: "View key unlocks compliance trail — access logged on-chain", color: "#f59e0b" },
];

const ARCH_LAYERS = [
  {
    label: "Layer 1 — Noir ZK Circuits", color: "#3b82f6",
    items: [
      { name: "compliance_credential.nr", desc: "KYC + sanctions + risk score + expiry via Poseidon2 Merkle trees (12,847 constraints)" },
      { name: "private_settlement.nr", desc: "Balance sufficiency + tier-adjusted limit range proof (8,192 constraints)" },
    ]
  },
  {
    label: "Layer 2 — Soroban Contracts", color: "#8b5cf6",
    items: [
      { name: "UltraHonkVerifier", desc: "BN254 proof verification via Protocol 26 host functions (bn254_add, bn254_mul, bn254_pairing)" },
      { name: "CovenantRegistry", desc: "Nullifier tracking, tier storage, credential lifecycle, 90-day TTL" },
      { name: "CovenantSettlement", desc: "ZK-gated SAC transfers, encrypted compliance trail, audit log" },
      { name: "ComplianceBridge", desc: "Cross-currency settlement via Stellar DEX path payment" },
    ]
  },
  {
    label: "Layer 3 — Compliance", color: "#10b981",
    items: [
      { name: "View Key System", desc: "view_key = poseidon2(credential_secret ‖ regulator_pk) — selective disclosure" },
      { name: "Stellar Compliance", desc: "Native AUTH_REQUIRED, freeze, clawback in SAC consensus layer" },
    ]
  },
];

const TIER_DATA = [
  { tier: 5, label: "Platinum", score: "0–10", limit: "$1,000,000", color: "#34d399" },
  { tier: 4, label: "Gold",     score: "11–25", limit: "$800,000",  color: "#60a5fa" },
  { tier: 3, label: "Silver",   score: "26–50", limit: "$600,000",  color: "#fbbf24" },
  { tier: 2, label: "Bronze",   score: "51–75", limit: "$400,000",  color: "#fb923c" },
  { tier: 1, label: "Basic",    score: "76–100", limit: "$200,000", color: "#f87171" },
];

const GETTING_STARTED = [
  {
    step: "1",
    title: "Generate a Compliance Credential",
    plain: "Pick your KYC provider, enter your risk score, and Covenant will generate a 256-byte zero-knowledge proof that you're compliant — without revealing any personal data.",
    tab: "Credential",
    color: "#3b82f6",
  },
  {
    step: "2",
    title: "Execute a Private Settlement",
    plain: "Enter an amount, a recipient Stellar address, and pick a stablecoin. The ZK proof gates the transfer — the amount and counterparties are never visible on-chain.",
    tab: "Settlement",
    color: "#8b5cf6",
  },
  {
    step: "3",
    title: "Privacy Set (Optional)",
    plain: "Pool funds anonymously using the ASP. Deposits become Poseidon2 commitments; withdrawals prove membership without linking to the deposit.",
    tab: "ASP",
    color: "#f59e0b",
  },
  {
    step: "4",
    title: "Regulator Audit",
    plain: "Regulators can inspect a settlement using a view key. Compliance details are revealed only to the keyholder — access is logged on-chain.",
    tab: "Regulator",
    color: "#10b981",
  },
];

export default function Dashboard() {
  const {
    account, transactions, networkStats, loading,
    credentials, settlements, lastRefresh, totalProofsGenerated
  } = useCovenantStore();

  const xlmBalance = account?.balances.find((b) => b.asset_type === "native")?.balance ?? "—";
  const ledgerSeq = networkStats?.ledger?.sequence;
  const txCount = networkStats?.ledger?.successful_transaction_count;
  const feeMode = networkStats?.fee_stats?.fee_charged?.mode;

  return (
    <div className="space-y-6 animate-in">
      <div className="glass glow-primary p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="label-sm" style={{ color: "var(--color-primary)" }}>
                Stellar Hacks: Real-World ZK · June 2026
              </span>
              <span className="status-dot online" />
              <span className="text-xs" style={{ color: "#34d399" }}>Testnet Live</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              Private Settlement with{" "}
              <span className="gradient-text">Provable Compliance</span>
            </h1>
            <p className="text-sm sm:text-base leading-relaxed max-w-2xl" style={{ color: "var(--color-text-muted)" }}>
              Covenant enables institutions to execute cross-border stablecoin settlements on Stellar
              with zero-knowledge compliance verification. Prove KYC, sanctions clearance, and risk scores
              without revealing identity — auditable by regulators on demand. <strong className="text-white">ZK is the gatekeeper: no valid proof, no settlement.</strong>
            </p>
            <div className="flex flex-wrap gap-4 pt-1">
              {[
                { icon: <Zap size={14} />, label: "Noir + UltraHonk", color: "#34d399" },
                { icon: <Activity size={14} />, label: "Protocol 26 BN254", color: "#60a5fa" },
                { icon: <Shield size={14} />, label: "256-byte ZK Proofs", color: "#a78bfa" },
                { icon: <Eye size={14} />, label: "View Key Compliance", color: "#38bdf8" },
                { icon: <Globe size={14} />, label: "Stellar DEX Settlement", color: "#34d399" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: f.color }}>
                  {f.icon} {f.label}
                </div>
              ))}
            </div>
          </div>
          <div className="flex-shrink-0">
            <div
              className="rounded-xl p-4 space-y-3 text-sm min-w-64"
              style={{ background: "rgba(15,23,42,0.8)", border: "1px solid var(--color-border)" }}
            >
              <div className="label-sm">Testnet Account</div>
              <div className="flex items-center justify-between gap-2">
                <span style={{ color: "var(--color-text-muted)" }}>Address</span>
                <a
                  href={explorerAccount(COVENANT_PUBLIC)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 mono text-xs hover:underline"
                  style={{ color: "#60a5fa" }}
                >
                  {shortKey(COVENANT_PUBLIC)} <ExternalLink size={10} />
                </a>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span style={{ color: "var(--color-text-muted)" }}>XLM Balance</span>
                <span className="font-bold font-mono" style={{ color: "#34d399" }}>
                  {loading ? "…" : parseFloat(xlmBalance || "0").toLocaleString()} XLM
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span style={{ color: "var(--color-text-muted)" }}>Network</span>
                <span className="flex items-center gap-1" style={{ color: "#fbbf24" }}>
                  <span className="status-dot online" /> Testnet
                </span>
              </div>
              {totalProofsGenerated > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span style={{ color: "var(--color-text-muted)" }}>Session Proofs</span>
                  <span className="flex items-center gap-1 font-mono font-bold" style={{ color: "#a78bfa" }}>
                    <Cpu size={11} /> {totalProofsGenerated}
                  </span>
                </div>
              )}
              {lastRefresh && (
                <div className="flex items-center justify-between gap-2">
                  <span style={{ color: "var(--color-text-muted)" }}>Last sync</span>
                  <span style={{ color: "var(--color-text-dim)", fontSize: "0.7rem" }}>
                    {lastRefresh.toLocaleTimeString()}
                  </span>
                </div>
              )}
              <div className="border-t pt-2 mt-1" style={{ borderColor: "var(--color-border-subtle)" }}>
                <div className="label-sm mb-2" style={{ color: "#8b5cf6" }}>Deployed Contracts ✓</div>
                {DEPLOYED_CONTRACTS.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs" style={{ color: "var(--color-text-dim)" }}>{c.label}</span>
                    <a
                      href={explorerContract(c.id)}
                      target="_blank" rel="noopener noreferrer"
                      className="mono text-xs hover:underline flex items-center gap-1"
                      style={{ color: "#a78bfa" }}
                    >
                      {c.id.slice(0, 6)}…{c.id.slice(-4)} <ExternalLink size={9} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Getting Started Guide ──────────────────────────────────────── */}
      <div className="glass p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={15} style={{ color: "#fbbf24" }} />
          <h3 className="text-sm font-semibold text-white">Getting Started — 4 Steps</h3>
          <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>
            Plain English
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {GETTING_STARTED.map((g) => (
            <div key={g.step} className="rounded-xl p-4" style={{ background: `${g.color}08`, border: `1px solid ${g.color}20` }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: `${g.color}20`, color: g.color, border: `1px solid ${g.color}40` }}>
                  {g.step}
                </div>
                <span className="text-xs font-semibold text-white">{g.title}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-dim)" }}>{g.plain}</p>
              <div className="flex items-center gap-1 mt-2 text-xs font-medium" style={{ color: g.color }}>
                <ArrowRight size={11} /> Go to {g.tab}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="XLM Balance" icon={<TrendingUp size={18} />} color="#3b82f6" loading={loading}
          value={loading ? "…" : `${parseFloat(xlmBalance || "0").toLocaleString()}`}
          sub="Stellar testnet · live Horizon"
        />
        <StatCard
          label="Ledger Sequence" icon={<Server size={18} />} color="#8b5cf6" loading={loading}
          value={loading ? "…" : (ledgerSeq ? `#${ledgerSeq.toLocaleString()}` : "—")}
          sub="Current ledger height"
        />
        <StatCard
          label="Tx This Ledger" icon={<Activity size={18} />} color="#06b6d4" loading={loading}
          value={loading ? "…" : (txCount != null ? txCount.toString() : "—")}
          sub="Successful transactions"
        />
        <StatCard
          label="Base Fee" icon={<Zap size={18} />} color="#10b981" loading={loading}
          value={loading ? "…" : (feeMode ? `${feeMode} str` : "100 str")}
          sub="Mode fee in stroops"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-white mb-5">System Architecture</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ARCH_LAYERS.map((layer) => (
              <div key={layer.label} className="space-y-2.5">
                <div className="label-sm" style={{ color: layer.color }}>{layer.label}</div>
                {layer.items.map((item) => (
                  <div key={item.name} className="glass-subtle p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: layer.color }}
                      />
                      <span className="text-xs font-medium text-white truncate">{item.name}</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-dim)", paddingLeft: "0.875rem" }}>
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-white mb-5">ZK Proof Flow</h3>
          <div className="space-y-1">
            {ZK_FLOW.map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: `${step.color}18`, color: step.color, border: `1px solid ${step.color}30` }}
                  >
                    {step.n}
                  </div>
                  {i < ZK_FLOW.length - 1 && (
                    <div className="w-px flex-1 my-1" style={{ background: "var(--color-border-subtle)" }} />
                  )}
                </div>
                <div className="pb-4 min-w-0">
                  <div className="text-xs font-semibold text-white">{step.label}</div>
                  <div className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Live Testnet Transactions</h3>
            <a
              href={explorerAccount(COVENANT_PUBLIC)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-xs"
            >
              <ExternalLink size={11} /> View all
            </a>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color: "var(--color-text-dim)" }}>
              No transactions found
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto scrollbar-thin max-h-80">
              {transactions.map((tx) => (
                <div key={tx.id} className="table-row">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: tx.successful ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                      color: tx.successful ? "#34d399" : "#f87171",
                    }}
                  >
                    {tx.successful ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white truncate">{tx.hash.slice(0, 16)}…</span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: "rgba(30,45,69,0.8)", color: "var(--color-text-dim)" }}
                      >
                        {tx.operation_count} op{tx.operation_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--color-text-dim)" }}>
                      Ledger #{tx.ledger} · {new Date(tx.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                  <a
                    href={explorerTx(tx.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                    style={{ color: "var(--color-text-dim)" }}
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Compliance Tier System</h3>
          <div className="space-y-2">
            {TIER_DATA.map((t) => (
              <div key={t.tier} className="flex items-center gap-3 p-2.5 rounded-lg"
                style={{ background: "rgba(22,27,39,0.5)", border: "1px solid var(--color-border-subtle)" }}>
                <span className={`tier-badge tier-${t.tier} flex-shrink-0`}>
                  Tier {t.tier}
                </span>
                <span className="text-xs font-medium flex-shrink-0" style={{ color: t.color }}>{t.label}</span>
                <span className="text-xs flex-shrink-0" style={{ color: "var(--color-text-dim)" }}>risk {t.score}</span>
                <div className="flex-1" />
                <span className="text-xs font-mono font-bold" style={{ color: t.color }}>{t.limit}</span>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--color-text-dim)" }}>
            Tier is computed deterministically in the ZK circuit —{" "}
            <span className="text-white">the smart contract cannot override it.</span>
          </p>
        </div>
      </div>

      <div className="glass p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Circuit Specification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="label-sm mb-2" style={{ color: "#60a5fa" }}>compliance_credential.nr</div>
            <div
              className="p-3 rounded-lg text-xs space-y-1 font-mono overflow-x-auto"
              style={{ background: "rgba(6,9,16,0.8)", border: "1px solid var(--color-border-subtle)" }}
            >
              <div style={{ color: "#475569" }}>// Private inputs (12,847 constraints, never on-chain)</div>
              <div style={{ color: "#64748b" }}>kyc_hash: Field,  sanctions_hash: Field</div>
              <div style={{ color: "#64748b" }}>risk_score: u32,  credential_secret: Field</div>
              <div style={{ color: "#64748b" }}>kyc_path: [Field; 32],  kyc_indices: [u32; 32]</div>
              <div style={{ color: "#475569" }}>{"\n"}// Constraints</div>
              <div style={{ color: "#7dd3fc" }}>assert(kyc_leaf ∈ TrustedIssuerTree)</div>
              <div style={{ color: "#7dd3fc" }}>assert(sanctions_leaf ∈ ClearedTree)</div>
              <div style={{ color: "#7dd3fc" }}>assert(risk_score ≤ tier_threshold)</div>
              <div style={{ color: "#7dd3fc" }}>assert(expiry &gt; now)</div>
              <div style={{ color: "#475569" }}>{"\n"}// Outputs</div>
              <div style={{ color: "#86efac" }}>→ (nullifier, compliance_tier, view_key_hash)</div>
            </div>
          </div>
          <div>
            <div className="label-sm mb-2" style={{ color: "#a78bfa" }}>private_settlement.nr</div>
            <div
              className="p-3 rounded-lg text-xs space-y-1 font-mono overflow-x-auto"
              style={{ background: "rgba(6,9,16,0.8)", border: "1px solid var(--color-border-subtle)" }}
            >
              <div style={{ color: "#475569" }}>// Private inputs (8,192 constraints, never on-chain)</div>
              <div style={{ color: "#64748b" }}>amount: u64,  sender_balance: u64</div>
              <div style={{ color: "#64748b" }}>compliance_tier: u32,  sender_secret: Field</div>
              <div style={{ color: "#475569" }}>{"\n"}// Constraints</div>
              <div style={{ color: "#c4b5fd" }}>assert(sender_balance ≥ amount) // range proof</div>
              <div style={{ color: "#c4b5fd" }}>assert(amount ≤ tier_limit(compliance_tier))</div>
              <div style={{ color: "#c4b5fd" }}>assert(compliance_nullifier ≠ 0)</div>
              <div style={{ color: "#475569" }}>{"\n"}// Outputs</div>
              <div style={{ color: "#86efac" }}>→ (settlement_hash, attestation, sender_commitment)</div>
            </div>
          </div>
        </div>
      </div>

      {(credentials.length > 0 || settlements.length > 0) && (
        <div className="glass p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Session Activity</h3>
          <div className="space-y-2">
            {credentials.map((c) => (
              <div key={c.id} className="table-row">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}>
                  <FileCheck size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">Compliance Credential Issued</span>
                    <span className="text-xs font-mono" style={{ color: "var(--color-text-dim)" }}>{c.proofSizeBytes}B proof</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--color-text-dim)" }}>
                    {c.kycProvider} · risk {c.riskScore} · {c.issuedAt.toLocaleTimeString()}
                  </div>
                </div>
                <span className={`tier-badge tier-${c.tier}`}>Tier {c.tier}</span>
              </div>
            ))}
            {settlements.map((s) => (
              <div key={s.id} className="table-row">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa" }}>
                  <Lock size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">
                      Private Settlement {s.amount} {s.fromAsset}{s.crossCurrency ? ` → ${s.toAsset}` : ""}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--color-text-dim)" }}>
                    {s.id} · {s.timestamp.toLocaleTimeString()}
                  </div>
                </div>
                <span className={`tier-badge tier-${s.tier}`}>Tier {s.tier}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
