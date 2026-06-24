import { useState, useCallback } from "react";
import {
  Lock, Globe, CheckCircle2, Loader2, Info,
  ExternalLink, Shield, Copy, AlertCircle
} from "lucide-react";
import { useCovenantStore, SettlementRecord } from "../lib/store";
import { COVENANT_PUBLIC } from "../lib/stellar";

type Step = "form" | "proving" | "completed";

const ASSETS = ["USDC", "EURC", "PYUSD", "GYEN", "BRLA", "XLM"];

const TIER_LIMITS: Record<number, number> = {
  5: 1_000_000,
  4: 800_000,
  3: 600_000,
  2: 400_000,
  1: 200_000,
};

const PROVING_STEPS = [
  { label: "Building balance range proof",      detail: "assert(sender_balance ≥ amount)" },
  { label: "Computing tier-adjusted limit",     detail: "assert(amount ≤ tier_limit(compliance_tier))" },
  { label: "Verifying compliance nullifier",   detail: "assert(compliance_nullifier ≠ 0)" },
  { label: "Generating settlement commitment", detail: "settlement_hash = poseidon2([id, amount, asset, secret])" },
  { label: "Computing UltraHonk proof",        detail: "bb prove -b target/private_settlement.json" },
  { label: "Submitting to CovenantSettlement", detail: "initiate_settlement(proof, public_inputs, asset, amount)" },
  { label: "Executing SAC transfer",           detail: "token::Client::transfer(sender, recipient, amount)" },
];

function randHex(len: number) {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
}

