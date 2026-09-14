export type ThemeId = "light" | "dark" | "sepia" | "ocean";

export type ThemeOption = {
  id: ThemeId;
  label: string;
  /** [background, accent] swatch colors used to render the picker's preview dot. */
  swatch: [string, string];
};

export const THEMES: ThemeOption[] = [
  { id: "light", label: "Light", swatch: ["#f7f7f5", "#171717"] },
  { id: "dark", label: "Dark", swatch: ["#121214", "#7c8cff"] },
  { id: "sepia", label: "Sepia", swatch: ["#f6f1e7", "#a15c2e"] },
  { id: "ocean", label: "Ocean", swatch: ["#f0f5f8", "#2563eb"] }
];

export const DEFAULT_THEME: ThemeId = "light";
export const THEME_COOKIE = "pdf-theme";

export function isThemeId(value: string | undefined | null): value is ThemeId {
  return !!value && THEMES.some(theme => theme.id === value);
}

/** Reads the theme the init script (see app/layout.tsx) already applied to <html>. */
export function getAppliedTheme(): ThemeId {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const current = document.documentElement.getAttribute("data-theme");
  return isThemeId(current) ? current : DEFAULT_THEME;
}

export function setThemeCookie(id: ThemeId) {
  document.cookie = `${THEME_COOKIE}=${id};path=/;max-age=31536000;SameSite=Lax`;
}
