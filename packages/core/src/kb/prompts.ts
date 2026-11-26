import { CATEGORY_PROMPT_LIST, type Category } from "./categories";

/**
 * Every word of prompt text the understand stage speaks, in one file — prompts
 * are what a person adjusts most. Bump PROMPT_VERSION on any edit: rows carry
 * their version so a re-run can target only the stale ones.
 *
 * Source of truth for the taxonomy: categories.ts. Change definitions there,
 * bump PROMPT_VERSION here.
 */

export const PROMPT_VERSION = 1;

/**
 * The one rule every prompt follows: the page's own voice wins, and nothing
 * enters a summary that isn't on the page.
 */
export const VOICE_RULE = `Rules you must follow:
- Use the page's own words and tone. Quote a line when it's good. Never flatten it into bland AI-speak.
- Write nothing that isn't on the page: no guessed pricing, no inferred topics, no "this site could help you…". If it's not on the page, it's not in the summary.
- Two sentences, at most three. Plain.`;

/** What classify answers: what IS this document. Subjects come later, in describe. */
export const classifyPrompt = (input: {
  url: string;
  title: string;
  description: string;
  site: string;
  sample: string;
  stats: string;
}) => `You are labeling one saved web page for a personal reading library.

The decisive rule, before all definitions: judge the page, not the place it
lives. Container words — "/blog/" or "/posts/" in the URL, a date slug, a
title like "Post title — The Blog of Someone" — describe the shelf, not the
page. A page is its own evidence.

Pick its category from this list (nothing else is allowed):
${CATEGORY_PROMPT_LIST}

Decide by what a visitor comes to DO — look, learn, use, leave via links,
read one piece, follow an outlet, meet one person:
- A showcase that links out is still inspiration; a directory is a plain list of destinations.
- Writing that teaches is an article; learning needs teaching structure (a table of contents, chapters, lessons).
- One person's index of their own work is people; that same person's list of other people's things is a directory.
- A company's product page is a tool; a post on its blog is an article.

Read the shape, not just the words. An index page is short on prose and dense
with same-site links; a post has one dominant subject. The stats line counts
the whole page's markdown — many links on a short page means an index.

Thin or broken evidence: if the page is very short, or its text is a bot
checkpoint, judge only from the URL, title and meta description, and set
confidence to low. Low confidence becomes "other" and queues the document.

Page:
URL: ${input.url}
Title: ${input.title}
Meta description from the page: ${input.description || "(none)"}
Site name: ${input.site || "(none)"}
${input.stats}

Heading outline:
${input.sample}`;

/** What describe answers, per category: squeeze the single page for a summary. */
export const DESCRIBE_PROMPTS: Record<Category, string> = {
  article: "Capture the thesis and the key claims — the argument, not the wrapper.",
  publication:
    "Capture what this outlet publishes, who edits or writes it, and its cadence or subscription details if shown.",
  people:
    "Capture who this person is, what they do, their notable work, and their socials if shown.",
  inspiration:
    "Capture what the place is, what kind of work it showcases, and what a visitor gets from looking.",
  tool: "Capture what it does, who it is for, and its pricing or free tier or open-source status if shown.",
  learning:
    "Capture what it teaches, its structure or table of contents if present, and any FAQ or price nuggets. If the page is thin, the summary says so honestly.",
  directory: "Capture what the place is and what kind of destinations it points to.",
  other: "Describe what this page is and what it offers.",
};

export const describePrompt = (input: {
  url: string;
  title: string;
  author: string;
  published: string;
  category: Category;
  instruction: string;
  markdown: string;
  /** Topics already in use across the library — the vocabulary leash. */
  knownTopics: string[];
}) => `Summarize this page in the page's own voice.

It is a "${input.category}". ${input.instruction}

${VOICE_RULE}

Page: ${input.url}
Title: ${input.title}
${input.author ? `Author: ${input.author}` : ""}
${input.published ? `Published: ${input.published}` : ""}

Markdown of the page:
"""
${input.markdown}
"""

Then name the page's subjects: 2-6 short lowercase keywords (motion, typography, sqlite, agents).
- A keyword is a subject someone could follow. Specific beats general: sqlite, not databases.
- It must be able to appear on other pages too — no one-off curiosities.
- Never a category word (article, blog, tool, people…), an umbrella word (software, coding, writing, resources), or a billing word (pricing).
${input.knownTopics.length ? `Reuse the vocabulary already in use where it fits: ${input.knownTopics.join(", ")}.` : ""}`;
