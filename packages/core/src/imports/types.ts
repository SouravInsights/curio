import type { Kind } from "@curio/core/kb/kinds";

/**
 * The import contract. An adapter turns a file (or a sync response) into
 * documents the pipeline can store. Everything after this is shared: the same
 * understand → chunk → embed runs for a bookmark, an EPUB chapter, a
 * newsletter issue and a web article.
 */
export interface ImportedDocument {
  kind: Kind;
  /** Identity within the library. `<source>:<id>` for imports. */
  externalId: string;
  url?: string;
  title?: string;
  author?: string;
  description?: string;
  /** Pre-extracted markdown. Absent for a URL that must be fetched. */
  markdown?: string;
  addedAt?: Date;
}

export interface ImportOptions {
  /** The file name or a label, used when the document has no title. */
  label?: string;
}

export type ImportAdapter = (
  content: string,
  opts: ImportOptions,
) => ImportedDocument[] | Promise<ImportedDocument[]>;
