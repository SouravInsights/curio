import type { AnnotationChange, DocumentChange, SyncMutation } from "@/lib/api";
import { syncPush, syncPullAnnotations, syncPullDocuments } from "@/lib/api";
import {
  META_CURSOR,
  META_ITEMS_CURSOR,
  type CurioDb,
  type LocalAnnotation,
  type LocalItem,
} from "./db";

/**
 * The sync loop.
 *
 * Two directions, and they are not symmetric. **Push** drains the outbox: the
 * local store is already the truth, so the server is only being asked to agree.
 * **Pull** feeds server changes back in — a mark made on another device — but
 * never overwrites a local write that has not synced yet.
 *
 * There is no socket. This is a single reader's library, so a flush on write, a
 * pull on focus, and an interval are enough; a realtime channel would be
 * machinery without a requirement.
 */

const PULL_PAGE_LIMIT = 50;

export class SyncEngine {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private again = false;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly db: CurioDb) {}

  /** A write happened — flush soon. Cheap to call on every keystroke. */
  kick(): void {
    void this.run();
  }

  start(): void {
    if (this.timer) return;
    void this.run();
    this.timer = setInterval(() => void this.run(), 30_000);
    window.addEventListener("online", this.onOnline);
    window.addEventListener("focus", this.onOnline);
    document.addEventListener("visibilitychange", this.onVisible);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("focus", this.onOnline);
    document.removeEventListener("visibilitychange", this.onVisible);
  }

  /** Subscribe to "the stores changed" so a caller can re-run a live query. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private readonly onOnline = () => void this.run();
  private readonly onVisible = () => {
    if (document.visibilityState === "visible") void this.run();
  };

  /**
   * One pass: push, then pull. Re-entrant calls collapse into one trailing pass,
   * so a burst of writes does not open a burst of requests.
   */
  async run(): Promise<void> {
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    // Each step is independent: a failed push must not stop the pull, and a
    // failed pull must not stop the other entity. Offline, all three fail fast
    // and the outbox keeps the writes for the next trigger.
    try {
      await this.push();
    } catch {
      /* offline, or the server is down */
    }
    try {
      await this.pullAnnotations();
    } catch {
      /* keep the marks already on disk */
    }
    try {
      await this.pullDocuments();
    } catch {
      /* keep the list already on disk */
    }
    this.running = false;
    if (this.again) {
      this.again = false;
      void this.run();
    }
  }

  /** Drain the outbox in order. Idempotent on each mutation's id. */
  async push(): Promise<void> {
    const rows = await this.db.outbox.orderBy("seq").limit(200).toArray();
    if (!rows.length) return;

    const mutations: SyncMutation[] = [];
    const seqOf = new Map<number, (typeof rows)[number]>();
    const skipped: number[] = [];

    for (const row of rows) {
      if (row.seq === undefined) continue;
      seqOf.set(row.seq, row);

      if (row.entity === "document") {
        const item = await this.db.items.get(Number(row.id));
        if (!item) {
          skipped.push(row.seq);
          continue;
        }
        mutations.push({
          seq: row.seq,
          entity: "document",
          op: "patch",
          id: row.id,
          payload: {
            readState: item.readState,
            favorite: item.favorite,
            readProgress: item.readProgress,
          },
        });
        continue;
      }

      if (row.op === "upsert") {
        const annotation = await this.db.annotations.get(row.id);
        // A row that was created and then removed locally has nothing to send;
        // its delete is already queued behind this one.
        if (!annotation || annotation.deleted) {
          skipped.push(row.seq);
          continue;
        }
        mutations.push({
          seq: row.seq,
          entity: "annotation",
          op: "upsert",
          id: row.id,
          payload: payloadOf(annotation),
        });
      } else {
        mutations.push({ seq: row.seq, entity: "annotation", op: "delete", id: row.id });
      }
    }

    if (skipped.length) await this.db.outbox.bulkDelete(skipped);
    if (!mutations.length) return;

    const result = await syncPush(mutations);
    await this.db.outbox.bulkDelete(result.applied);

    // A delete that landed can drop its tombstone: there is nothing left to
    // render and the server is the one that will report the removal onward.
    for (const seq of result.applied) {
      const row = seqOf.get(seq);
      if (row?.entity === "annotation" && row.op === "delete") {
        await this.db.annotations.delete(row.id);
      }
    }

    for (const failure of result.failed) {
      const row = seqOf.get(failure.seq);
      if (!row?.seq) continue;
      await this.db.outbox.update(row.seq, { attempts: row.attempts + 1 });
    }
  }

  /** Walk the annotation cursor forward until the server has nothing newer. */
  async pullAnnotations(): Promise<void> {
    let cursor = await this.meta(META_CURSOR);
    for (let page = 0; page < PULL_PAGE_LIMIT; page++) {
      const result = await syncPullAnnotations(cursor);
      await this.apply(result.annotations);
      cursor = result.cursor;
      await this.setMeta(META_CURSOR, cursor);
      if (!result.hasMore) break;
    }
  }

  /** Walk the document cursor. The library list is what lands. */
  async pullDocuments(): Promise<void> {
    let cursor = await this.meta(META_ITEMS_CURSOR);
    for (let page = 0; page < PULL_PAGE_LIMIT; page++) {
      const result = await syncPullDocuments(cursor);
      await this.applyItems(result.documents);
      cursor = result.cursor;
      await this.setMeta(META_ITEMS_CURSOR, cursor);
      if (!result.hasMore) break;
    }
  }

  /**
   * Apply a page of server changes.
   *
   * A row with a pending outbox entry is left alone: the local write has not
   * reached the server yet, and letting the server's older copy win would make
   * a fresh highlight flicker off the screen.
   */
  async apply(changes: AnnotationChange[]): Promise<void> {
    if (!changes.length) return;
    const pending = new Set((await this.db.outbox.toArray()).map((row) => row.id));
    await this.db.transaction("rw", this.db.annotations, async () => {
      for (const change of changes) {
        if (pending.has(change.clientId)) continue;
        if (change.deleted) {
          await this.db.annotations.delete(change.clientId);
          continue;
        }
        await this.db.annotations.put(toLocal(change));
      }
    });
    for (const listener of this.listeners) listener();
  }

  /**
   * Apply a page of document changes. A pending local patch wins until it has
   * synced, exactly as for marks.
   */
  async applyItems(changes: DocumentChange[]): Promise<void> {
    if (!changes.length) return;
    const pending = new Set(
      (await this.db.outbox.where("entity").equals("document").toArray()).map((row) => row.id),
    );
    await this.db.transaction("rw", this.db.items, async () => {
      for (const change of changes) {
        if (pending.has(String(change.id))) continue;
        if (change.hidden) {
          await this.db.items.delete(change.id);
          continue;
        }
        await this.db.items.put(toItem(change));
      }
    });
    for (const listener of this.listeners) listener();
  }

  private async meta(key: string): Promise<string | null> {
    const row = await this.db.meta.get(key);
    return typeof row?.value === "string" ? row.value : null;
  }

  private async setMeta(key: string, value: string | null): Promise<void> {
    await this.db.meta.put({ key, value });
  }
}

