import { ReactNode, useEffect, useState } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { useAppStore } from "../../lib/appStore";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import { AlertCircle } from "lucide-react";
import { useCovenantStore } from "../../lib/store";

export function Layout({ children }: { children: ReactNode }) {
  const { sidebarCollapsed, mobileNavOpen, setMobileNavOpen } = useAppStore();
  const [location] = useLocation();
  const { error } = useCovenantStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [location]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar onMenuClick={() => setDrawerOpen(true)} />

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 animate-in" style={{ background: "var(--bg-surface)" }}>
            <Sidebar mobile onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="hidden lg:block fixed top-16 left-0 bottom-0 z-30">
        <Sidebar />
      </div>

      {error && (
        <div
          className="fixed left-0 right-0 z-30 flex items-center gap-3 px-4 sm:px-6 py-2 text-sm"
          style={{ top: "64px", background: "var(--accent-danger-subtle)", borderBottom: "1px solid var(--border-subtle)" }}
        >
          <AlertCircle size={14} style={{ color: "var(--accent-danger)", flexShrink: 0 }} />
          <span style={{ color: "var(--accent-danger)" }}>Stellar Horizon: {error}</span>
        </div>
      )}

      <main
        className="pt-16 pb-20 lg:pb-8 transition-all duration-300"
        style={{ paddingLeft: 0 }}
      >
        <div
          className="hidden lg:block"
          style={{ paddingLeft: sidebarCollapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)", transition: "padding-left 0.3s ease" }}
        >
          <div className="max-w-[1200px] mx-auto p-6 sm:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <div className="lg:hidden">
          <div className="max-w-[1200px] mx-auto p-4 sm:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={location}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
