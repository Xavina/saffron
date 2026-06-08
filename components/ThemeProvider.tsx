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
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const activeTheme = resolvePreferredTheme(queryTheme, storedTheme || configuredTheme);
    const mediaQuery = window.matchMedia(COLOR_MODE_QUERY);

    const syncModeFromSystem = () => {
      applyThemeAttributes(activeTheme, resolveSystemColorMode());
    };

    window.localStorage.setItem(THEME_STORAGE_KEY, activeTheme);
    syncModeFromSystem();

    const onModeChange = () => syncModeFromSystem();
    mediaQuery.addEventListener("change", onModeChange);

    return () => {
      mediaQuery.removeEventListener("change", onModeChange);
    };
  }, []);

  return <>{children}</>;
}
