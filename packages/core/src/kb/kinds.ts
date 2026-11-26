/** The kinds of reading a document can be. One const, the code-of-record. */
export const KINDS = [
  "article",
  "newsletter",
  "book",
  "pdf",
  "note",
  "video",
  "thread",
  "other",
] as const;

export type Kind = (typeof KINDS)[number];
