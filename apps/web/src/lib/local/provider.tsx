"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useMe } from "@/lib/queries";
import { dropDb, openDb, type CurioDb } from "./db";
import {
  dropContentDb,
  openContentDb,
  type ContentDb,
} from "./content";
import { SyncEngine } from "./sync";

/**
 * Owns the local database for the signed-in identity, and the sync loop that
 * keeps it in step with the server.
 *
 * The database is per identity (`curio-<userId>`), so a rendered row can never
 * belong to someone else. On sign-out — the identity becoming null — the
 * database is deleted, not just closed: a shared device must not keep the last
 * reader's library on disk.
 */

interface LocalContextValue {
  /** The library: marks, items, outbox — local truth, never evicted. */
  db: CurioDb | null;
  sync: SyncEngine | null;
  /** The content cache: document bodies, disposable, evicted by budget. */
  content: ContentDb | null;
}

const LocalContext = createContext<LocalContextValue>({ db: null, sync: null, content: null });

export function LocalProvider({ children }: { children: React.ReactNode }) {
  const account = useMe();
  const userId = account.data?.id ?? null;

  const value = useMemo<LocalContextValue>(() => {
    if (!userId) return { db: null, sync: null, content: null };
    const db = openDb(userId);
    return { db, sync: new SyncEngine(db), content: openContentDb(userId) };
  }, [userId]);

  // Ask the browser to keep this origin's storage. Best effort — if it says no,
  // the content cache is simply re-fetched when the browser reclaims space.
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => {});
  }, []);

  useEffect(() => {
    const sync = value.sync;
    if (!sync) return;
    sync.start();
    return () => sync.stop();
  }, [value.sync]);

  // Delete the previous identity's databases when the identity changes.
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (previous.current && previous.current !== userId) {
      void dropDb(previous.current);
      void dropContentDb(previous.current);
    }
    previous.current = userId;
  }, [userId]);

  return <LocalContext.Provider value={value}>{children}</LocalContext.Provider>;
}

export function useLocal(): LocalContextValue {
  return useContext(LocalContext);
}
