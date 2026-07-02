import { HTMLAttributes } from "react";

type Variant = "default" | "elevated" | "bordered" | "ghost";
type Padding = "none" | "sm" | "md" | "lg" | "xl";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: Padding;
}

const paddingMap: Record<Padding, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
  xl: "p-8",
};

export function Card({ variant = "default", padding = "md", className = "", style, children, ...props }: CardProps) {
  const variantStyle: React.CSSProperties =
    variant === "elevated"
      ? { background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }
      : variant === "bordered"
      ? { background: "var(--bg-surface)", border: "1px solid var(--border-default)" }
      : variant === "ghost"
      ? { background: "transparent", border: "1px solid transparent" }
      : { background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" };

  return (
    <div
      className={`rounded-xl transition-colors ${paddingMap[padding]} ${className}`}
      style={{ ...variantStyle, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
