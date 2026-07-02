import { useState } from "react";
import { useAppStore } from "../lib/appStore";
import { useWalletStore } from "../lib/walletStore";
import { CONTRACTS } from "../lib/contracts";
import {
  Sun, Moon, Monitor, Copy, Check, ExternalLink, LogOut,
  Shield, Globe, Settings2, Code2, AlertTriangle, ChevronRight
} from "lucide-react";
import { explorerAccount, explorerContract, shortKey } from "../lib/stellar";
import { toast } from "sonner";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        {description && <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative w-10 h-5 rounded-full transition-all"
      style={{ background: value ? "var(--accent-primary)" : "var(--border-default)" }}
    >
      <div
        className="absolute w-4 h-4 rounded-full bg-white top-0.5 transition-all"
        style={{ left: value ? "calc(100% - 18px)" : "2px", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
      />
    </button>
  );
}

export default function Settings() {
  const { theme, setTheme } = useAppStore();
  const { address, disconnect } = useWalletStore();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [showZkDetails, setShowZkDetails] = useState(false);
  const [debugLogging, setDebugLogging] = useState(false);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
    toast.success("Copied to clipboard");
  };

  const handleDisconnect = () => {
    disconnect();
    toast("Wallet disconnected");
  };

  return (
    <div className="space-y-5 max-w-2xl animate-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Configure your Covenant workspace
        </p>
      </div>

      {/* Wallet */}
      <Section title="Wallet" description="Connected wallet and account settings">
        {address ? (
          <div className="space-y-0">
            <Row label="Connected Address" description="Your active Stellar account">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{shortKey(address)}</span>
                <button onClick={() => handleCopy(address, "address")} style={{ color: "var(--text-tertiary)" }}>
                  {copiedKey === "address" ? <Check size={13} /> : <Copy size={13} />}
                </button>
                <a href={explorerAccount(address)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-primary)" }}>
                  <ExternalLink size={13} />
                </a>
              </div>
            </Row>
            <Row label="Disconnect" description="Remove wallet connection">
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ background: "var(--accent-danger-subtle)", color: "var(--accent-danger)" }}
              >
                <LogOut size={12} /> Disconnect
              </button>
            </Row>
          </div>
        ) : (
          <div className="py-2 text-center">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No wallet connected</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
              Connect Freighter, Albedo, xBull, Rabet, Lobstr, and 7+ more wallets
            </p>
          </div>
        )}
      </Section>

      {/* Network */}
      <Section title="Network" description="Stellar network configuration">
        <div className="space-y-0">
          <Row label="Active Network" description="Stellar Protocol 26">
            <span
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "var(--accent-success-subtle)", color: "var(--accent-success)" }}
            >
              <span className="status-dot online" /> Testnet
            </span>
          </Row>
          <Row label="Horizon Endpoint" description="REST API for account data">
            <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>horizon-testnet.stellar.org</span>
          </Row>
          <Row label="Soroban RPC" description="Smart contract interactions">
            <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>soroban-testnet.stellar.org</span>
          </Row>
        </div>
      </Section>

      {/* Contract Addresses */}
      <Section title="Contract Addresses" description="Deployed Soroban contracts on testnet">
        <div className="space-y-3">
          {(Object.entries(CONTRACTS) as [string, string][]).map(([name, id]) => (
            <div key={name} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium capitalize" style={{ color: "var(--text-primary)" }}>
                  {name.replace(/_/g, " ")}
                </p>
                <p className="text-[10px] font-mono truncate mt-0.5" style={{ color: "var(--text-tertiary)" }}>{id}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleCopy(id, name)} style={{ color: "var(--text-tertiary)" }}>
                  {copiedKey === name ? <Check size={13} /> : <Copy size={13} />}
                </button>
                <a href={explorerContract(id)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-primary)" }}>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance" description="Theme and display preferences">
        <div>
          <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Theme</p>
          <div className="flex gap-2">
            {([
              { id: "light", label: "Light", icon: Sun },
              { id: "dark", label: "Dark", icon: Moon },
              { id: "system", label: "System", icon: Monitor },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className="flex-1 flex flex-col items-center gap-2 py-3 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: theme === id ? "var(--accent-primary-subtle)" : "var(--bg-elevated)",
                  border: `1px solid ${theme === id ? "var(--accent-primary)" : "var(--border-default)"}`,
                  color: theme === id ? "var(--accent-primary)" : "var(--text-secondary)",
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Advanced */}
      <Section title="Advanced" description="Developer and debug options">
        <div className="space-y-0">
          <Row label="Show ZK Details" description="Display proof system information in UI">
            <Toggle value={showZkDetails} onChange={setShowZkDetails} />
          </Row>
          <Row label="Developer Mode" description="Enable API inspector and raw transaction viewer">
            <Toggle value={devMode} onChange={setDevMode} />
          </Row>
          <Row label="Debug Logging" description="Log all contract calls to console">
            <Toggle value={debugLogging} onChange={setDebugLogging} />
          </Row>
        </div>
      </Section>

      {/* Version info */}
      <div className="pb-4 flex items-center justify-between text-xs" style={{ color: "var(--text-tertiary)" }}>
        <span>Covenant v0.1.0 · Stellar Hacks: Real-World ZK</span>
        <a
          href="https://github.com/dev-analyshd/Covenant"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:underline"
          style={{ color: "var(--accent-primary)" }}
        >
          <Code2 size={11} /> GitHub
        </a>
      </div>
    </div>
  );
}
