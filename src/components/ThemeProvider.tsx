"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { countHFTSignals } from "@/lib/codeAnalyzer";

export type Theme = "glass" | "terminal" | "bloomberg";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  autoDetect: (powerSignals: string[]) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "glass",
  setTheme: () => {},
  autoDetect: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("glass");

  function setTheme(t: Theme) {
    setThemeState(t);
  }

  // Called after generation: if ≥3 HFT C++ signals detected, auto-switch to bloomberg
  function autoDetect(powerSignals: string[]) {
    const hftCount = countHFTSignals(powerSignals);
    if (hftCount >= 3) {
      setThemeState("bloomberg");
    }
  }

  // Apply data-theme attribute to <html> so CSS vars propagate everywhere
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, autoDetect }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// ── Theme Switcher UI ─────────────────────────────────────────────────────────
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const themes: { id: Theme; label: string; icon: string; activeClass: string }[] = [
    {
      id: "glass",
      label: "Glass",
      icon: "◈",
      activeClass: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
    },
    {
      id: "terminal",
      label: "Terminal",
      icon: "❯",
      activeClass: "bg-green-500/20 border-green-500/40 text-green-400",
    },
    {
      id: "bloomberg",
      label: "Bloomberg",
      icon: "◆",
      activeClass: "bg-amber-500/20 border-amber-500/40 text-amber-400",
    },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-black/40 rounded-lg border border-white/5">
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          title={`${t.label} Mode`}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-md border transition-all ${
            theme === t.id
              ? t.activeClass
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <span>{t.icon}</span>
          <span className="hidden sm:inline">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
