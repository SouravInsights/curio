import { z } from "zod";
import { generateText, Output, type LanguageModel } from "@curio/core/observability";

/**
 * topics.ts — the rules for what may become a topic.
 *
 * A topic is a label shared by many documents, so related reading can be found
 * together. One job: JOINING. A word that can only ever sit on one document is
 * noise. The model proposes topics; this file decides what gets stored. Nothing
 * reaches the database without passing cleanTopics().
 *
 */

const BANNED_TOPICS = new Set([
  // tautologies
  "software development",
  "technology",
  "tech",
  "coding",
  "general",
  "content",
  "media",
  "resources",
  // packaging words
  "tutorial",
  "guide",
  "notes",
  // format words — the shape of the reading, never a subject
  "article",
  "blog",
  "blogs",
  "publication",
  "people",
  "person",
  "tool",
  "tools",
  "learning",
  "inspiration",
  "directory",
  "other",
  "newsletter",
  "newsletters",
  "portfolio",
  "gallery",
  "galleries",
  "book",
  "books",
  // billing
  "pricing",
]);

const MAX_TOPICS = 7;
const MAX_TOPIC_WORDS = 4;
const MAX_TOPIC_CHARS = 30;
const TOPIC_START = /^[a-z0-9]/;

const tidyTopic = (topic: string) =>
  topic.toLowerCase().trim().replace(/\s+/g, " ").replace(/\.+$/, "");

const spellingKeyOf = (topic: string) => tidyTopic(topic).replace(/[^a-z0-9]/g, "");

const sameWordByLetters = (a: string, b: string) => {
  const [ka, kb] = [spellingKeyOf(a), spellingKeyOf(b)];
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const [short, long] = ka.length < kb.length ? [ka, kb] : [kb, ka];
  return long === short + "s";
};

/** The seven gates every proposed topic passes, in order. */
export function cleanTopics(
  topics: string[],
  winningSpellings: Record<string, string> = {},
): string[] {
  const cleaned = topics
    .map(tidyTopic)
    .filter(Boolean)
    .map((t) => winningSpellings[t] ?? t)
    .filter(
      (t) =>
        TOPIC_START.test(t) &&
        t.length <= MAX_TOPIC_CHARS &&
        t.split(" ").length <= MAX_TOPIC_WORDS,
    )
    .filter((t) => !BANNED_TOPICS.has(t));

  const unique = Array.from(new Set(cleaned));

  const wordsOf = (t: string) => t.split(/[\s-]+/);
  const kept = unique.filter(
    (a) =>
      !unique.some(
        (b) =>
          b !== a &&
          wordsOf(b).length > wordsOf(a).length &&
          wordsOf(a).every((w) => wordsOf(b).includes(w)),
      ),
  );

  return kept.slice(0, MAX_TOPICS);
}

function countTopicSpellings(rowsTopics: (string[] | null)[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const topics of rowsTopics) {
    for (const tidy of (topics ?? []).map(tidyTopic).filter(Boolean)) {
      counts.set(tidy, (counts.get(tidy) ?? 0) + 1);
    }
  }
  return counts;
}

function pickMostUsedSpelling(spellings: string[], counts: Map<string, number>): string {
  return spellings.sort(
    (a, b) =>
      (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.length - b.length || a.localeCompare(b),
  )[0]!;
}

function clusterByLetters(spellings: string[]): string[][] {
  const clusters: string[][] = [];
  for (const spelling of spellings) {
    const home = clusters.find((c) => c.some((m) => sameWordByLetters(m, spelling)));
    if (home) home.push(spelling);
    else clusters.push([spelling]);
  }
  return clusters;
}

function spellingsWinners(
  clusters: string[][],
  counts: Map<string, number>,
): Record<string, string> {
  const winners: Record<string, string> = {};
  for (const cluster of clusters) {
    if (cluster.length < 2) continue;
    const winner = pickMostUsedSpelling(cluster, counts);
    for (const variant of cluster) if (variant !== winner) winners[variant] = winner;
  }
  return winners;
}

/** Winners from letters alone — no model, no cost. */
export function buildLetterCanonical(rowsTopics: (string[] | null)[]): Record<string, string> {
  const counts = countTopicSpellings(rowsTopics);
  return spellingsWinners(clusterByLetters(Array.from(counts.keys())), counts);
}

/**
 * buildTopicVocabulary — what the prompt hands the model to reuse, plus the
 * winning spelling of every known variant. Letters first, then one LLM call
 * groups true synonyms; a failed call just uses round 1's answer.
 */
export async function buildTopicVocabulary(
  rowsTopics: (string[] | null)[],
  model: LanguageModel,
  limit = 150,
): Promise<{ vocabulary: string[]; winningSpellings: Record<string, string> }> {
  const counts = countTopicSpellings(rowsTopics);
  const all = Array.from(counts.keys());

  const clusters = clusterByLetters(all);

  const recurring = all.filter((t) => (counts.get(t) ?? 0) >= 2);
  if (recurring.length >= 30) {
    try {
      const { output } = await generateText({
        model,
        abortSignal: AbortSignal.timeout(360_000),
        output: Output.object({ schema: z.object({ groups: z.array(z.array(z.string())) }) }),
        prompt: [
          "Topic keywords used across a personal reading library, one per line:",
          "",
          ...recurring,
          "",
          'Group TRUE synonyms only: terms that mean the same concept in this library (like "llm" and "language models"). When in doubt, do not group. Return only the groups.',
        ].join("\n"),
      });
      if (output) {
        for (const group of output.groups) {
          const homes = clusters.filter((c) => c.some((m) => group.includes(m)));
          if (homes.length > 1) {
            const merged = homes.flat();
            for (const home of homes) clusters.splice(clusters.indexOf(home), 1);
            clusters.push(merged);
          }
        }
      }
    } catch (error) {
      console.warn(
        `  topic curation skipped (${error instanceof Error ? error.message.slice(0, 60) : error})`,
      );
    }
  }

  const winningSpellings = spellingsWinners(clusters, counts);

  const joinedCounts = new Map<string, number>();
  for (const topics of rowsTopics) {
    for (const tidy of cleanTopics(topics ?? [], winningSpellings)) {
      joinedCounts.set(tidy, (joinedCounts.get(tidy) ?? 0) + 1);
    }
  }
  const vocabulary = Array.from(joinedCounts.entries())
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([t, n]) => `${t} (${n})`);

  return { vocabulary, winningSpellings };
}
