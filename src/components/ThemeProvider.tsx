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

  // Suppress useLayoutEffect warning on server by safely falling back to useEffect
  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    // Initial load from localStorage
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved) {
      setThemeState(saved);
    }
  }, []);

  useIsomorphicLayoutEffect(() => {
    const isDarkOS = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = theme === "system" ? (isDarkOS ? "dark" : "light") : theme;
    setResolvedTheme(resolved as "dark" | "light");

    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    
    // Save to localStorage if not system (or always save it)
    localStorage.setItem("theme", theme);
  }, [theme]);

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