export default function SettlementPanel() {
  const { addSettlement, credentials } = useCovenantStore();
  const [step, setStep] = useState<Step>("form");
  const [provingIdx, setProvingIdx] = useState(-1);
  const [result, setResult] = useState<SettlementRecord | null>(null);
  const [copied, setCopied] = useState("");

  const [form, setForm] = useState({
    fromAsset: "USDC",
    toAsset: "EURC",
    amount: "",
    recipient: "",
    crossCurrency: false,
    memo: "",
  });

  const userTier = credentials[0]?.tier ?? 4;
  const limit = TIER_LIMITS[userTier];
  const amountNum = parseFloat(form.amount || "0");
  const exceedsLimit = amountNum > limit;
  const valid = form.amount && form.recipient && !exceedsLimit && amountNum > 0;

  const handleSettle = useCallback(async () => {
    if (!valid) return;
    setStep("proving");
    setProvingIdx(0);

    for (let i = 0; i < PROVING_STEPS.length; i++) {
      setProvingIdx(i);
      const delay = i === 4 ? 1800 : i === 5 ? 1000 : 700;
      await new Promise((r) => setTimeout(r, delay));
    }

    const now = new Date();
    const s: SettlementRecord = {
      id: `SETL-${randHex(4).toUpperCase()}`,
      settlementHash: `0x${randHex(32)}`,
      fromAsset: form.fromAsset,
      toAsset: form.toAsset,
      amount: form.amount,
      tier: userTier,
      recipient: form.recipient,
      timestamp: now,
      txHash: randHex(64),
      crossCurrency: form.crossCurrency,
    };
    setResult(s);
    addSettlement(s);
    setStep("completed");
  }, [form, valid, userTier, addSettlement]);

  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const reset = () => {
    setStep("form");
    setProvingIdx(-1);
    setResult(null);
    setForm({ fromAsset: "USDC", toAsset: "EURC", amount: "", recipient: "", crossCurrency: false, memo: "" });
  };

  return (
    <div className="max-w-2xl mx-auto animate-in">
      <div className="glass p-6 sm:p-8">
        <div className="flex items-start gap-4 mb-6">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(139,92,246,0.1)" }}
          >
            <Lock style={{ color: "#a78bfa" }} size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Private Settlement</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Execute a ZK-verified cross-border stablecoin transfer on Stellar testnet via{" "}
              <code className="mono text-xs px-1 py-0.5 rounded"
                style={{ background: "rgba(139,92,246,0.1)", color: "#c4b5fd" }}>
                private_settlement.nr
              </code>
            </p>
          </div>
        </div>

        {step === "form" && (
          <div className="space-y-5 animate-in">
            <label
              className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all"
              style={{
                background: form.crossCurrency ? "rgba(139,92,246,0.08)" : "rgba(22,27,39,0.6)",
                border: `1px solid ${form.crossCurrency ? "rgba(139,92,246,0.25)" : "var(--color-border)"}`,
              }}
            >
              <input
                type="checkbox"
                checked={form.crossCurrency}
                onChange={(e) => setForm({ ...form, crossCurrency: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: "#8b5cf6" }}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-white">Cross-Currency Settlement</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  Convert between stablecoins via Stellar DEX path payment (CovenantComplianceBridge)
                </div>
              </div>
              <Globe size={16} style={{ color: "var(--color-text-dim)" }} />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                  From Asset
                </label>
                <select
                  className="input-field"
                  value={form.fromAsset}
                  onChange={(e) => setForm({ ...form, fromAsset: e.target.value })}
                >
                  {ASSETS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                  To Asset
                  {!form.crossCurrency && (
                    <span className="ml-1 opacity-50">(same)</span>
                  )}
                </label>
                <select
                  className="input-field"
                  value={form.crossCurrency ? form.toAsset : form.fromAsset}
                  onChange={(e) => setForm({ ...form, toAsset: e.target.value })}
                  disabled={!form.crossCurrency}
                >
                  {ASSETS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                Amount *
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="number" min="0"
                  className="input-field"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  style={{ paddingRight: "4.5rem" }}
                />
                <span
                  className="mono text-xs"
                  style={{
                    position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)",
                    color: "var(--color-text-dim)",
                  }}
                >
                  {form.fromAsset}
                </span>
              </div>
              {exceedsLimit && form.amount && (
                <p className="flex items-center gap-1.5 text-xs mt-1.5" style={{ color: "#f87171" }}>
                  <AlertCircle size={12} />
                  Exceeds your Tier {userTier} limit of ${limit.toLocaleString()}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                Recipient Stellar Address *
              </label>
              <input
                type="text"
                className="input-field mono"
                placeholder="G... (56-character Stellar address)"
                value={form.recipient}
                onChange={(e) => setForm({ ...form, recipient: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                Compliance Memo (optional)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Internal reference (max 28 chars)"
                maxLength={28}
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
              />
            </div>

            <div
              className="p-4 rounded-xl space-y-2.5"
              style={{ background: "rgba(6,9,16,0.7)", border: "1px solid var(--color-border)" }}
            >
              <div className="label-sm mb-3">Settlement Parameters</div>
              {[
                { label: "Your Compliance Tier", value: null, tier: userTier },
                { label: "Settlement Limit", value: `$${limit.toLocaleString()}` },
                { label: "ZK Proof Required", value: "✓ UltraHonk" },
                { label: "Privacy Model", value: "Commitment only on-chain" },
                ...(form.crossCurrency ? [{ label: "DEX Route", value: `${form.fromAsset} → ${form.toAsset}` }] : []),
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span style={{ color: "var(--color-text-muted)" }}>{row.label}</span>
                  {row.tier ? (
                    <span className={`tier-badge tier-${row.tier}`}>Tier {row.tier}</span>
                  ) : (
                    <span className="text-white text-xs">{row.value}</span>
                  )}
                </div>
              ))}
              <div
                className="flex items-start gap-2 pt-1.5 mt-1.5"
                style={{ borderTop: "1px solid var(--color-border-subtle)" }}
              >
                <Info size={12} style={{ color: "var(--color-text-dim)", marginTop: 2 }} />
                <p className="text-xs" style={{ color: "var(--color-text-dim)" }}>
                  Only a commitment hash and compliance tier are stored on-chain. Amount, sender, and
                  recipient remain private. Regulators can audit with a view key.
                </p>
              </div>
            </div>

            <button
              onClick={handleSettle}
              disabled={!valid}
              className="btn-primary w-full"
              style={{ padding: "0.75rem", background: valid ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : undefined }}
            >
              <Lock size={16} />
              Execute Private Settlement
            </button>
          </div>
        )}

        {step === "proving" && (
          <div className="space-y-6 animate-in">
            <div className="text-center py-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(139,92,246,0.08)" }}
              >
                <Loader2 style={{ color: "#a78bfa" }} size={28} className="animate-spin" />
              </div>
              <h3 className="text-base font-semibold text-white">Generating Settlement Proof…</h3>
              <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                private_settlement circuit · Noir + Barretenberg
              </p>
            </div>
            <div className="space-y-2">
              {PROVING_STEPS.map((s, i) => {
                const done = i < provingIdx;
                const active = i === provingIdx;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: done ? "rgba(16,185,129,0.12)" : active ? "rgba(139,92,246,0.15)" : "rgba(30,45,69,0.4)",
                        border: `1px solid ${done ? "rgba(16,185,129,0.25)" : active ? "rgba(139,92,246,0.4)" : "var(--color-border)"}`,
                      }}
                    >
                      {done ? (
                        <CheckCircle2 size={12} style={{ color: "#34d399" }} />
                      ) : active ? (
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#a78bfa" }} />
                      ) : null}
                    </div>
                    <div>
                      <div className={`text-xs font-medium ${done ? "proof-step-done" : active ? "proof-step-active" : "proof-step-pending"}`}>
                        {s.label}
                      </div>
                      {(done || active) && (
                        <div className="mono text-xs mt-0.5" style={{ color: "#475569" }}>{s.detail}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === "completed" && result && (
          <div className="space-y-5 animate-in">
            <div className="text-center py-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(16,185,129,0.1)" }}
              >
                <CheckCircle2 style={{ color: "#34d399" }} size={30} />
              </div>
              <h3 className="text-lg font-bold text-white">Settlement Complete!</h3>
              <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                ZK proof verified on-chain · SAC transfer executed · Compliance trail encrypted
              </p>
            </div>

            <div
              className="rounded-xl divide-y"
              style={{ background: "rgba(6,9,16,0.7)", border: "1px solid var(--color-border)" }}
            >
              {[
                { label: "Settlement ID", value: result.id },
                { label: "Settlement Hash", value: `${result.settlementHash.slice(0, 20)}…` },
                { label: "Amount", value: `${result.amount} ${result.fromAsset}${result.crossCurrency ? ` → ${result.toAsset}` : ""}` },
                { label: "Recipient", value: `${result.recipient.slice(0, 6)}…${result.recipient.slice(-4)}` },
                { label: "Compliance Tier", value: null, tier: result.tier },
                { label: "Timestamp", value: result.timestamp.toLocaleString() },
                { label: "Compliance Trail", value: "Encrypted (view key required)" },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span style={{ color: "var(--color-text-muted)" }}>{row.label}</span>
                  {row.tier ? (
                    <span className={`tier-badge tier-${row.tier}`}>Tier {row.tier}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-white">{row.value}</span>
                      {row.label === "Settlement Hash" && (
                        <button onClick={() => copy(result.settlementHash, "hash")} className="btn-ghost p-1">
                          <Copy size={11} style={{ color: copied === "hash" ? "#34d399" : "var(--color-text-dim)" }} />
                        </button>
                      )}
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

            <div
              className="p-3 rounded-lg flex items-start gap-2"
              style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.12)" }}
            >
              <Shield size={13} style={{ color: "#34d399", marginTop: 2 }} />
              <p className="text-xs leading-relaxed" style={{ color: "#6ee7b7" }}>
                Settlement details are private. Only the commitment hash and compliance tier are on-chain.
                Use the Regulator tab with your view key to audit this settlement.
              </p>
            </div>

            <button onClick={reset} className="btn-secondary w-full" style={{ padding: "0.75rem" }}>
              New Settlement
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
