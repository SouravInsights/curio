"use client";

import { useEffect, useState } from "react";
import Dexie, { type Table } from "dexie";
import { getBody } from "@/lib/api";

/**
 * The content cache: the stored markdown of articles, kept so a document you
 * have opened reads offline and reopens without a request.
 *
 * It is deliberately **not** the library database. Everything here is derived
 * and disposable — the server can always produce it again — so it lives on its
 * own and is evicted by a byte budget, oldest-opened first. That is the opposite
 * lifecycle to marks and read state, which are never evicted.
 *
 * Scale rules this holds to:
 * - a body is read one row at a time, never the whole store;
 * - a small in-memory LRU serves the hot set, so navigating back is synchronous;
 * - the store evicts to a budget, and a `QuotaExceededError` evicts harder;
 * - concurrent requests for one body share a single fetch.
 */

/** Keep at most this much markdown on disk; evict down to `EVICT_TO` when over. */
const MAX_BYTES = 50 * 1024 * 1024;
const EVICT_TO = 0.8;
/** Bodies held in memory for instant navigation. */
const HOT_LIMIT = 5;
/** Only rewrite a row's recency if it actually moved this far. */
const TOUCH_MS = 60 * 60 * 1000;

interface BodyRow {
  documentId: number;
  markdown: string;
  bytes: number;
  savedAt: number;
  lastAccess: number;
}

export class ContentDb extends Dexie {
  bodies!: Table<BodyRow, number>;
  meta!: Table<{ key: string; value: number }, string>;

  constructor(userId: string) {
    super(`curio-content-${userId}`);
    this.version(1).stores({
      bodies: "documentId, lastAccess",
      meta: "key",
    });
  }
}

const open = new Map<string, ContentDb>();

export function openContentDb(userId: string): ContentDb {
  let db = open.get(userId);
  if (!db) {
    db = new ContentDb(userId);
    open.set(userId, db);
  }
  return db;
}

export async function dropContentDb(userId: string): Promise<void> {
  const db = open.get(userId);
  open.delete(userId);
  caches.delete(db as object);
  await db?.delete();
}

const caches = new Map<object, ContentCache>();

export function contentCache(db: ContentDb): ContentCache {
  let cache = caches.get(db);
  if (!cache) {
    cache = new ContentCache(db);
    caches.set(db, cache);
  }
  return cache;
}

export class ContentCache {
  private readonly inflight = new Map<number, Promise<string>>();
  private readonly hot = new Map<number, string>();

  constructor(private readonly db: ContentDb) {}

  /** The hot body, if it is in memory — synchronous, so a reopen does not flash. */
  peek(id: number): string | null {
    return this.hot.get(id) ?? null;
  }

  /** Cache first; fetch and store on a miss. Concurrent callers share one fetch. */
  async ensure(id: number): Promise<string> {
    const cached = await this.db.bodies.get(id);
    if (cached) {
      this.remember(id, cached.markdown);
      void this.touch(id);
      return cached.markdown;
    }

    const inflight = this.inflight.get(id);
    if (inflight) return inflight;

    const load = this.load(id).finally(() => this.inflight.delete(id));
    this.inflight.set(id, load);
    return load;
  }

  /** Warm the cache without a reader — a hover, an adjacent document. */
  async prefetch(id: number): Promise<void> {
    await this.ensure(id).catch(() => {});
  }

  /** How much is on disk, for diagnostics. */
  async usage(): Promise<{ count: number; bytes: number }> {
    const bytes = (await this.db.meta.get("bytes"))?.value ?? 0;
    return { count: await this.db.bodies.count(), bytes };
  }

  private async load(id: number): Promise<string> {
    const { markdown } = await getBody(id);
    const text = markdown ?? "";
    this.remember(id, text);
    // An empty body is usually a document the pipeline has not finished with.
    // Caching it would freeze "no text" forever, so leave it uncached and let
    // the next open try again. Caching itself is best-effort — the reader
    // already has the text.
    if (text) await this.store(id, text);
    return text;
  }

