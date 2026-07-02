import { useEffect } from "react";
import { useCovenantStore } from "../lib/store";
import { useWalletStore } from "../lib/walletStore";
import { StatCard } from "../components/shared/StatCard";
import {
  Lock, Globe, FileBadge, Clock, Activity, CheckCircle2,
  ExternalLink, Shield, Zap, TrendingUp
} from "lucide-react";
import { CONTRACTS } from "../lib/contracts";
import { explorerTx, explorerContract, shortKey } from "../lib/stellar";

function formatBalance(balances: any[]): string {
  const xlm = balances?.find((b: any) => b.asset_type === "native");
  if (!xlm) return "—";
  return parseFloat(xlm.balance).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatTime(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(date).toLocaleDateString();
}

export default function Dashboard() {
  const {
    account, transactions, networkStats, credentials, settlements,
    loading, error, refresh, lastRefresh
  } = useCovenantStore();
  const { address } = useWalletStore();

  useEffect(() => {
    refresh();
  }, []);

  const xlmBalance = account ? formatBalance(account.balances) : "—";
  const privateBalance = credentials.length > 0
    ? (credentials.length * 500).toLocaleString()
    : "0";
  const lastLedger = networkStats?.ledger?.sequence ?? "—";
  const feeMode = networkStats?.fee_stats?.fee_charged?.mode
    ? (parseInt(networkStats.fee_stats.fee_charged.mode) / 1e7).toFixed(5) + " XLM"
    : "—";

  return (
    <div className="space-y-6 animate-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Stellar Testnet · Protocol 26
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Updated {formatTime(lastRefresh)}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-all"
            style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
          >
            <Activity size={13} className={loading ? "animate-spin" : ""} />
            {loading ? "Syncing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: "var(--accent-danger-subtle)", color: "var(--accent-danger)", border: "1px solid var(--accent-danger)" }}>
          <Shield size={14} />
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Private Balance"
          value={loading ? "…" : `${privateBalance} XLM`}
          icon={<Lock size={18} />}
          variant="shielded"
          loading={loading}
        />
        <StatCard
          label="Public Balance"
          value={loading ? "…" : `${xlmBalance} XLM`}
          icon={<Globe size={18} />}
          variant="public"
          loading={loading}
        />
        <StatCard
          label="Active Credentials"
          value={credentials.length}
          change={credentials.length > 0 ? { value: "On-chain", positive: true } : undefined}
          icon={<FileBadge size={18} />}
          variant="success"
        />
        <StatCard
          label="Settlements"
          value={settlements.length}
          icon={<Zap size={18} />}
          variant="default"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div
          className="lg:col-span-2 rounded-xl overflow-hidden"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Activity</h2>
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{transactions.length} transactions</span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full skeleton flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-32 rounded skeleton" />
                    <div className="h-3 w-20 rounded skeleton" />
                  </div>
                  <div className="h-3.5 w-16 rounded skeleton" />
                </div>
              ))
            ) : transactions.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Activity size={24} className="mx-auto mb-2" style={{ color: "var(--text-tertiary)" }} />
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No transactions yet</p>
              </div>
            ) : (
              transactions.slice(0, 8).map((tx) => (
                <div key={tx.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-opacity-50 transition-colors">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: tx.successful ? "var(--accent-success-subtle)" : "var(--accent-danger-subtle)",
                      color: tx.successful ? "var(--accent-success)" : "var(--accent-danger)",
                    }}
                  >
                    {tx.successful ? <CheckCircle2 size={14} /> : <Shield size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {tx.memo || `Ledger ${tx.ledger}`}
                    </p>
                    <p className="text-xs font-mono truncate" style={{ color: "var(--text-tertiary)" }}>
                      {shortKey(tx.hash)}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {formatTime(new Date(tx.created_at))}
                    </p>
                    <a
                      href={explorerTx(tx.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px]"
                      style={{ color: "var(--accent-primary)" }}
                    >
                      <ExternalLink size={10} /> Explorer
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column: Network + Contracts */}
        <div className="space-y-4">
          {/* Network Stats */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Network Stats</h2>
            <div className="space-y-3">
              {[
                { label: "Ledger", value: lastLedger?.toLocaleString() ?? "—" },
                { label: "Avg Fee", value: feeMode },
                { label: "Capacity", value: networkStats?.fee_stats?.ledger_capacity_usage ? `${Math.round(parseFloat(networkStats.fee_stats.ledger_capacity_usage) * 100)}%` : "—" },
                { label: "Network", value: "Testnet" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
                  <span className="text-xs font-mono font-medium" style={{ color: "var(--text-primary)" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contract Status */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Contracts</h2>
            <div className="space-y-2.5">
              {(Object.entries(CONTRACTS) as [string, string][]).map(([name, id]) => (
                <div key={name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--accent-success)" }} />
                    <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                      {name.replace(/_/g, " ").replace(/covenant /i, "")}
                    </span>
                  </div>
                  <a
                    href={explorerContract(id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-mono flex-shrink-0"
                    style={{ color: "var(--accent-primary)" }}
                  >
                    {shortKey(id)} <ExternalLink size={9} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
