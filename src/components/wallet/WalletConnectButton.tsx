import { useState } from "react";
import { Globe, Shield, Loader2, ChevronDown, LogOut, ExternalLink, Copy, Check } from "lucide-react";
import { useWalletStore, SUPPORTED_WALLET_COUNT } from "../../lib/walletStore";
import { shortKey, explorerAccount, COVENANT_PUBLIC } from "../../lib/stellar";
import { toast } from "sonner";

export function WalletConnectButton() {
  const { address, connecting, error, connect, disconnect } = useWalletStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const effectiveAddress = address ?? COVENANT_PUBLIC;
  const isDemo = !address;

  const handleConnect = async () => {
    await connect();
    if (useWalletStore.getState().error) {
      toast.error(useWalletStore.getState().error!);
    } else if (useWalletStore.getState().address) {
      toast.success("Wallet connected");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(effectiveAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative">
      <button
        onClick={() => (address ? setMenuOpen((v) => !v) : handleConnect())}
        disabled={connecting}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px]"
        style={{
          background: address ? "var(--bg-elevated)" : "var(--accent-primary)",
          color: address ? "var(--text-primary)" : "#fff",
          border: `1px solid ${address ? "var(--border-default)" : "transparent"}`,
        }}
        title={isDemo ? `Demo signer (${SUPPORTED_WALLET_COUNT}+ wallets supported — connect a real one)` : undefined}
      >
        {connecting ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Connecting…
          </>
        ) : address ? (
          <>
            <Shield size={14} style={{ color: "var(--accent-success)" }} />
            <span className="hidden sm:inline">{shortKey(address)}</span>
            <ChevronDown size={13} />
          </>
        ) : (
          <>
            <Globe size={14} />
            <span>Connect Wallet</span>
          </>
        )}
      </button>

      {menuOpen && address && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 w-64 rounded-xl overflow-hidden z-50 animate-in"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-lg)" }}
          >
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Connected address</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>{shortKey(address)}</span>
                <button onClick={handleCopy} style={{ color: "var(--text-tertiary)" }}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
            <a
              href={explorerAccount(address)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 text-sm w-full"
              style={{ color: "var(--text-secondary)" }}
            >
              <ExternalLink size={14} /> View on Stellar Expert
            </a>
            <button
              onClick={() => {
                disconnect();
                setMenuOpen(false);
                toast("Wallet disconnected");
              }}
              className="flex items-center gap-2 px-4 py-2.5 text-sm w-full text-left"
              style={{ color: "var(--accent-danger)" }}
            >
              <LogOut size={14} /> Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function NetworkBadge() {
  return (
    <div
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{ background: "var(--accent-success-subtle)", color: "var(--accent-success)" }}
    >
      <span className="status-dot online" />
      Stellar Testnet
    </div>
  );
}
