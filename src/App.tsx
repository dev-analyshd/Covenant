import { useState, useEffect, useCallback } from "react";
import {
  Shield, Activity, FileCheck, Zap, Eye, Globe, RefreshCw,
  ExternalLink, AlertCircle, Cpu, Users
} from "lucide-react";
import { useCovenantStore } from "./lib/store";
import { COVENANT_PUBLIC, shortKey, explorerAccount } from "./lib/stellar";
import Dashboard from "./components/Dashboard";
import CredentialPanel from "./components/CredentialPanel";
import SettlementPanel from "./components/SettlementPanel";
import RegulatorPanel from "./components/RegulatorPanel";
import ZKExplorer from "./components/ZKExplorer";
import ASPPanel from "./components/ASPPanel";

type Tab = "dashboard" | "credential" | "settlement" | "regulator" | "asp" | "zkexplorer";

const TAB_DEFS: { id: Tab; label: string; desc: string; isNew?: boolean }[] = [
  { id: "dashboard",   label: "Dashboard",   desc: "Live testnet overview" },
  { id: "credential",  label: "Credential",  desc: "ZK compliance proof" },
  { id: "settlement",  label: "Settlement",  desc: "Private transfer" },
  { id: "regulator",   label: "Regulator",   desc: "Audit portal" },
  { id: "asp",         label: "ASP",         desc: "Privacy set & FATF Travel Rule", isNew: true },
  { id: "zkexplorer",  label: "ZK Explorer", desc: "Technical deep dive" },
];

function tabIcon(id: Tab) {
  if (id === "dashboard")   return <Activity size={15} />;
  if (id === "credential")  return <FileCheck size={15} />;
  if (id === "settlement")  return <Zap size={15} />;
  if (id === "regulator")   return <Eye size={15} />;
  if (id === "asp")         return <Users size={15} />;
  return <Cpu size={15} />;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const {
    walletConnected, setWalletConnected, refresh, loading,
    lastRefresh, error, totalProofsGenerated
  } = useCovenantStore();

  const [timeSince, setTimeSince] = useState<string>("");

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (lastRefresh) {
        const secs = Math.round((Date.now() - lastRefresh.getTime()) / 1000);
        setTimeSince(`${secs}s ago`);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lastRefresh]);

  const handleConnect = useCallback(() => {
    setWalletConnected(!walletConnected);
  }, [walletConnected, setWalletConnected]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      <header
        className="sticky top-0 z-50 flex-shrink-0"
        style={{
          borderBottom: "1px solid var(--color-border)",
          background: "rgba(6,9,16,0.92)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)" }}
            >
              <Shield className="text-white" size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white tracking-tight">Covenant</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1"
                  style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}
                >
                  v1.0 · Testnet
                </span>
                {totalProofsGenerated > 0 && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1"
                    style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}
                  >
                    <Cpu size={10} /> {totalProofsGenerated} proof{totalProofsGenerated !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-xs hidden sm:block" style={{ color: "var(--color-text-dim)" }}>
                ZK Compliance Credentials on Stellar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.18)" }}
            >
              <span className="status-dot online" />
              <span className="text-xs font-medium" style={{ color: "#34d399" }}>Stellar Testnet</span>
            </div>

            {lastRefresh && (
              <button
                onClick={refresh}
                disabled={loading}
                className="btn-ghost text-xs hidden sm:flex items-center gap-1"
                title="Refresh testnet data"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                <span className="hidden lg:inline">
                  {loading ? "Syncing…" : timeSince}
                </span>
              </button>
            )}

            <button
              onClick={handleConnect}
              className={walletConnected ? "btn-secondary text-xs" : "btn-primary text-xs"}
              style={{ padding: "0.5rem 1rem" }}
            >
              {walletConnected ? (
                <span className="flex items-center gap-1.5">
                  <Shield size={13} />
                  <span className="hidden xs:inline">{shortKey(COVENANT_PUBLIC)}</span>
                  <span className="xs:hidden">Connected</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Globe size={13} />
                  Connect Wallet
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div
          className="flex items-center gap-3 px-4 sm:px-6 py-2.5 text-sm"
          style={{ background: "rgba(239,68,68,0.06)", borderBottom: "1px solid rgba(239,68,68,0.18)" }}
        >
          <AlertCircle size={14} style={{ color: "#f87171", flexShrink: 0 }} />
          <span style={{ color: "#fca5a5" }}>Stellar Horizon: {error}</span>
        </div>
      )}

      <nav style={{ borderBottom: "1px solid var(--color-border)", background: "rgba(13,17,23,0.7)" }}>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center overflow-x-auto scrollbar-thin">
          {TAB_DEFS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 sm:px-5 py-3 text-sm font-medium border-b-2 flex-shrink-0 transition-all"
              style={{
                borderBottomColor: tab === t.id ? "var(--color-primary)" : "transparent",
                color: tab === t.id ? "var(--color-primary)" : "var(--color-text-dim)",
                background: tab === t.id ? "rgba(59,130,246,0.04)" : "transparent",
              }}
            >
              {tabIcon(t.id)}
              <span>{t.label}</span>
              {t.isNew && (
                <span
                  className="text-xs px-1 py-0.5 rounded"
                  style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24", fontSize: "0.6rem" }}
                >
                  NEW
                </span>
              )}
              {t.id === "zkexplorer" && !t.isNew && (
                <span
                  className="text-xs px-1 py-0.5 rounded"
                  style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", fontSize: "0.6rem" }}
                >
                  ZK
                </span>
              )}
            </button>
          ))}
          <div className="ml-auto hidden lg:flex items-center gap-2 pr-2">
            <a
              href={explorerAccount(COVENANT_PUBLIC)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-xs"
            >
              <ExternalLink size={12} />
              Stellar Expert
            </a>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {tab === "dashboard"  && <Dashboard />}
        {tab === "credential" && <CredentialPanel />}
        {tab === "settlement" && <SettlementPanel />}
        {tab === "regulator"  && <RegulatorPanel />}
        {tab === "asp"        && <ASPPanel />}
        {tab === "zkexplorer" && <ZKExplorer />}
      </main>

      <footer
        className="flex-shrink-0 py-5"
        style={{ borderTop: "1px solid var(--color-border-subtle)", background: "rgba(6,9,16,0.7)" }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Shield size={14} style={{ color: "var(--color-text-dim)" }} />
              <span className="text-xs" style={{ color: "var(--color-text-dim)" }}>
                Covenant — Stellar Hacks: Real-World ZK · June 2026 · MIT License
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs" style={{ color: "var(--color-text-faint)" }}>
              <span>Noir 1.0-beta.9</span>
              <span>·</span>
              <span>Barretenberg 0.87.0</span>
              <span>·</span>
              <span>Soroban Protocol 26</span>
              <span>·</span>
              <a
                href="https://github.com/yugocabrio/rs-soroban-ultrahonk"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: "var(--color-text-dim)" }}
              >
                rs-soroban-ultrahonk
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
