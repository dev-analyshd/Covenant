import { create } from "zustand";

export type Theme = "dark" | "light" | "system";

function resolveTheme(t: Theme): "dark" | "light" {
  if (t === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return t;
}

function applyTheme(t: Theme) {
  const active = resolveTheme(t);
  document.documentElement.setAttribute("data-theme", active);
  localStorage.setItem("covenant-theme", t);
}

interface AppState {
  theme: Theme;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  commandPaletteOpen: boolean;
  setTheme: (t: Theme) => void;
  toggleSidebar: () => void;
  setMobileNavOpen: (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
}

const initialTheme = ((): Theme => {
  const stored = localStorage.getItem("covenant-theme") as Theme | null;
  return stored ?? "dark";
})();

applyTheme(initialTheme);

export const useAppStore = create<AppState>((set, get) => ({
  theme: initialTheme,
  sidebarCollapsed: localStorage.getItem("covenant-sidebar") === "collapsed",
  mobileNavOpen: false,
  commandPaletteOpen: false,

  setTheme: (t) => {
    applyTheme(t);
    set({ theme: t });
  },

  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    localStorage.setItem("covenant-sidebar", next ? "collapsed" : "expanded");
    set({ sidebarCollapsed: next });
  },

  setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
}));

if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (useAppStore.getState().theme === "system") {
      applyTheme("system");
    }
  });
}
