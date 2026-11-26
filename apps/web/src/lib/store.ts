import { create } from "zustand";
import { APPEARANCE_DEFAULT, type Appearance } from "@/components/ReaderAppearance";

/**
 * UI state — everything that is *not* server data.
 *
 * A store rather than `useState` in the shell for one reason: four separate
 * components write this. The palette toggles the agent rail, the mobile bar
 * toggles focus, the toolbar toggles both. With `useState` in one component
 * every one of those is a prop drilled through three layers.
 *
 * Server data does not belong here. Documents, counts and search results are
 * TanStack Query's, because they have a cache, a lifetime, and a refetch story
 * that a plain store would have to reinvent.
 *
 * Setters accept a value or an updater, so a call site reads the same as it did
 * with `useState`.
 */

type Updater<T> = T | ((previous: T) => T);

function resolve<T>(value: Updater<T>, previous: T): T {
  return typeof value === "function" ? (value as (p: T) => T)(previous) : value;
}

interface UiState {
  /** Which rail destination is showing: library, search, inbox, … */
  view: string;
  setView: (value: Updater<string>) => void;

  /** The document open in the reader. Null means the list. */
  selectedId: number | null;
  setSelectedId: (value: Updater<number | null>) => void;

  /** The agent rail. */
  askOpen: boolean;
  setAskOpen: (value: Updater<boolean>) => void;

  /** The list pane hidden, for a full-width read. */
  focus: boolean;
  setFocus: (value: Updater<boolean>) => void;

  /** The ⌘K palette. */
  paletteOpen: boolean;
  setPaletteOpen: (value: Updater<boolean>) => void;

  /** Reading-state filter: undefined is "all". */
  filter: string | undefined;
  setFilter: (value: Updater<string | undefined>) => void;

  /** The search field, which belongs to the search view. */
  query: string;
  setQuery: (value: Updater<string>) => void;

  /** Font, size and measure. Persisted, so it is chosen once. */
  appearance: Appearance;
  setAppearance: (value: Updater<Appearance>) => void;
}

const APPEARANCE_KEY = "curio-appearance";

function storedAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    return raw ? { ...APPEARANCE_DEFAULT, ...(JSON.parse(raw) as Appearance) } : APPEARANCE_DEFAULT;
  } catch {
    return APPEARANCE_DEFAULT;
  }
}

export const useUi = create<UiState>((set) => ({
  view: "library",
  setView: (value) => set((s) => ({ view: resolve(value, s.view) })),

  selectedId: null,
  setSelectedId: (value) => set((s) => ({ selectedId: resolve(value, s.selectedId) })),

  askOpen: false,
  setAskOpen: (value) => set((s) => ({ askOpen: resolve(value, s.askOpen) })),

  focus: false,
  setFocus: (value) => set((s) => ({ focus: resolve(value, s.focus) })),

  paletteOpen: false,
  setPaletteOpen: (value) => set((s) => ({ paletteOpen: resolve(value, s.paletteOpen) })),

  filter: undefined,
  setFilter: (value) => set((s) => ({ filter: resolve(value, s.filter) })),

  query: "",
  setQuery: (value) => set((s) => ({ query: resolve(value, s.query) })),

  appearance: typeof window === "undefined" ? APPEARANCE_DEFAULT : storedAppearance(),
  setAppearance: (value) =>
    set((s) => {
      const appearance = resolve(value, s.appearance);
      try {
        localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
      } catch {
        // private mode: the choice holds for this visit
      }
      return { appearance };
    }),
}));
