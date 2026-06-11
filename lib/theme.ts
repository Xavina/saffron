import { DISCOVERED_THEMES as THEMES, type DiscoveredThemeName as ThemeName } from "@/lib/generated/themes";
export { THEMES };
export type { ThemeName };
export type ThemeColorMode = "light" | "dark";

export const DEFAULT_THEME: ThemeName = "saffron";
export const DEFAULT_THEME_COLOR_MODE: ThemeColorMode = "light";

export const THEME_STORAGE_KEY = "saffron.ui.theme";

const LEGACY_THEME_ALIASES: Record<string, ThemeName> = {
  authed: "authzed",
};

const isKnownThemeValue = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return THEMES.includes(normalized as ThemeName) || normalized in LEGACY_THEME_ALIASES;
};

export const resolveTheme = (value: string | null | undefined): ThemeName => {
  if (!value) {
    return DEFAULT_THEME;
  }

  const normalized = value.toLowerCase();
  if (normalized in LEGACY_THEME_ALIASES) {
    return LEGACY_THEME_ALIASES[normalized];
  }

  return THEMES.includes(normalized as ThemeName) ? (normalized as ThemeName) : DEFAULT_THEME;
};

export const resolvePreferredTheme = (
  queryValue: string | null | undefined,
  storageValue: string | null | undefined,
): ThemeName => {
  if (queryValue && isKnownThemeValue(queryValue)) {
    return resolveTheme(queryValue);
  }

  return resolveTheme(storageValue);
};
