/**
 * The theme lives on `<html>`'s class list — the same switch the design system's
 * tokens flip on. `app/layout.tsx` sets it before paint; this reads and flips it.
 */
export const THEME_KEY = "curio-theme";

export function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function setDark(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    // private mode: the class still applies for this visit
  }
}

export function toggleTheme(): void {
  setDark(!isDark());
}