  private remember(id: number, markdown: string): void {
    this.hot.delete(id);
    this.hot.set(id, markdown);
    if (this.hot.size > HOT_LIMIT) {
      const oldest = this.hot.keys().next().value;
      if (oldest !== undefined) this.hot.delete(oldest);
    }
  }

  private async store(id: number, markdown: string): Promise<void> {
    try {
      await this.write(id, markdown);
      return;
    } catch (error) {
      if (!isQuotaError(error)) return;
    }
    // The budget was not enough — drop to half and try once more.
    await this.evictTo(0.5).catch(() => {});
    await this.write(id, markdown).catch(() => {});
  }

  private async write(id: number, markdown: string): Promise<void> {
    const bytes = markdown.length * 2;
    await this.db.transaction("rw", this.db.bodies, this.db.meta, async () => {
      const existing = await this.db.bodies.get(id);
      const total = Math.max(0, ((await this.db.meta.get("bytes"))?.value ?? 0) - (existing?.bytes ?? 0) + bytes);
      await this.db.bodies.put({
        documentId: id,
        markdown,
        bytes,
        savedAt: Date.now(),
        lastAccess: Date.now(),
      });
      await this.db.meta.put({ key: "bytes", value: total });
    });
    await this.evictTo(EVICT_TO);
  }

  /**
   * Delete oldest-opened rows until the store fits under `MAX_BYTES * fraction`.
   * Runs in one transaction so two writers cannot both read the counter and
   * race it downward.
   */
  private async evictTo(fraction: number): Promise<void> {
    const budget = Math.floor(MAX_BYTES * fraction);
    await this.db.transaction("rw", this.db.bodies, this.db.meta, async () => {
      let total = (await this.db.meta.get("bytes"))?.value ?? 0;
      while (total > budget) {
        const oldest = await this.db.bodies.orderBy("lastAccess").first();
        if (!oldest) {
          total = 0;
          break;
        }
        await this.db.bodies.delete(oldest.documentId);
        total -= oldest.bytes;
      }
      await this.db.meta.put({ key: "bytes", value: Math.max(0, total) });
    });
  }

  private async touch(id: number): Promise<void> {
    const row = await this.db.bodies.get(id);
    if (!row || Date.now() - row.lastAccess < TOUCH_MS) return;
    await this.db.bodies.update(id, { lastAccess: Date.now() }).catch(() => {});
  }
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof Dexie.QuotaExceededError ||
    (error instanceof DOMException && error.name === "QuotaExceededError")
  );
}

/**
 * The body of a document.
 *
 * Synchronous from the in-memory set (no loading frame on a reopen); otherwise
 * resolved from IndexedDB or fetched once. `loading` is true only while neither
 * the memory nor the disk has an answer.
 */
export function useBody(
  db: ContentDb | null,
  id: number | null,
): { markdown: string | null; loading: boolean; error: boolean } {
  const cache = db ? contentCache(db) : null;
  const hot = cache && id != null ? cache.peek(id) : null;
  const [settled, setSettled] = useState<{ id: number; markdown: string; error: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (!cache || id == null) return;
    let cancelled = false;
    cache
      .ensure(id)
      .then((markdown) => {
        if (!cancelled) setSettled({ id, markdown, error: false });
      })
      .catch(() => {
        if (!cancelled) setSettled({ id, markdown: "", error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [cache, id]);

  if (id == null || !cache) return { markdown: null, loading: false, error: false };
  const here = settled?.id === id ? settled : null;
  const markdown = hot ?? (here && !here.error ? here.markdown : null);
  return {
    markdown,
    loading: markdown == null && here == null,
    // A fetch that failed with nothing cached: offline, most likely. Worth
    // saying so rather than pretending the article is empty.
    error: markdown == null && here?.error === true,
  };
}

/** Warm a body without opening it — a hover, or the next item in the list. */
export function prefetchBody(db: ContentDb | null, id: number): void {
  if (!db) return;
  void contentCache(db).prefetch(id);
}
