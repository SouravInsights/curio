/**
 * The eight categories a document can be — the code-of-record for the taxonomy,
 * including the exact wording of each definition. CATEGORY_DEFS is the single
 * source of truth: the classify prompt builds its list from it.
 *
 * library the categories do less filtering than on a links page — a document's
 * `kind` (article/book/newsletter) carries the shape — but they still organize a
 * mixed library and they steer retrieval when a question is about a kind of
 * reading ("which people should I follow").
 *
 * Three rules decide any page:
 *
 * 1. JUDGE THE PAGE, NOT THE PLACE IT LIVES. Container words ("/blog/" in the
 *    URL, a date slug) describe the shelf, not the page.
 * 2. PURPOSE BEATS PACKAGING. What does the reader come to DO — read one piece,
 *    follow an outlet, meet one person, look, learn, use, leave via links?
 * 3. IDENTITY BY NAME, MECHANICS BY EVIDENCE. A site named after its author is
 *    `people`; an editorial name is judged by what it does.
 */

export const CATEGORIES = [
  "article",
  "publication",
  "people",
  "tool",
  "learning",
  "inspiration",
  "directory",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface CategoryDef {
  /** What the classify model hears (second person, with its tie-breaks). */
  prompt: string;
  /** What a reader sees behind the "i" button. */
  blurb: string;
}

export const CATEGORY_DEFS: Record<Category, CategoryDef> = {
  article: {
    prompt: "one piece of writing: an essay, post, guide or case study, wherever it lives",
    blurb: "One piece of writing: an essay, post, or guide.",
  },
  publication: {
    prompt:
      "an editorial outlet that publishes many pieces: a magazine, journal, or curated newsletter",
    blurb: "Magazines, journals, and curated letters that keep publishing.",
  },
  people: {
    prompt:
      "one person's own site: homepage, about page, or the index of their own writing and work. A single piece of their writing is an article, never people.",
    blurb: "Someone's own site: their homepage, work, and writing.",
  },
  tool: {
    prompt:
      "what remains that you use directly: library, CLI, app, SaaS, a data platform. Free or paid is irrelevant. Use tool only when the visit is to get or work with the thing itself.",
    blurb: "Things you use, from small libraries to big SaaS.",
  },
  learning: {
    prompt:
      "structured teaching: a course, book, curriculum, or reference. A course's landing page is still learning. One piece of writing that teaches is an article.",
    blurb: "Courses, books, and tutorials.",
  },
  inspiration: {
    prompt:
      "a showcase to look at: design galleries, collections of sites, screens, illustrations.",
    blurb: "Where you go for inspiration.",
  },
  directory: {
    prompt:
      "a list whose value is pointing elsewhere: blogrolls, link collections, a stash of books. A database you query is a tool, not a directory.",
    blurb: "Lists of places to go.",
  },
  other: {
    prompt: "you cannot place it confidently",
    blurb: "None of the above, or not enough evidence to tell.",
  },
};

/** The list the classify prompt speaks, generated from CATEGORY_DEFS. */
export const CATEGORY_PROMPT_LIST = CATEGORIES.map(
  (c) => `- ${c} — ${CATEGORY_DEFS[c].prompt}`,
).join("\n");

/** What the "i" button shows, generated from CATEGORY_DEFS. */
export const CATEGORY_BLURBS: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c, CATEGORY_DEFS[c].blurb]),
) as Record<Category, string>;

export const isCategory = (value: string): value is Category =>
  (CATEGORIES as readonly string[]).includes(value);