function payloadOf(annotation: LocalAnnotation): Record<string, unknown> {
  return {
    documentId: annotation.documentId,
    kind: annotation.kind,
    quote: annotation.quote,
    prefix: annotation.prefix,
    suffix: annotation.suffix,
    occurrence: annotation.occurrence,
    hue: annotation.hue,
    body: annotation.body,
    startLine: annotation.startLine,
    endLine: annotation.endLine,
  };
}

function toItem(change: DocumentChange): LocalItem {
  return {
    id: change.id,
    externalId: change.externalId,
    title: change.title,
    url: change.url,
    site: change.site,
    author: change.author,
    kind: change.kind,
    readState: change.readState,
    favorite: change.favorite,
    readProgress: change.readProgress,
    lastReadAt: change.lastReadAt,
    summary: change.summary,
    topics: change.topics,
    questions: change.questions,
    wordCount: change.wordCount,
    addedAt: change.addedAt,
    updatedAt: change.updatedAt,
  };
}

function toLocal(change: AnnotationChange): LocalAnnotation {
  return {
    clientId: change.clientId,
    documentId: change.documentId,
    kind: change.kind,
    quote: change.quote,
    prefix: change.prefix,
    suffix: change.suffix,
    occurrence: change.occurrence,
    hue: change.hue,
    body: change.body,
    startLine: change.startLine,
    endLine: change.endLine,
    deleted: change.deleted,
    updatedAt: change.updatedAt,
  };
}
