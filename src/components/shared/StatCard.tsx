import { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | ReactNode;
  change?: { value: string; positive: boolean };
  icon?: ReactNode;
  variant?: "default" | "shielded" | "public" | "warning" | "success";
  loading?: boolean;
  onClick?: () => void;
}

export function StatCard({ label, value, change, icon, variant = "default", loading, onClick }: StatCardProps) {
  const accentColor = {
    default: "var(--accent-primary)",
    shielded: "var(--shielded-primary)",
    public: "var(--public-primary)",
    warning: "var(--accent-warning)",
    success: "var(--accent-success)",
  }[variant];

  const accentSubtle = {
    default: "var(--accent-primary-subtle)",
    shielded: "var(--shielded-subtle)",
    public: "var(--public-subtle)",
    warning: "var(--accent-warning-subtle)",
    success: "var(--accent-success-subtle)",
  }[variant];

  return (
    <div
      className="p-5 rounded-xl transition-all duration-150 cursor-default"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-sm)",
      }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--text-tertiary)" }}>
            {label}
          </p>
          {loading ? (
            <div className="h-7 w-24 rounded skeleton" />
          ) : (
            <p className="text-2xl font-bold truncate" style={{ color: "var(--text-primary)" }}>
              {value}
            </p>
          )}
          {change && !loading && (
            <div className="flex items-center gap-1 mt-1.5">
              {change.positive ? (
                <TrendingUp size={12} style={{ color: "var(--accent-success)" }} />
              ) : (
                <TrendingDown size={12} style={{ color: "var(--accent-danger)" }} />
              )}
              <span className="text-xs font-medium" style={{ color: change.positive ? "var(--accent-success)" : "var(--accent-danger)" }}>
                {change.value}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: accentSubtle, color: accentColor }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
