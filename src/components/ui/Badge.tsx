import { HTMLAttributes } from "react";

type Variant = "default" | "success" | "warning" | "danger" | "info" | "shielded" | "public";

const styles: Record<Variant, React.CSSProperties> = {
  default: { background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" },
  success: { background: "var(--accent-success-subtle)", color: "var(--accent-success)", border: "1px solid transparent" },
  warning: { background: "var(--accent-warning-subtle)", color: "var(--accent-warning)", border: "1px solid transparent" },
  danger: { background: "var(--accent-danger-subtle)", color: "var(--accent-danger)", border: "1px solid transparent" },
  info: { background: "var(--accent-info-subtle)", color: "var(--accent-info)", border: "1px solid transparent" },
  shielded: { background: "var(--shielded-subtle)", color: "var(--shielded-primary)", border: "1px solid transparent" },
  public: { background: "var(--public-subtle)", color: "var(--public-primary)", border: "1px solid transparent" },
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  icon?: React.ReactNode;
}

export function Badge({ variant = "default", icon, children, className = "", style, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}
      style={{ ...styles[variant], ...style }}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
