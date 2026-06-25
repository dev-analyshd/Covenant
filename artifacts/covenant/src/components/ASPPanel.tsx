import { useState, useCallback } from "react";
import {
  Users, Shield, AlertCircle, CheckCircle2, Loader2,
  ArrowDown, ArrowUp, Lock, Info, ExternalLink, Database,
  Activity, Globe
} from "lucide-react";
import { useCovenantStore, ASPDeposit, ASPWithdrawal } from "../lib/store";

const API_BASE = "/api";

async function apiPost(path: string, body: object) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `HTTP ${r.status}`);
  }
  return r.json();
}

async function apiGet(path: string) {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const ASSETS = ["USDC", "EURC", "PYUSD", "GYEN", "XLM"];
const VASPS = ["Self / Retail", "Coinbase", "Kraken", "Binance", "Bitstamp", "OKX", "Other"];

function randHex(n: number) {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return "0x" + Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");
}

function TravelRuleBadge({ required, completed }: { required: boolean; completed: boolean }) {
  if (!required) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
        N/A ({"<"}$1K)
      </span>
    );
  }
  if (completed) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
        ✓ TR Completed
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}>
      ⚠ TR Pending
    </span>
  );
}

export default function ASPPanel() {
  const { aspDeposits, aspWithdrawals, credentials, addASPDeposit, addASPWithdrawal } = useCovenantStore();

  const [tab, setTab] = useState<"deposit" | "withdraw" | "audit">("deposit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Deposit form
  const [depositForm, setDepositForm] = useState({
    asset: "USDC",
    usdAmount: "",
    vasp: "Self / Retail",
  });

  // Withdrawal form
  const [withdrawForm, setWithdrawForm] = useState({
    depositId: "",
    asset: "USDC",
    usdAmount: "",
    recipientVasp: "Coinbase",
    travelRuleToken: "",
  });

  // Audit data
  const [auditData, setAuditData] = useState<any>(null);

  const bestNullifier = credentials.length > 0 ? credentials[0].nullifier : randHex(32);

  const handleDeposit = useCallback(async () => {
    if (!depositForm.usdAmount) { setError("Enter amount"); return; }
    setError(""); setSuccess(""); setLoading(true);
    try {
      const result = await apiPost("/asp/deposit", {
        asset: depositForm.asset,
        usdAmount: parseFloat(depositForm.usdAmount),
        nullifier: bestNullifier,
        complianceTier: credentials.length > 0 ? credentials[0].tier : 3,
        vasp: depositForm.vasp,
        proofHash: randHex(32).slice(2),
      });

      const deposit: ASPDeposit = {
        id: result.depositId,
        commitmentHash: result.commitmentHash,
        asset: depositForm.asset,
        amountBand: result.amountBand,
        privacySetSize: result.privacySetSize,
        timestamp: new Date(),
        travelRuleRequired: result.travelRuleRequired,
        travelRuleCompleted: !result.travelRuleRequired,
        vasp: depositForm.vasp,
      };

      addASPDeposit(deposit);
      setSuccess(`Deposit ${result.depositId} added to privacy set (size: ${result.privacySetSize})`);
      setDepositForm(f => ({ ...f, usdAmount: "" }));
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, [depositForm, bestNullifier, credentials, addASPDeposit]);

  const handleWithdraw = useCallback(async () => {
    if (!withdrawForm.depositId || !withdrawForm.usdAmount) { setError("Select deposit and enter amount"); return; }
    const amount = parseFloat(withdrawForm.usdAmount);
    const travelRuleRequired = amount >= 1000;
    if (travelRuleRequired && !withdrawForm.travelRuleToken) {
      setError("Travel Rule exchange required for amounts ≥ $1,000. Provide TR token.");
      return;
    }
    setError(""); setSuccess(""); setLoading(true);
    try {
      const result = await apiPost("/asp/withdraw", {
        depositId: withdrawForm.depositId,
        asset: withdrawForm.asset,
        usdAmount: amount,
        recipientVasp: withdrawForm.recipientVasp,
        travelRuleToken: withdrawForm.travelRuleToken || undefined,
      });

      const withdrawal: ASPWithdrawal = {
        id: result.withdrawalId,
        depositId: withdrawForm.depositId,
        membershipProof: result.membershipProof,
        asset: withdrawForm.asset,
        amountBand: result.amountBand,
        timestamp: new Date(),
        recipientVasp: withdrawForm.recipientVasp,
        travelRuleExchange: travelRuleRequired,
        privacySetSize: result.privacySetSize,
      };

      addASPWithdrawal(withdrawal);
      setSuccess(`Withdrawal ${result.withdrawalId} proven — membership proof: ${result.membershipProof.slice(0, 16)}…`);
      setWithdrawForm(f => ({ ...f, usdAmount: "", travelRuleToken: "" }));
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, [withdrawForm, addASPWithdrawal]);

  const loadAudit = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/asp/audit");
      setAuditData(data);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const TABS = [
    { id: "deposit" as const, label: "🏦 Deposit", icon: <ArrowDown size={13} /> },
    { id: "withdraw" as const, label: "📤 Withdraw", icon: <ArrowUp size={13} /> },
    { id: "audit" as const, label: "📋 FATF Audit", icon: <Activity size={13} /> },
  ];

  return (
    <div className="max-w-3xl mx-auto animate-in space-y-6">
      {/* Header */}
      <div className="glass p-6 sm:p-8">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,158,11,0.1)" }}>
            <Users style={{ color: "#fbbf24" }} size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">ASP — Associated Set Provider</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Privacy-preserving transaction sets · FATF Travel Rule compliance · ZK membership proofs
            </p>
          </div>
        </div>

        {/* Privacy model explainer */}
        <div className="p-4 rounded-lg flex items-start gap-3 mb-5" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
          <Info size={14} style={{ color: "#fbbf24", flexShrink: 0, marginTop: 2 }} />
          <div className="text-xs" style={{ color: "#fde68a" }}>
            <p className="font-semibold text-white mb-1">How ASP Privacy Works</p>
            <p>
              Deposits are added to a privacy set as Poseidon2 commitments. Withdrawals prove
              set membership via ZK proof — linking deposit to withdrawal without revealing
              amounts or identities. FATF Travel Rule (≥$1K transfers) is satisfied via
              encrypted VASP-to-VASP information exchange.
            </p>
          </div>
        </div>

        {/* Privacy set stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Privacy Set Size", value: aspDeposits.length.toString(), color: "#fbbf24", icon: <Lock size={13}/> },
            { label: "Withdrawals Proven", value: aspWithdrawals.length.toString(), color: "#34d399", icon: <CheckCircle2 size={13}/> },
            { label: "TR Pending", value: aspDeposits.filter(d => d.travelRuleRequired && !d.travelRuleCompleted).length.toString(), color: "#f87171", icon: <AlertCircle size={13}/> },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
              <div className="flex items-center justify-center gap-1 mb-1" style={{ color: s.color }}>
                {s.icon}
                <span className="text-xs font-medium">{s.label}</span>
              </div>
              <div className="text-xl font-bold mono" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 p-1 rounded-lg mb-5" style={{ background: "rgba(13,17,23,0.6)" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(""); setSuccess(""); if (t.id === "audit") loadAudit(); }}
              className="flex-1 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5"
              style={{
                background: tab === t.id ? "rgba(245,158,11,0.15)" : "transparent",
                color: tab === t.id ? "#fbbf24" : "var(--color-text-muted)",
                border: tab === t.id ? "1px solid rgba(245,158,11,0.25)" : "1px solid transparent",
              }}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg flex items-start gap-2" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertCircle size={13} style={{ color: "#f87171", flexShrink: 0, marginTop: 1 }} />
            <p className="text-xs" style={{ color: "#fca5a5" }}>{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg flex items-start gap-2" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <CheckCircle2 size={13} style={{ color: "#34d399", flexShrink: 0, marginTop: 1 }} />
            <p className="text-xs" style={{ color: "#6ee7b7" }}>{success}</p>
          </div>
        )}

        {/* ── Deposit Tab ── */}
        {tab === "deposit" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Asset</label>
                <select className="input-field" value={depositForm.asset} onChange={e => setDepositForm(f => ({ ...f, asset: e.target.value }))}>
                  {ASSETS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>USD Amount</label>
                <input type="number" className="input-field" placeholder="e.g. 5000"
                  value={depositForm.usdAmount} onChange={e => setDepositForm(f => ({ ...f, usdAmount: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Originating VASP</label>
              <select className="input-field" value={depositForm.vasp} onChange={e => setDepositForm(f => ({ ...f, vasp: e.target.value }))}>
                {VASPS.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>

            {parseFloat(depositForm.usdAmount) >= 1000 && (
              <div className="p-3 rounded-lg flex items-start gap-2" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <AlertCircle size={13} style={{ color: "#fbbf24", flexShrink: 0, marginTop: 1 }} />
                <p className="text-xs" style={{ color: "#fde68a" }}>
                  FATF Travel Rule applies (≥$1,000). You will need to complete a VASP-to-VASP
                  information exchange before withdrawal. Travel Rule token will be required.
                </p>
              </div>
            )}

            <div className="p-3 rounded-lg" style={{ background: "rgba(6,9,16,0.8)", border: "1px solid var(--color-border-subtle)" }}>
              <div className="label-sm mb-1.5">Commitment Preview</div>
              <div className="font-mono text-xs" style={{ color: "#6ee7b7" }}>
                commitment = poseidon2(nullifier ‖ asset ‖ amount)
              </div>
              <div className="font-mono text-xs mt-1" style={{ color: "#475569" }}>
                nullifier: {bestNullifier.slice(0, 18)}…
              </div>
            </div>

            <button
              onClick={handleDeposit}
              disabled={loading || !depositForm.usdAmount}
              className="btn-primary w-full"
              style={{ padding: "0.75rem", background: "linear-gradient(135deg,#d97706,#f59e0b)" }}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Adding to Privacy Set…</> : <><Database size={16} /> Deposit to Privacy Set</>}
            </button>
          </div>
        )}

        {/* ── Withdraw Tab ── */}
        {tab === "withdraw" && (
          <div className="space-y-4">
            {aspDeposits.length === 0 ? (
              <div className="text-center py-8">
                <Database size={32} style={{ color: "#475569", margin: "0 auto 1rem" }} />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No deposits in privacy set yet</p>
                <p className="text-xs mt-1" style={{ color: "var(--color-text-dim)" }}>Deposit first to create a withdrawal</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Deposit to Withdraw From</label>
                  <select className="input-field" value={withdrawForm.depositId} onChange={e => setWithdrawForm(f => ({ ...f, depositId: e.target.value }))}>
                    <option value="">Select deposit…</option>
                    {aspDeposits.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.id} · {d.asset} · {d.amountBand} · {d.travelRuleRequired && !d.travelRuleCompleted ? "⚠ TR Pending" : "✓ OK"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Asset</label>
                    <select className="input-field" value={withdrawForm.asset} onChange={e => setWithdrawForm(f => ({ ...f, asset: e.target.value }))}>
                      {ASSETS.map(a => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>USD Amount</label>
                    <input type="number" className="input-field" placeholder="e.g. 5000"
                      value={withdrawForm.usdAmount} onChange={e => setWithdrawForm(f => ({ ...f, usdAmount: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Recipient VASP</label>
                  <select className="input-field" value={withdrawForm.recipientVasp} onChange={e => setWithdrawForm(f => ({ ...f, recipientVasp: e.target.value }))}>
                    {VASPS.map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>

                {parseFloat(withdrawForm.usdAmount) >= 1000 && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "#fbbf24" }}>
                      Travel Rule Token (required ≥ $1,000)
                    </label>
                    <input className="input-field font-mono text-xs" placeholder="TR token from originating VASP…"
                      value={withdrawForm.travelRuleToken} onChange={e => setWithdrawForm(f => ({ ...f, travelRuleToken: e.target.value }))} />
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-dim)" }}>
                      FATF Recommendation 16: encrypted originator/beneficiary info exchanged between VASPs
                    </p>
                  </div>
                )}

                <button
                  onClick={handleWithdraw}
                  disabled={loading || !withdrawForm.depositId || !withdrawForm.usdAmount}
                  className="btn-primary w-full"
                  style={{ padding: "0.75rem", background: "linear-gradient(135deg,#059669,#10b981)" }}
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Proving Membership…</> : <><Shield size={16} /> Prove Membership &amp; Withdraw</>}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── FATF Audit Tab ── */}
        {tab === "audit" && (
          <div className="space-y-4">
            {loading && (
              <div className="text-center py-6">
                <Loader2 size={24} className="animate-spin mx-auto mb-2" style={{ color: "#fbbf24" }} />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading audit data…</p>
              </div>
            )}

            {auditData && !loading && (
              <div className="space-y-4">
                {/* Compliance overview */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Travel Rule Required", value: auditData.travelRule?.required ?? 0, color: "#f87171" },
                    { label: "TR Completed", value: auditData.travelRule?.completed ?? 0, color: "#34d399" },
                    { label: "TR Compliance Rate", value: auditData.travelRule?.complianceRate ?? "N/A", color: "#60a5fa" },
                    { label: "Privacy Set Size", value: auditData.privacySetSize ?? 0, color: "#fbbf24" },
                  ].map(s => (
                    <div key={s.label} className="glass-subtle p-3">
                      <div className="text-xs mb-1" style={{ color: "var(--color-text-dim)" }}>{s.label}</div>
                      <div className="text-lg font-bold mono" style={{ color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Deposit log */}
                <div>
                  <div className="label-sm mb-2">Privacy Set Deposits</div>
                  {(auditData.deposits || []).length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--color-text-dim)" }}>No deposits recorded</p>
                  ) : (
                    <div className="space-y-2">
                      {(auditData.deposits || []).map((d: any, i: number) => (
                        <div key={i} className="table-row text-xs">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white">{d.id}</div>
                            <div style={{ color: "var(--color-text-dim)" }}>
                              {d.asset} · {d.amountBand} · {d.vasp}
                            </div>
                          </div>
                          <TravelRuleBadge required={d.travelRuleRequired} completed={d.travelRuleCompleted} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-lg" style={{ background: "rgba(6,9,16,0.8)", border: "1px solid var(--color-border-subtle)" }}>
                  <div className="text-xs" style={{ color: "#64748b" }}>{auditData.fatfNote}</div>
                </div>
              </div>
            )}

            {!auditData && !loading && (
              <div className="text-center py-6">
                <button onClick={loadAudit} className="btn-secondary">
                  <Activity size={14} /> Load FATF Audit Data
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Withdrawals log */}
      {aspWithdrawals.length > 0 && (
        <div className="glass p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={14} style={{ color: "#34d399" }} />
            <h3 className="text-sm font-semibold text-white">Membership Proofs</h3>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399" }}>
              {aspWithdrawals.length} proven
            </span>
          </div>
          <div className="space-y-2">
            {aspWithdrawals.map(w => (
              <div key={w.id} className="table-row text-xs">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(16,185,129,0.1)" }}>
                  <Shield size={13} style={{ color: "#34d399" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white">{w.id}</div>
                  <div style={{ color: "var(--color-text-dim)" }}>
                    Deposit: {w.depositId} · {w.asset} · {w.amountBand} → {w.recipientVasp}
                  </div>
                  <div className="font-mono mt-0.5" style={{ color: "#475569" }}>
                    proof: {w.membershipProof.slice(0, 20)}…
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
                  ✓ Proven
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technical note */}
      <div className="glass p-5">
        <div className="flex items-start gap-3">
          <Globe size={14} style={{ color: "#60a5fa", flexShrink: 0, marginTop: 2 }} />
          <div className="text-xs space-y-1.5" style={{ color: "#64748b" }}>
            <p className="font-semibold" style={{ color: "#94a3b8" }}>Production ASP Architecture</p>
            <p>
              Production ASPs use a Merkle tree of commitments stored on Soroban.
              Withdrawal proofs are generated by the <code className="mono px-1 rounded" style={{ background: "rgba(59,130,246,0.1)", color: "#7dd3fc" }}>private_settlement.nr</code> circuit,
              which proves membership in the commitment tree without revealing the deposit index, amount, or sender.
            </p>
            <p>
              FATF Travel Rule compliance uses VASP-to-VASP encrypted channel (ISO 20022 / IVMS101 format).
              Covenant provides a ZK attestation that TR was completed without exposing PII to third parties.
            </p>
            <a href="https://www.fatf-gafi.org/en/topics/virtual-assets.html" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 hover:underline" style={{ color: "#60a5fa" }}>
              <ExternalLink size={10} /> FATF Virtual Asset Guidance
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
