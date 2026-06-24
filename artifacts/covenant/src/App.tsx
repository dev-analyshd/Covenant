import { useState } from "react";
import { Shield, Lock, Eye, Zap, Globe, Activity, FileCheck } from "lucide-react";
import Dashboard from "./components/Dashboard";
import CredentialPanel from "./components/CredentialPanel";
import SettlementPanel from "./components/SettlementPanel";
import RegulatorPanel from "./components/RegulatorPanel";

type Tab = "dashboard" | "credential" | "settlement" | "regulator";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [walletConnected, setWalletConnected] = useState(false);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <Activity size={16} /> },
    { id: "credential", label: "Credential", icon: <FileCheck size={16} /> },
    { id: "settlement", label: "Settlement", icon: <Zap size={16} /> },
    { id: "regulator", label: "Regulator", icon: <Eye size={16} /> },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <header className="sticky top-0 z-50" style={{ borderBottom: "1px solid var(--color-border)", background: "rgba(10,14,26,0.9)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
              <Shield className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Covenant</h1>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>ZK Compliance Credentials on Stellar</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#10b981" }} />
              <span className="text-xs font-medium" style={{ color: "#10b981" }}>Stellar Testnet</span>
            </div>
            <button
              onClick={() => setWalletConnected(!walletConnected)}
              className="btn-primary"
            >
              {walletConnected ? (
                <span className="flex items-center gap-2">
                  <Lock size={15} />
                  G...7x9A
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Globe size={15} />
                  Connect Wallet
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <nav style={{ borderBottom: "1px solid var(--color-border)", background: "rgba(17,24,39,0.4)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2"
                style={{
                  borderBottomColor: activeTab === tab.id ? "var(--color-primary)" : "transparent",
                  color: activeTab === tab.id ? "var(--color-primary)" : "var(--color-text-muted)",
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "credential" && <CredentialPanel />}
        {activeTab === "settlement" && <SettlementPanel />}
        {activeTab === "regulator" && <RegulatorPanel />}
      </main>

      <footer className="mt-16 py-8" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-sm" style={{ color: "var(--color-text-dim)" }}>
          <div className="flex items-center gap-2">
            <Shield size={15} />
            <span>Covenant — Stellar Hacks: Real-World ZK 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <span>Built with Noir + Soroban</span>
            <span style={{ color: "#1e293b" }}>|</span>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
