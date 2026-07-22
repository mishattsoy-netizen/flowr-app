"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { createAnimation, updateThemeTransitionStyles, AnimationVariant, AnimationStart } from "@/lib/themeTransition";

type Theme = "dark" | "light" | "system";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  attribute?: string;
}

interface ThemeTransitionOptions {
  variant?: AnimationVariant;
  start?: AnimationStart;
  blur?: boolean;
  url?: string;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme, options?: ThemeTransitionOptions) => void;
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

  const applyThemeDOM = useCallback((targetTheme: Theme) => {
    if (typeof window === "undefined") return;
    const isDarkOS = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = targetTheme === "system" ? (isDarkOS ? "dark" : "light") : targetTheme;
    setResolvedTheme(resolved as "dark" | "light");

    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    if (resolved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.add("light");
    }

    // Clear the inline style injected by layout.tsx on initial load,
    // allowing globals.css to properly control the background color.
    // If left, it causes a 1px light line at the bottom during transitions.
    root.style.backgroundColor = "";
    
    localStorage.setItem("theme", targetTheme);
  }, []);

  useIsomorphicLayoutEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved) {
      setThemeState(saved);
    }
    setMounted(true);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!mounted) return;
    applyThemeDOM(theme);
  }, [theme, mounted, applyThemeDOM]);

  const setTheme = useCallback((newTheme: Theme, options?: ThemeTransitionOptions) => {
    const variant = options?.variant ?? "circle-blur";
    const start = options?.start ?? "bottom-left";
    const blur = options?.blur ?? true;
    const url = options?.url ?? "";

    if (typeof window !== "undefined" && (document as any).startViewTransition) {
      const animation = createAnimation(variant, start, blur, url);

      // Suppress all CSS transitions on real DOM elements during the View Transition.
      // Without this, when the VT pseudo-elements are removed, real elements see the
      // .dark/.light class change and fire their own CSS transitions → flash.
      const root = document.documentElement;
      root.classList.add("vt-transitioning");

      // Resolve the target theme
      const isDarkOS = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const targetResolved = newTheme === "system" ? (isDarkOS ? "dark" : "light") : newTheme;
      const targetBg = targetResolved === "dark" ? "#1b1b1a" : "#ebebeb";

      // Pre-set color-scheme BEFORE the VT captures snapshots.
      // Browser-native chrome (scrollbars) responds to color-scheme outside
      // the VT snapshot system, causing a 1px light line at viewport edges.
      root.style.colorScheme = targetResolved;

      // Inject animation CSS + ::view-transition backdrop
      updateThemeTransitionStyles(
        `::view-transition { background-color: ${targetBg}; }\n` + animation.css
      );

      const transition = (document as any).startViewTransition(() => {
        flushSync(() => {
          setThemeState(newTheme);
          applyThemeDOM(newTheme);
        });
      });

      transition.finished.then(() => {
        root.classList.remove("vt-transitioning");
        root.style.colorScheme = ""; // let CSS class take over
      });
    } else {
      setThemeState(newTheme);
      applyThemeDOM(newTheme);
    }
  }, [applyThemeDOM]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
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
