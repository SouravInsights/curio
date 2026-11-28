/**
 * Every word of prompt text the understand stage speaks, in one file — prompts
 * are what a person adjusts most. Bump PROMPT_VERSION on any edit: rows carry
 * their version so a re-run can target only the stale ones.
 *
 * There is no classifier and no category taxonomy. A document's shape is its
 * **kind** (article, book, newsletter, PDF, note); its subjects are its
 * **topics**. One model call does both.
 */

export const PROMPT_VERSION = 2;

/**
 * The one rule every prompt follows: the page's own voice wins, and nothing
 * enters a summary that isn't on the page.
 */
export const VOICE_RULE = `Rules you must follow:
- Use the page's own words and tone. Quote a line when it's good. Never flatten it into bland AI-speak.
- Write nothing that isn't on the page: no guessed pricing, no inferred topics, no "this site could help you…". If it's not on the page, it's not in the summary.
- Two sentences, at most three. Plain.`;

/** What describe answers: squeeze the single page for a summary. */
export const DESCRIBE_INSTRUCTION =
  "Capture the thesis and the key claims — the argument, not the wrapper. If it teaches, what it teaches; if it reports, what happened; if it is a story, what it is about.";

export const describePrompt = (input: {
  url: string;
  title: string;
  author: string;
  instruction: string;
  markdown: string;
  /** Topics already in use across the library — the vocabulary leash. */
  knownTopics: string[];
}) => `Summarize this document in its own voice.

${input.instruction}

${VOICE_RULE}

Document: ${input.url}
Title: ${input.title}
${input.author ? `Author: ${input.author}` : ""}

Markdown of the document:
"""
${input.markdown}
"""

Then name the page's subjects: 2-6 short lowercase keywords (motion, typography, sqlite, agents).
- A keyword is a subject someone could follow. Specific beats general: sqlite, not databases.
- It must be able to appear on other pages too — no one-off curiosities.
- Never a packaging word (article, blog, newsletter, book, notes, guide, tutorial), an umbrella word (software, coding, writing, resources), or a billing word (pricing).
${input.knownTopics.length ? `Reuse the vocabulary already in use where it fits: ${input.knownTopics.join(", ")}.` : ""}`;
