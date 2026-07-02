import { ReactNode, useState } from "react";

interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

export function Tabs({
  items, active, onChange, variant = "underline",
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  variant?: "default" | "pills" | "underline";
}) {
  return (
    <div
      className={`flex items-center gap-1 ${variant === "pills" ? "p-1 rounded-lg" : "border-b"}`}
      style={variant === "pills" ? { background: "var(--bg-elevated)" } : { borderColor: "var(--border-subtle)" }}
      role="tablist"
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={`flex items-center gap-1.5 text-sm font-medium transition-all ${
              variant === "pills" ? "px-3 py-1.5 rounded-md" : "px-4 py-2.5 border-b-2"
            }`}
            style={
              variant === "pills"
                ? { background: isActive ? "var(--bg-surface)" : "transparent", color: isActive ? "var(--text-primary)" : "var(--text-secondary)", boxShadow: isActive ? "var(--shadow-sm)" : "none" }
                : { borderBottomColor: isActive ? "var(--accent-primary)" : "transparent", color: isActive ? "var(--accent-primary)" : "var(--text-secondary)" }
            }
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function useTabs(defaultId: string) {
  const [active, setActive] = useState(defaultId);
  return { active, setActive };
}
