import { listKinds, listTopics } from "./library";
import type { Scope } from "./scope";

/**
 * The ways into the library, derived from the library itself.
 *
 * Curio is a reader, not a links page: the formats are the ones you actually
 * read — articles, books, newsletters, PDFs, your own notes — and the interests
 * are the reader's own topics. Video, threads and the like are not reading
 * formats and get no chip.
 *
 * The personal site learned the other half of this the hard way: hand-written
 * suggestion chips drift into title-echoes and go stale. These come from the
 * reader's own topics and kinds, so the first screen is about this person's
 * library.
 *
 * No model call. A chip is a door, not an answer; it should be cheap and always
 * available, even before a key is configured.
 */

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

const EVERGREEN = [
  "What should I read next?",
  "Quiz me on what I highlighted",
  "What do the things I have read disagree about?",
  "What did I highlight recently?",
  "What have I read that connects to what I am reading now?",
];

export async function suggestions(scope: Scope, limit = 18): Promise<string[]> {
  const [{ topics }, kinds] = await Promise.all([listTopics(scope), listKinds(scope)]);

  const chips: string[] = [];

  // Topics first: the most specific, most personal way in. Round-robin the
  // templates across topics so the first lane is not all one kind of question.
  const topTopics = topics.slice(0, 6).map((row) => row.name);
  for (let template = 0; template < TOPIC_TEMPLATES.length; template++) {
    for (const topic of topTopics) {
      chips.push(TOPIC_TEMPLATES[template]!(topic));
    }
  }

  // Then the shape of the library: one chip per reading format they have.
  for (const kind of kinds) {
    const chip = KIND_CHIPS[kind.name];
    if (chip) chips.push(chip);
  }

  const all = [...chips, ...EVERGREEN];
  return [...new Set(all)].slice(0, limit);
}
