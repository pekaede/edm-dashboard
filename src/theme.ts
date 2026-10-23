export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "edm-theme";

/**
 * Browser chrome (mobile status bar / PWA title bar) follows the page surface
 * color. Keep in sync with `--surface-page` in src/tokens.css.
 */
export const THEME_COLOR: Record<Theme, string> = {
  light: "#f7f8fa",
  dark: "#111318",
};

/** Sync the theme-color meta with the active theme; a no-op when the meta is absent. */
export function syncThemeColor(theme: Theme): void {
  try {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLOR[theme]);
  } catch {
    // The meta tag is optional; theming works without it.
  }
}

/** Keep the decision order in sync with the pre-paint script in index.html. */
export function resolveInitialTheme(browser?: Pick<Window, "localStorage" | "matchMedia">): Theme {
  try {
    const saved = browser?.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
  try {
    return browser?.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function getTheme(): Theme {
  const applied = document.documentElement.getAttribute("data-theme");
  return applied === "light" || applied === "dark" ? applied : resolveInitialTheme(window);
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  syncThemeColor(theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The current page still switches when persistence is unavailable.
  }
}
