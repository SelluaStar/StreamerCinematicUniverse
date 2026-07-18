"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "night" | "light" | "midnight";
type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  highContrast: boolean;
  setHighContrast: (value: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("night");
  const [highContrast, setHighContrastState] = useState(false);
  const [reducedMotion, setReducedMotionState] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("scu-theme") as Theme | null;
    const savedContrast = localStorage.getItem("scu-contrast") === "true";
    const savedMotion = localStorage.getItem("scu-reduced-motion") === "true";
    if (saved) setThemeState(saved);
    setHighContrastState(savedContrast);
    setReducedMotionState(savedMotion);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("high-contrast", highContrast);
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
  }, [theme, highContrast, reducedMotion]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (next: Theme) => {
        setThemeState(next);
        localStorage.setItem("scu-theme", next);
      },
      highContrast,
      setHighContrast: (next: boolean) => {
        setHighContrastState(next);
        localStorage.setItem("scu-contrast", `${next}`);
      },
      reducedMotion,
      setReducedMotion: (next: boolean) => {
        setReducedMotionState(next);
        localStorage.setItem("scu-reduced-motion", `${next}`);
      }
    }),
    [theme, highContrast, reducedMotion]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
