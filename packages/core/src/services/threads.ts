import { and, asc, eq } from "drizzle-orm";
import { db } from "@curio/core/db/index";
import { threadMessages, threads } from "@curio/core/db/schema";
import type { Scope } from "./scope";

/**
 * Conversations about a document.
 *
 * One thread per (library, document). The agent reads the whole thread back on
 * the next turn, so the co-reader remembers what you asked, what it answered,
 * and what you said about it — the difference between a companion and a search
 * box. Messages are stored as UIMessage parts, verbatim.
 */

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  parts: unknown[];
}

/** The thread's id, creating it if this document has none. */
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

/** The conversation so far, oldest first. Empty when none exists. */
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

  const rows = await db
    .select({ id: threadMessages.id, role: threadMessages.role, parts: threadMessages.parts })
    .from(threadMessages)
    .where(eq(threadMessages.threadId, thread.id))
    .orderBy(asc(threadMessages.createdAt), asc(threadMessages.id));

  return {
    threadId: thread.id,
    messages: rows.map((row) => ({
      id: String(row.id),
      role: row.role as "user" | "assistant",
      parts: (row.parts as unknown[]) ?? [],
    })),
  };
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

/** Forget a document's conversation. */
export async function clearThread(scope: Scope, documentId: number): Promise<void> {
  await db
    .delete(threads)
    .where(and(eq(threads.libraryId, scope.libraryId), eq(threads.documentId, documentId)));
}
