"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  attribute?: string;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "dark" | "light";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");

  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : useEffect;

  // Track if we've mounted to avoid overwriting localStorage on first render
  const [mounted, setMounted] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved) {
      setThemeState(saved);
    }
    setMounted(true);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!mounted) return; // Don't run the side effects until we've read from localStorage

    const isDarkOS = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = theme === "system" ? (isDarkOS ? "dark" : "light") : theme;
    setResolvedTheme(resolved as "dark" | "light");

    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    if (resolved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.add("light");
    }
    
    // Save to localStorage
    localStorage.setItem("theme", theme);
  }, [theme, mounted]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
