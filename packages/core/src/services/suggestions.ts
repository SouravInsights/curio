import { and, asc, cosineDistance, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@curio/core/db/index";
import { documents, libraries, passages } from "@curio/core/db/schema";
import { generateObject } from "@curio/core/observability";
import { embedOne } from "../kb/embed";
import { pipelineModel } from "../kb/model";
import { libraryCounts, listKinds, listTopics } from "./library";
import { reviewStats } from "./reviews";
import type { Scope } from "./scope";

/**
 * The questions the Ask tab opens with.
 *
 * The personal site learned this the hard way. A hand-written list drifts into
 * title-echoes; a template ("what have I read about X") produces a door that
 * opens onto nothing when X is one document. So the questions are written for
 * this library — a model reads its formats, subjects and recent titles — and
 * then **checked**: a question that does not retrieve real material is dropped
 * before it is shown. A chip is a promise that there is something behind it.
 *
 * The set is cached on the library, because it changes only when the reading
 * does. Without a model key the deterministic templates stand in, so the tab is
 * never empty.
 */

const FRESH_MS = 24 * 60 * 60 * 1000;
/** A question must pull a passage at least this close to be worth showing. */
const MIN_SIMILARITY = 0.35;
/** Recent titles handed to the model, as the map of the library. */
const MAP_DOCS = 60;
/** Asked for beyond the cap, so a rejected question leaves no hole. */
const ASKED = 18;
const WANTED = 12;

const SYSTEM = [
  "You write the questions a reader sees on their own reading library, before",
  "they know what to search for. Three jobs: remember what the library holds,",
  "meet connected ideas, and follow curiosity.",
  "",
  "Voice:",
  "- Short. 3 to 8 words. A question or a subject label.",
  "- Plain, the way a curious person asks out loud. Nothing clever.",
  "- No hooks, no clickbait, no marketing language, no suspense.",
  "",
  "Kinds, mixed:",
  "- A subject the library keeps returning to. Most of them.",
  "- A question about one piece, naming its subject.",
  "- A question that only works by crossing two or three pieces.",
  "- A request for a set of reading of one kind, such as 'what to read on X'.",
  "",
  "Rules:",
  "- Every question must be answerable from the library below. Invent nothing.",
  "- Name the subjects this reader actually reads about.",
  "- Sentence case. No trailing question mark. One clause.",
  "- Never these empty shapes: 'updates on X', 'where to find X', 'best X',",
  "  'how to improve X', 'what is trending in X'.",
  "- Spread out: at most two questions may share a subject.",
].join("\n");

export async function suggestions(scope: Scope, limit = WANTED): Promise<string[]> {
  const [actions, subjects] = await Promise.all([actionChips(scope), subjectSuggestions(scope)]);
  // Actions first: they are the shortest path to using the app. The lanes deal
  // them round-robin, so the two kinds mix across the rows rather than stacking.
  return [...actions, ...subjects].slice(0, limit);
}

/**
 * The things the reader can ask Curio to do — the reading skills, surfaced.
 * Conditional on the library having the material: never offer to quiz a reader
 * with no highlights, or to triage a pile that is empty. This is the half the
 * personal site did not have, because its collection was for visitors; here the
 * reader can act on their own library.
 */
async function actionChips(scope: Scope): Promise<string[]> {
  const [counts, review] = await Promise.all([libraryCounts(scope), reviewStats(scope)]);
  const chips: string[] = [];
  if (counts.unread > 0) chips.push("What should I read next", "Triage my unread pile");
  if (review.total > 0) chips.push("Quiz me on what I highlighted");
  if (counts.read > 0) chips.push("Recap what I have read lately");
  if (counts.all >= 4) chips.push("What do the things I have read disagree about");
  if (counts.all >= 8) chips.push("Surprise me with something in my library");
  return chips;
}

/** The questions written for the library itself, cached; templates without a key. */
async function subjectSuggestions(scope: Scope): Promise<string[]> {
  const cached = await readCache(scope);
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.questions;

  const generated = await generate(scope).catch(() => null);
  if (generated?.length) {
    await writeCache(scope, generated).catch(() => undefined);
    return generated;
  }
  return fallback(scope);
}

/** The map of the library, then the model, then a check on every question. */
async function generate(scope: Scope): Promise<string[]> {
  const [topics, kinds, rows] = await Promise.all([
    listTopics(scope),
    listKinds(scope),
    db
      .select({ title: documents.title })
      .from(documents)
      .where(
        and(
          eq(documents.libraryId, scope.libraryId),
          isNull(documents.hiddenAt),
          ne(documents.readState, "archived"),
        ),
      )
      .orderBy(desc(documents.addedAt))
      .limit(MAP_DOCS),
  ]);

  const map = [
    "Formats in this library:",
    ...kinds.map((kind) => `- ${kind.name} (${kind.count})`),
    "",
    "Subjects the reader keeps returning to:",
    ...topics.slice(0, 40).map((topic) => `- ${topic.name} (${topic.count})`),
    "",
    "Recent reading:",
    ...rows.map((row) => `- ${row.title || "(untitled)"}`),
  ].join("\n");

  const { object } = await generateObject({
    model: pipelineModel(),
    schema: z.object({ questions: z.array(z.string()) }),
    prompt: `${SYSTEM}\n\nWrite ${ASKED} questions for this library.\n\n${map}`,
  });

  const kept: string[] = [];
  const seen = new Set<string>();
  for (const raw of object.questions) {
    const question = raw.trim().replace(/\?+$/, "");
    const key = question.toLowerCase();
    if (!question || seen.has(key)) continue;
    seen.add(key);
    if ((await topSimilarity(question, scope.libraryId)) < MIN_SIMILARITY) continue;
    kept.push(question);
    if (kept.length >= WANTED) break;
  }
  return kept;
}

/** How close the nearest passage is to the question. The check, not a vibe. */
async function topSimilarity(query: string, libraryId: number): Promise<number> {
  const vector = await embedOne(query);
  const distance = sql<number>`${cosineDistance(passages.embedding, vector)}`;
  const [row] = await db
    .select({ distance })
    .from(passages)
    .innerJoin(documents, eq(documents.id, passages.documentId))
    .where(
      and(
        eq(documents.libraryId, libraryId),
        isNull(documents.hiddenAt),
        ne(documents.readState, "archived"),
      ),
    )
    .orderBy(asc(distance))
    .limit(1);
  return row ? 1 - row.distance : 0;
}

async function readCache(scope: Scope): Promise<{ questions: string[]; at: number } | null> {
  const [row] = await db
    .select({
      questions: libraries.suggestions,
      updatedAt: libraries.suggestionsUpdatedAt,
    })
    .from(libraries)
    .where(eq(libraries.id, scope.libraryId))
    .limit(1);
  if (!row?.questions?.length || !row.updatedAt) return null;
  return { questions: row.questions, at: row.updatedAt.getTime() };
}

async function writeCache(scope: Scope, questions: string[]): Promise<void> {
  await db
    .update(libraries)
    .set({ suggestions: questions, suggestionsUpdatedAt: new Date() })
    .where(eq(libraries.id, scope.libraryId));
}

/** A question per reading format. Only the formats a reader actually reads. */
const KIND_CHIPS: Record<string, string> = {
  book: "what are the main ideas in the books I have read",
  article: "what are the best articles I have saved",
  newsletter: "what did the newsletters I read say",
  pdf: "what is in the PDFs I have saved",
  note: "what have I written in my own notes",
};

const TOPIC_TEMPLATES = [
  (topic: string) => `what have I read about ${topic}`,
  (topic: string) => `what did I highlight about ${topic}`,
  (topic: string) => `what should I read next on ${topic}`,
  (topic: string) => `how does my reading on ${topic} connect`,
];

/**
 * What the tab shows when no model is wired. Derived from the reader's own
 * topics and formats, so the first screen is still about this library; only the
 * subjects with more than one document behind them, so a chip has something to
 * open onto.
 */
async function fallback(scope: Scope): Promise<string[]> {
  const [topics, kinds] = await Promise.all([listTopics(scope), listKinds(scope)]);

  const chips: string[] = [];
  const topTopics = topics
    .filter((topic) => topic.count >= 2)
    .slice(0, 6)
    .map((topic) => topic.name);
  for (let template = 0; template < TOPIC_TEMPLATES.length; template++) {
    for (const topic of topTopics) {
      chips.push(TOPIC_TEMPLATES[template]!(topic));
    }
  }
  for (const kind of kinds) {
    const chip = KIND_CHIPS[kind.name];
    if (chip && kind.count >= 3) chips.push(chip);
  }

  return [...new Set(chips)];
}
