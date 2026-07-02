import { useState } from "react";
import { useCovenantStore } from "../lib/store";
import { useSettlementStore, TIER_SETTLEMENT_LIMITS } from "../lib/settlementStore";
import {
  Send, CheckCircle2, ExternalLink, AlertCircle,
  Loader2, ArrowLeftRight, Clock, Shield
} from "lucide-react";
import { explorerTx, shortKey } from "../lib/stellar";
import { CONTRACTS } from "../lib/contracts";
import type { SettlementRecord } from "../lib/store";

const ASSETS = ["XLM", "USDC", "EURC", "PYUSD"];

function StatusBadge({ onChain }: { onChain?: boolean }) {
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: onChain ? "var(--accent-success-subtle)" : "var(--accent-warning-subtle)",
        color: onChain ? "var(--accent-success)" : "var(--accent-warning)",
      }}
    >
      {onChain ? "On-chain" : "Pending"}
    </span>
  );
}

function SettlementRow({ s }: { s: SettlementRecord }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-3.5 transition-colors"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--accent-primary-subtle)", color: "var(--accent-primary)" }}
      >
        <Send size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          → {s.recipient}
        </p>
        <p className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
          {s.txHash ? shortKey(s.txHash) : "—"}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold font-mono" style={{ color: "var(--text-primary)" }}>
          {s.amount} {s.fromAsset}
        </p>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {new Date(s.timestamp).toLocaleDateString()}
        </p>
      </div>
      <div className="flex-shrink-0 flex items-center gap-2">
        <StatusBadge onChain={s.onChain} />
        {s.txHash && (
          <a href={explorerTx(s.txHash)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-primary)" }}>
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}

export default function Settlements() {
  const { credentials, settlements } = useCovenantStore();
  const {
    recipient, amount, asset, memo, crossCurrency, toAsset,
    isSubmitting, error, lastTxHash,
    setField, submit, reset,
  } = useSettlementStore();

  const activeTier = credentials[0]?.tier ?? 0;
  const limit = TIER_SETTLEMENT_LIMITS[activeTier] ?? 0;
  const amountNum = parseFloat(amount) || 0;
  const exceedsLimit = amountNum > limit && limit !== Infinity;

  const handleSubmit = async () => {
    await submit(activeTier);
  };

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Settlements</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Execute private cross-border settlements with ZK compliance proofs
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Settlement form */}
        <div
          className="lg:col-span-2 rounded-xl overflow-hidden"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Settlement</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              {activeTier > 0 ? `Tier ${activeTier} · Up to ${limit === Infinity ? "Unlimited" : `$${limit.toLocaleString()}`}` : "No active credential"}
            </p>
          </div>

          <div className="p-5 space-y-4">
            {activeTier === 0 && (
              <div
                className="flex items-start gap-2 p-3 rounded-lg text-xs"
                style={{ background: "var(--accent-warning-subtle)", color: "var(--accent-warning)" }}
              >
                <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                Issue a compliance credential first to enable settlements.
              </div>
            )}

            {lastTxHash ? (
              <div className="space-y-3">
                <div className="p-4 rounded-lg flex items-center gap-3" style={{ background: "var(--accent-success-subtle)" }}>
                  <CheckCircle2 size={18} style={{ color: "var(--accent-success)" }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--accent-success)" }}>Settlement submitted</p>
                    <a href={explorerTx(lastTxHash)} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-mono flex items-center gap-1" style={{ color: "var(--accent-primary)" }}>
                      {shortKey(lastTxHash)} <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
                <button
                  onClick={reset}
                  className="w-full py-2.5 rounded-lg text-sm font-medium"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
                >
                  New Settlement
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setField("recipient", e.target.value)}
                    placeholder="G… (Stellar public key)"
                    className="input-field font-mono text-xs"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                    Amount
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setField("amount", e.target.value)}
                      placeholder="0.00"
                      className="input-field flex-1"
                      disabled={isSubmitting}
                    />
                    <select
                      value={asset}
                      onChange={(e) => setField("asset", e.target.value as any)}
                      className="input-field w-24"
                      disabled={isSubmitting}
                    >
                      {ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  {exceedsLimit && (
                    <p className="text-xs mt-1" style={{ color: "var(--accent-danger)" }}>
                      Exceeds Tier {activeTier} limit of ${limit.toLocaleString()}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                    Memo (optional)
                  </label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setField("memo", e.target.value)}
                    placeholder="Invoice #, reference…"
                    maxLength={28}
                    className="input-field"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Cross-currency</p>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Route via bridge (USDC→EURC)</p>
                  </div>
                  <button
                    onClick={() => setField("crossCurrency", !crossCurrency)}
                    className="relative w-10 h-5 rounded-full transition-all"
                    style={{ background: crossCurrency ? "var(--accent-primary)" : "var(--border-default)" }}
                  >
                    <div
                      className="absolute w-4 h-4 rounded-full bg-white top-0.5 transition-all"
                      style={{ left: crossCurrency ? "calc(100% - 18px)" : "2px", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
                    />
                  </button>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg text-xs" style={{ background: "var(--accent-danger-subtle)", color: "var(--accent-danger)" }}>
                    <AlertCircle size={13} />
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || activeTier === 0 || !recipient || !amount || exceedsLimit}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: "var(--accent-primary)",
                    color: "#fff",
                    opacity: isSubmitting || activeTier === 0 || !recipient || !amount || exceedsLimit ? 0.5 : 1,
                  }}
                >
                  {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {isSubmitting ? "Submitting…" : "Submit Settlement"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Settlement history */}
        <div
          className="lg:col-span-3 rounded-xl overflow-hidden"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>History</h2>
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{settlements.length} settlements</span>
          </div>

          {settlements.length === 0 ? (
            <div className="p-10 text-center">
              <Send size={28} className="mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No settlements yet</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                Your settlement history will appear here
              </p>
            </div>
          ) : (
            <div>
              {settlements.map((s) => <SettlementRow key={s.id} s={s} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
