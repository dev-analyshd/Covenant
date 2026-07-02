import { useState, ReactNode } from "react";
import { Eye, EyeOff, Lock, Globe, ArrowDown, ArrowUp, Send } from "lucide-react";

interface BalanceCardProps {
  type: "private" | "public";
  balance: string;
  asset?: string;
  usdValue?: string;
  loading?: boolean;
  onMakePrivate?: () => void;
  onSend?: () => void;
  onReceive?: () => void;
}

export function BalanceCard({
  type,
  balance,
  asset = "XLM",
  usdValue,
  loading,
  onMakePrivate,
  onSend,
  onReceive,
}: BalanceCardProps) {
  const [masked, setMasked] = useState(type === "private");

  const isPrivate = type === "private";
  const accentColor = isPrivate ? "var(--shielded-primary)" : "var(--public-primary)";
  const accentSubtle = isPrivate ? "var(--shielded-subtle)" : "var(--public-subtle)";
  const borderColor = isPrivate ? "rgba(168,85,247,0.25)" : "rgba(6,182,212,0.25)";

  const displayBalance = masked ? "••••••" : balance;

  return (
    <div
      className="p-6 rounded-xl relative overflow-hidden"
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${borderColor}`,
        boxShadow: isPrivate ? "0 0 0 1px rgba(168,85,247,0.08) inset" : "none",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: accentSubtle, color: accentColor }}
          >
            {isPrivate ? <Lock size={16} /> : <Globe size={16} />}
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--text-tertiary)" }}>
              {isPrivate ? "Private Balance" : "Public Balance"}
            </p>
            <div
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5"
              style={{ background: accentSubtle, color: accentColor }}
            >
              {isPrivate ? <Lock size={9} /> : <Globe size={9} />}
              {isPrivate ? "Shielded" : "Visible"}
            </div>
          </div>
        </div>
        <button
          onClick={() => setMasked((v) => !v)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-tertiary)" }}
          aria-label={masked ? "Show balance" : "Hide balance"}
        >
          {masked ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
      </div>

      <div className="mb-1">
        {loading ? (
          <div className="h-9 w-32 rounded skeleton" />
        ) : (
          <p
            className="text-3xl font-bold font-mono tracking-tight"
            style={{ color: "var(--text-primary)", filter: masked ? "blur(8px)" : "none", transition: "filter 0.2s ease" }}
          >
            {displayBalance}
          </p>
        )}
        <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
          {asset} {usdValue ? `· ≈ $${usdValue}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-2 mt-5">
        {isPrivate ? (
          <button
            onClick={onMakePrivate}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-all"
            style={{ background: accentSubtle, color: accentColor }}
          >
            <ArrowDown size={13} /> Make Private
          </button>
        ) : (
          <>
            <button
              onClick={onSend}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-all"
              style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
            >
              <Send size={13} /> Send
            </button>
            <button
              onClick={onReceive}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-all"
              style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
            >
              <ArrowDown size={13} /> Receive
            </button>
          </>
        )}
      </div>
    </div>
  );
}
