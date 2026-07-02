import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Shield, FileBadge, Send, ArrowLeftRight,
  ScrollText, Settings, HelpCircle, ChevronLeft, ChevronRight, Cpu, Eye,
} from "lucide-react";
import { useAppStore } from "../../lib/appStore";
import { useCovenantStore } from "../../lib/store";

const NAV_SECTIONS = [
  {
    label: "OVERVIEW",
    items: [{ icon: LayoutDashboard, label: "Dashboard", path: "/" }],
  },
  {
    label: "OPERATE",
    items: [
      { icon: Shield, label: "Treasury", path: "/treasury" },
      { icon: FileBadge, label: "Credentials", path: "/credentials" },
      { icon: Send, label: "Settlements", path: "/settlements" },
      { icon: ArrowLeftRight, label: "Bridge", path: "/bridge" },
    ],
  },
  {
    label: "AUDIT",
    items: [
      { icon: Eye, label: "Auditor Portal", path: "/audit" },
      { icon: ScrollText, label: "ZK Explorer", path: "/explorer" },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { icon: Settings, label: "Settings", path: "/settings" },
      { icon: HelpCircle, label: "Support", path: "/support" },
    ],
  },
];

export function Sidebar({ mobile, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const [location] = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const { credentials, aspDeposits } = useCovenantStore();

  const collapsed = mobile ? false : sidebarCollapsed;
  const badgeFor = (path: string) => {
    if (path === "/credentials" && credentials.length > 0) return String(credentials.length);
    return null;
  };

  return (
    <aside
      className="flex flex-col h-full transition-all duration-300"
      style={{
        width: mobile ? "100%" : collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)",
        background: "var(--bg-surface)",
        borderRight: mobile ? "none" : "1px solid var(--border-subtle)",
      }}
    >
      <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-5">
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location === item.path;
                const badge = badgeFor(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={onNavigate}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: isActive ? "var(--accent-primary-subtle)" : "transparent",
                      color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                      justifyContent: collapsed ? "center" : "flex-start",
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={17} className="flex-shrink-0" />
                    {!collapsed && <span className="truncate flex-1">{item.label}</span>}
                    {!collapsed && badge && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: "var(--accent-primary)", color: "#fff" }}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!mobile && (
        <div className="p-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-medium"
            style={{ color: "var(--text-tertiary)", background: "var(--bg-elevated)" }}
          >
            {collapsed ? <ChevronRight size={14} /> : (<><ChevronLeft size={14} /> Collapse</>)}
          </button>
        </div>
      )}
    </aside>
  );
}
