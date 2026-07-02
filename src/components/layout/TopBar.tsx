import { Menu, Sun, Moon, Monitor, Shield, RefreshCw, ExternalLink } from "lucide-react";
import { useAppStore } from "../../lib/appStore";
import { useCovenantStore } from "../../lib/store";
import { WalletConnectButton, NetworkBadge } from "../wallet/WalletConnectButton";
import { explorerAccount, COVENANT_PUBLIC } from "../../lib/stellar";
import { useWalletStore } from "../../lib/walletStore";

export function ThemeSwitcher() {
  const { theme, setTheme } = useAppStore();
  return (
    <div className="hidden sm:flex items-center gap-0.5 rounded-lg p-1" style={{ background: "var(--bg-elevated)" }}>
      {([
        { id: "light", icon: Sun },
        { id: "dark", icon: Moon },
        { id: "system", icon: Monitor },
      ] as const).map(({ id, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setTheme(id)}
          className="p-1.5 rounded-md transition-all"
          style={{
            background: theme === id ? "var(--bg-surface)" : "transparent",
            color: theme === id ? "var(--text-primary)" : "var(--text-tertiary)",
            boxShadow: theme === id ? "var(--shadow-sm)" : "none",
          }}
          aria-label={`${id} theme`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { refresh, loading, lastRefresh } = useCovenantStore();
  const { address } = useWalletStore();

  return (
    <header
      className="h-16 flex items-center justify-between px-4 sm:px-6 fixed top-0 left-0 right-0 z-40"
      style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuClick} className="lg:hidden p-1.5 -ml-1" style={{ color: "var(--text-secondary)" }} aria-label="Menu">
          <Menu size={20} />
        </button>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--accent-primary)" }}
        >
          <Shield className="text-white" size={18} />
        </div>
        <div className="min-w-0 hidden xs:block">
          <span className="text-base font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Covenant</span>
          <p className="text-[11px] hidden md:block" style={{ color: "var(--text-tertiary)" }}>ZK Compliance on Stellar</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <NetworkBadge />
        {lastRefresh && (
          <button
            onClick={refresh}
            disabled={loading}
            className="hidden md:flex p-2 rounded-lg"
            style={{ color: "var(--text-tertiary)" }}
            title="Refresh testnet data"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        )}
        <a
          href={explorerAccount(address ?? COVENANT_PUBLIC)}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg"
          style={{ color: "var(--text-tertiary)" }}
        >
          <ExternalLink size={12} /> Explorer
        </a>
        <ThemeSwitcher />
        <WalletConnectButton />
      </div>
    </header>
  );
}
