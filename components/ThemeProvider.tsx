import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_THEME,
  DEFAULT_THEME_COLOR_MODE,
  THEME_STORAGE_KEY,
  resolvePreferredTheme,
  type ThemeColorMode,
  type ThemeName,
} from "@/lib/theme";

const COLOR_MODE_QUERY = "(prefers-color-scheme: dark)";

type ThemeContextValue = {
  activeTheme: ThemeName;
};

const ThemeContext = createContext<ThemeContextValue>({ activeTheme: DEFAULT_THEME });

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);

type ThemeProviderProps = {
  children: ReactNode;
  configuredTheme?: string;
};

const resolveSystemColorMode = (): ThemeColorMode => {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_COLOR_MODE;
  }

  return window.matchMedia(COLOR_MODE_QUERY).matches ? "dark" : "light";
};

const applyThemeAttributes = (theme: string, colorMode: ThemeColorMode) => {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.colorMode = colorMode;
};

export default function ThemeProvider({ children, configuredTheme }: ThemeProviderProps) {
  const [activeTheme, setActiveTheme] = useState<ThemeName>(
    resolvePreferredTheme(null, configuredTheme),
  );

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryTheme = searchParams.get("theme");
    // configuredTheme (from ACTIVE_THEME env var) is the baseline.
    // The querystring can override it per-request, but localStorage is NOT consulted —
    // otherwise a stale stored value would mask changes to ACTIVE_THEME.
    const resolved = resolvePreferredTheme(queryTheme, configuredTheme);
    setActiveTheme(resolved);

    const mediaQuery = window.matchMedia(COLOR_MODE_QUERY);

    const syncModeFromSystem = () => {
      applyThemeAttributes(resolved, resolveSystemColorMode());
    };

    window.localStorage.removeItem(THEME_STORAGE_KEY); // clear any stale stored theme
    syncModeFromSystem();

    const onModeChange = () => syncModeFromSystem();
    mediaQuery.addEventListener("change", onModeChange);

    return () => {
      mediaQuery.removeEventListener("change", onModeChange);
    };
  }, []);

  return <ThemeContext.Provider value={{ activeTheme }}>{children}</ThemeContext.Provider>;
}
