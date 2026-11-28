import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@curio/core/db/index";
import { annotations, documents, readingEvents } from "@curio/core/db/schema";
import type { Scope } from "./scope";

/**
 * Recall — spaced repetition over the reader's own marks.
 *
 * The reader already chose what mattered when they highlighted it. This brings
 * those marks back at widening intervals so the reading sticks, without asking
 * them to re-read. It is the retention half of the mission; the marks are the
 * reader's, and so is the act of remembering — the agent only schedules.
 *
 * Scheduling is SM-2-lite: four grades, a growing interval, no ease factor to
 * tune. A mark never reviewed is due. `reading_events` keeps the history; the
 * columns on `annotations` keep the next date.
 */

export const REVIEW_GRADES = ["again", "hard", "good", "easy"] as const;
export type ReviewGrade = (typeof REVIEW_GRADES)[number];

const DAY = 24 * 60 * 60 * 1000;

export interface ReviewCard {
  clientId: string;
  documentId: number;
  title: string;
  quote: string;
  body: string;
  startLine: number | null;
  endLine: number | null;
  reviewCount: number;
  reviewInterval: number;
}

/** The next interval and when it comes due. Pure, so it is easy to reason about. */
export function nextSchedule(
  grade: ReviewGrade,
  interval: number,
): { interval: number; dueIn: number } {
  if (grade === "again") return { interval: 0, dueIn: 10 * 60 * 1000 };
  if (interval <= 0) {
    const first = grade === "easy" ? 3 : 1;
    return { interval: first, dueIn: first * DAY };
  }
  const factor = grade === "hard" ? 1.2 : grade === "easy" ? 3 : 2.3;
  const next = Math.min(365, Math.max(1, Math.round(interval * factor)));
  return { interval: next, dueIn: next * DAY };
}

/** Marks due for recall: never reviewed, or due now. Oldest due first. */
export async function reviewQueue(scope: Scope, limit = 20): Promise<ReviewCard[]> {
  return db
    .select({
      clientId: annotations.clientId,
      documentId: annotations.documentId,
      title: documents.title,
      quote: annotations.quote,
      body: annotations.body,
      startLine: annotations.startLine,
      endLine: annotations.endLine,
      reviewCount: annotations.reviewCount,
      reviewInterval: annotations.reviewInterval,
    })
    .from(annotations)
    .innerJoin(documents, eq(documents.id, annotations.documentId))
    .where(
      and(
        eq(annotations.libraryId, scope.libraryId),
        sql`${annotations.deletedAt} is null`,
        sql`${annotations.stale} is false`,
        or(isNull(annotations.reviewDueAt), lte(annotations.reviewDueAt, new Date())),
      ),
    )
    .orderBy(asc(annotations.reviewDueAt), asc(annotations.id))
    .limit(limit);
}

/** How much is waiting, and how much the reader has been through. */
export async function reviewStats(scope: Scope): Promise<{ due: number; total: number }> {
  const [row] = await db
    .select({
      due: sql<number>`count(*) filter (where ${annotations.reviewDueAt} is null or ${annotations.reviewDueAt} <= now())::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(annotations)
    .where(and(eq(annotations.libraryId, scope.libraryId), sql`${annotations.deletedAt} is null`));
  return row ?? { due: 0, total: 0 };
}

/** Grade one mark and schedule its next appearance. */
export async function gradeReview(
  scope: Scope,
  clientId: string,
  grade: ReviewGrade,
): Promise<{ clientId: string; interval: number; dueAt: Date } | null> {
  const [row] = await db
    .select({
      id: annotations.id,
      documentId: annotations.documentId,
      reviewInterval: annotations.reviewInterval,
      reviewCount: annotations.reviewCount,
    })
    .from(annotations)
    .where(and(eq(annotations.clientId, clientId), eq(annotations.libraryId, scope.libraryId)))
    .limit(1);
  if (!row) return null;

  const { interval, dueIn } = nextSchedule(grade, row.reviewInterval);
  const dueAt = new Date(Date.now() + dueIn);
  const now = new Date();

  await db
    .update(annotations)
    .set({
      reviewInterval: interval,
      reviewCount: row.reviewCount + 1,
      reviewDueAt: dueAt,
      lastReviewedAt: now,
      updatedAt: now,
    })
    .where(eq(annotations.id, row.id));

  await db.insert(readingEvents).values({
    documentId: row.documentId,
    libraryId: scope.libraryId,
    kind: "review",
    meta: { grade, interval, clientId },
  });

  return { clientId, interval, dueAt };
}
