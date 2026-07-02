import { Link, useLocation } from "wouter";
import { LayoutDashboard, Shield, FileBadge, Send, MoreHorizontal } from "lucide-react";

const ITEMS = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: Shield, label: "Treasury", path: "/treasury" },
  { icon: FileBadge, label: "Credentials", path: "/credentials" },
  { icon: Send, label: "Settle", path: "/settlements" },
  { icon: MoreHorizontal, label: "More", path: "/settings" },
];

export function MobileNav() {
  const [location] = useLocation();
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around"
      style={{ background: "var(--bg-surface)", borderTop: "1px solid var(--border-subtle)", height: "64px" }}
    >
      {ITEMS.map((item) => {
        const isActive = location === item.path;
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            href={item.path}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-[44px]"
            style={{ color: isActive ? "var(--accent-primary)" : "var(--text-tertiary)" }}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
