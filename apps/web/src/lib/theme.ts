/**
 * The theme lives on `<html>`'s class list — the same switch the design system's
 * tokens flip on. `app/layout.tsx` sets it before paint; this reads and flips it.
 *
 * The choice is persisted in `localStorage`, and the resolved theme is also
 * written to `color-scheme` on the root, so the base canvas matches the class
 * even before the stylesheet lands. `sync()` re-applies the stored choice after
 * hydration: nothing here should ever let the class and storage disagree.
 */
export const THEME_KEY = "curio-theme";

export type Theme = "light" | "dark";

/** The stored choice, or null when the reader has never made one. */
export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

/** What the theme should be: the stored choice, else dark (this is a dark reader). */
export function resolveTheme(): Theme {
  return storedTheme() ?? "dark";
}

export function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** Put the class and the `color-scheme` hint on the root, without persisting. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function setDark(dark: boolean): void {
  const theme: Theme = dark ? "dark" : "light";
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // private mode: the class still applies for this visit
  }
}

export function toggleTheme(): void {
  setDark(!isDark());
}

/**
 * Re-apply the stored choice. Called once after hydration, so a device where the
 * inline script did not run — or where something cleared the class — still lands
 * on the theme the reader chose.
 */
export function syncTheme(): void {
  applyTheme(resolveTheme());
}
