type Size = "sm" | "md" | "lg";
type Variant = "default" | "success" | "warning" | "danger";

const heightMap: Record<Size, string> = { sm: "h-1", md: "h-2", lg: "h-3" };
const colorMap: Record<Variant, string> = {
  default: "var(--accent-primary)",
  success: "var(--accent-success)",
  warning: "var(--accent-warning)",
  danger: "var(--accent-danger)",
};

export function Progress({ value, size = "md", variant = "default", className = "" }: { value: number; size?: Size; variant?: Variant; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={`w-full rounded-full overflow-hidden ${heightMap[size]} ${className}`} style={{ background: "var(--bg-elevated)" }}>
      <div
        className="h-full rounded-full transition-all duration-500 ease-in-out"
        style={{ width: `${clamped}%`, background: colorMap[variant] }}
      />
    </div>
  );
}

export function Skeleton({ variant = "rectangular", className = "" }: { variant?: "text" | "circular" | "rectangular" | "rounded"; className?: string }) {
  const shape = variant === "circular" ? "rounded-full" : variant === "rounded" ? "rounded-lg" : variant === "text" ? "rounded" : "rounded-md";
  return <div className={`skeleton ${shape} ${className}`} style={{ background: "var(--bg-elevated)" }} />;
}
