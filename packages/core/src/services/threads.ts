import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@curio/core/db/index";
import { threadMessages, threads } from "@curio/core/db/schema";
import type { Scope } from "./scope";

/**
 * Conversations.
 *
 * Two shapes over one table. A **document thread** is one per (library,
 * document): the co-reader beside an article, resumed every time it is opened.
 * A **library thread** has no document: the full-screen Curio page, where the
 * whole library is the subject and a reader may keep several conversations.
 *
 * The agent reads the whole thread back on the next turn, so it remembers what
 * you asked, what it answered, and what you said about it — the difference
 * between a companion and a search box. Messages are stored as UIMessage parts,
 * verbatim.
 */

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  parts: unknown[];
}

export interface ThreadSummary {
  id: number;
  title: string;
  updatedAt: number;
  preview: string;
}

/** The document's thread id, creating it if this document has none. */
export async function getOrCreateThread(scope: Scope, documentId: number): Promise<number> {
  const [existing] = await db
    .select({ id: threads.id })
    .from(threads)
    .where(and(eq(threads.libraryId, scope.libraryId), eq(threads.documentId, documentId)))
    .limit(1);
  if (existing) return existing.id;

  const [row] = await db
    .insert(threads)
    .values({ libraryId: scope.libraryId, documentId })
    .onConflictDoUpdate({
      target: [threads.libraryId, threads.documentId],
      set: { updatedAt: new Date() },
    })
    .returning({ id: threads.id });
  return row!.id;
}

/** A new library-wide conversation, empty and ready for its first question. */
export async function createThread(scope: Scope, documentId: number | null = null): Promise<number> {
  const [row] = await db
    .insert(threads)
    .values({ libraryId: scope.libraryId, documentId })
    .returning({ id: threads.id });
  return row!.id;
}

/** One thread and its turns, by id. */
export async function threadById(
  scope: Scope,
  threadId: number,
): Promise<{ id: number; documentId: number | null; title: string; messages: StoredMessage[] } | null> {
  const [thread] = await db
    .select({ id: threads.id, documentId: threads.documentId, title: threads.title })
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.libraryId, scope.libraryId)))
    .limit(1);
  if (!thread) return null;

  const rows = await db
    .select({ id: threadMessages.id, role: threadMessages.role, parts: threadMessages.parts })
    .from(threadMessages)
    .where(eq(threadMessages.threadId, thread.id))
    .orderBy(asc(threadMessages.createdAt), asc(threadMessages.id));

  return {
    ...thread,
    messages: rows.map((row) => ({
      id: String(row.id),
      role: row.role as "user" | "assistant",
      parts: (row.parts as unknown[]) ?? [],
    })),
  };
}

/** The conversation about a document, oldest first. Empty when none exists. */
export async function threadFor(
  scope: Scope,
  documentId: number,
): Promise<{ threadId: number | null; messages: StoredMessage[] }> {
  const [thread] = await db
    .select({ id: threads.id })
    .from(threads)
    .where(and(eq(threads.libraryId, scope.libraryId), eq(threads.documentId, documentId)))
    .limit(1);
  if (!thread) return { threadId: null, messages: [] };
  const full = await threadById(scope, thread.id);
  return { threadId: thread.id, messages: full?.messages ?? [] };
}

/** The library-wide conversations, newest activity first, with a preview. */
export async function listThreads(scope: Scope, limit = 20): Promise<ThreadSummary[]> {
  const rows = await db
    .select({ id: threads.id, title: threads.title, updatedAt: threads.updatedAt })
    .from(threads)
    .where(and(eq(threads.libraryId, scope.libraryId), isNull(threads.documentId)))
    .orderBy(desc(threads.updatedAt))
    .limit(limit);
  if (!rows.length) return [];

  const ids = rows.map((row) => row.id);
  const recent = await db
    .select({
      threadId: threadMessages.threadId,
      role: threadMessages.role,
      parts: threadMessages.parts,
    })
    .from(threadMessages)
    .where(inArray(threadMessages.threadId, ids))
    .orderBy(desc(threadMessages.createdAt), desc(threadMessages.id));

  const preview = new Map<number, string>();
  for (const message of recent) {
    if (preview.has(message.threadId)) continue;
    const text = textOf(message.parts);
    if (text) preview.set(message.threadId, text);
  }

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.getTime(),
    preview: preview.get(row.id) ?? "",
  }));
}

/** Append a turn and touch the thread, so it sorts by activity. */
export async function appendMessage(
  scope: Scope,
  threadId: number,
  role: "user" | "assistant",
  parts: unknown[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(threadMessages).values({
      threadId,
      libraryId: scope.libraryId,
      role,
      parts,
    });
    await tx
      .update(threads)
      .set({ updatedAt: new Date() })
      .where(and(eq(threads.id, threadId), eq(threads.libraryId, scope.libraryId)));
  });
}

/** Name a conversation — the first question, trimmed, if it has no name yet. */
export async function titleThread(scope: Scope, threadId: number, title: string): Promise<void> {
  await db
    .update(threads)
    .set({ title: title.slice(0, 120), updatedAt: new Date() })
    .where(
      and(eq(threads.id, threadId), eq(threads.libraryId, scope.libraryId), eq(threads.title, "")),
    );
}

/** Forget a document's conversation. */
export async function clearThread(scope: Scope, documentId: number): Promise<void> {
  await db
    .delete(threads)
    .where(and(eq(threads.libraryId, scope.libraryId), eq(threads.documentId, documentId)));
}

/** Forget a conversation, by id. */
export async function deleteThread(scope: Scope, threadId: number): Promise<void> {
  await db
    .delete(threads)
    .where(and(eq(threads.id, threadId), eq(threads.libraryId, scope.libraryId)));
}

/** The text of a stored UIMessage part list. */
function textOf(parts: unknown): string {
  return ((parts as { type?: string; text?: string }[]) ?? [])
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join(" ");
}
