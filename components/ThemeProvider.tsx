import { useEffect, type ReactNode } from "react";
import {
  DEFAULT_THEME_COLOR_MODE,
  THEME_STORAGE_KEY,
  resolvePreferredTheme,
  type ThemeColorMode,
} from "@/lib/theme";

const COLOR_MODE_QUERY = "(prefers-color-scheme: dark)";

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
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryTheme = searchParams.get("theme");
    // configuredTheme (from ACTIVE_THEME env var) is the baseline.
    // The querystring can override it per-request, but localStorage is NOT consulted —
    // otherwise a stale stored value would mask changes to ACTIVE_THEME.
    const activeTheme = resolvePreferredTheme(queryTheme, configuredTheme);
    const mediaQuery = window.matchMedia(COLOR_MODE_QUERY);

    const syncModeFromSystem = () => {
      applyThemeAttributes(activeTheme, resolveSystemColorMode());
    };

    window.localStorage.removeItem(THEME_STORAGE_KEY); // clear any stale stored theme
    syncModeFromSystem();

    const onModeChange = () => syncModeFromSystem();
    mediaQuery.addEventListener("change", onModeChange);

    return () => {
      mediaQuery.removeEventListener("change", onModeChange);
    };
  }, []);

  return <>{children}</>;
}
