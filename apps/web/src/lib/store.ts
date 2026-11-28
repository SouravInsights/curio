"use client";

import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { APPEARANCE_DEFAULT, type Appearance } from "@/components/ReaderAppearance";

/**
 * UI state — everything that is *not* server data.
 *
 * A hook, not a store library. Only `Shell` reads it and Shell already hands
 * the setters down as props, so there is no cross-tree consumer to justify a
 * third-party store. Server data stays in TanStack Query; this is local state.
 *
 * Setters accept a value or an updater, the same shape as `useState`, so a call
 * site reads the same as it would with `useState`.
 */

const APPEARANCE_KEY = "curio-appearance";
const LAST_DOC_KEY = "curio-last-document";

function storedAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    return raw ? { ...APPEARANCE_DEFAULT, ...(JSON.parse(raw) as Appearance) } : APPEARANCE_DEFAULT;
  } catch {
    return APPEARANCE_DEFAULT;
  }
}

/**
 * The document that was open last. A reload should land on the article you were
 * reading — the query cache already has its body. The shell only renders after
 * the cache restores, so reading this on the client cannot desync server HTML.
 */
function storedDocument(): number | null {
  try {
    const raw = localStorage.getItem(LAST_DOC_KEY);
    const id = raw ? Number(raw) : Number.NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export interface UiState {
  /** Which rail destination is showing: library, search, highlights, topics, settings. */
  view: string;
  setView: Dispatch<SetStateAction<string>>;

  /** The document open in the reader. Null means the list. */
  selectedId: number | null;
  setSelectedId: Dispatch<SetStateAction<number | null>>;

  /** The agent rail. */
  askOpen: boolean;
  setAskOpen: Dispatch<SetStateAction<boolean>>;

  /** The list pane hidden, for a full-width read. */
  focus: boolean;
  setFocus: Dispatch<SetStateAction<boolean>>;

  /** The ⌘K palette. */
  paletteOpen: boolean;
  setPaletteOpen: Dispatch<SetStateAction<boolean>>;

  /** Reading-state filter: undefined is "all". */
  filter: string | undefined;
  setFilter: Dispatch<SetStateAction<string | undefined>>;

  /** Browse-by-topic on the Topics surface. Empty means the index. */
  browse: { topic?: string };
  setBrowse: Dispatch<SetStateAction<{ topic?: string }>>;

  /** The search field, which belongs to the search view. */
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;

  /** Font, size and measure. Persisted, so it is chosen once. */
  appearance: Appearance;
  setAppearance: Dispatch<SetStateAction<Appearance>>;
}

export function useUiState(): UiState {
  const [view, setView] = useState("library");
  const [selectedId, setSelectedId] = useState<number | null>(() =>
    typeof window === "undefined" ? null : storedDocument(),
  );
  const [askOpen, setAskOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [browse, setBrowse] = useState<{ topic?: string }>({});
  const [query, setQuery] = useState("");
  const [appearance, setAppearance] = useState<Appearance>(() =>
    typeof window === "undefined" ? APPEARANCE_DEFAULT : storedAppearance(),
  );

  useEffect(() => {
    try {
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
    } catch {
      // private mode: the choice holds for this visit
    }
  }, [appearance]);

  useEffect(() => {
    try {
      if (selectedId == null) localStorage.removeItem(LAST_DOC_KEY);
      else localStorage.setItem(LAST_DOC_KEY, String(selectedId));
    } catch {
      // private mode: the choice holds for this visit
    }
  }, [selectedId]);

  return {
    view,
    setView,
    selectedId,
    setSelectedId,
    askOpen,
    setAskOpen,
    focus,
    setFocus,
    paletteOpen,
    setPaletteOpen,
    filter,
    setFilter,
    browse,
    setBrowse,
    query,
    setQuery,
    appearance,
    setAppearance,
  };
}
