import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  vector,
} from "drizzle-orm/pg-core";

/**
 * The library.
 *
 * The decision that makes this a library and not a list of links:
 * a **document** is any reading item — article, newsletter, book, PDF, note —
 * identified by `(library_id, external_id)`. A URL is one kind of external id,
 * not the identity. Everything downstream (passages, annotations, retrieval)
 * is source-agnostic.
 *
 * Embedding width is fixed here at 1536 (`text-embedding-3-small`). Changing the
 * model means changing this column and re-embedding — one migration, one run.
 */

// ── identity ────────────────────────────────────────────────────────────────
// Owned by better-auth (see auth-schema.ts). Re-exported so drizzle-kit sees
// them from the one schema file.

export * from "./auth-schema";
import { user } from "./auth-schema";

/** A user's library. One per user today; the row keeps the door open for more. */
export const libraries = pgTable(
  "libraries",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("My library"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("libraries_user_unique").on(table.userId)],
);

/** An import connection: where documents came from. One row per source. */
export const sources = pgTable(
  "sources",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    libraryId: bigint("library_id", { mode: "number" })
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    /** web | bookmarks | readwise | kindle | instapaper | pocket | rss | email | epub | pdf | note */
    kind: text("kind").notNull(),
    label: text("label").notNull().default(""),
    /** Adapter-specific settings (folder, feed url, mailbox). No secrets. */
    config: jsonb("config").notNull().default({}),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sources_library_idx").on(table.libraryId)],
);

// ── documents ────────────────────────────────────────────────────────────────

export const documents = pgTable(
  "documents",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    libraryId: bigint("library_id", { mode: "number" })
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    sourceId: bigint("source_id", { mode: "number" }).references(() => sources.id, {
      onDelete: "set null",
    }),
    /** article | newsletter | book | pdf | note | video | thread | other */
    kind: text("kind").notNull().default("article"),
    /** The identity within the library — a normalized URL for web, `<source>:<id>` otherwise. */
    externalId: text("external_id").notNull(),
    url: text("url"),
    title: text("title").notNull().default(""),
    author: text("author").notNull().default(""),
    site: text("site").notNull().default(""),
    description: text("description").notNull().default(""),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    // read — the extracted text
    markdown: text("markdown"),
    wordCount: integer("word_count"),
    contentHash: text("content_hash"),
    language: text("language"),
    readStatus: text("read_status").notNull().default("pending"),

    // understand — classify + describe
    category: text("category"),
    topics: text("topics").array(),
    summary: text("summary"),
    embeddingMode: text("embedding_mode"),
    promptVersion: smallint("prompt_version"),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),

    // reading state
    readState: text("read_state").notNull().default("unread"),
    favorite: boolean("favorite").notNull().default(false),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),

    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("documents_identity_unique").on(table.libraryId, table.externalId),
    check(
      "documents_kind_check",
      sql`${table.kind} in ('article','newsletter','book','pdf','note','video','thread','other')`,
    ),
    check(
      "documents_read_status_check",
      sql`${table.readStatus} in ('pending','ok','thin','failed')`,
    ),
    check(
      "documents_read_state_check",
      sql`${table.readState} in ('unread','reading','read','archived')`,
    ),
    check("documents_embedding_mode_check", sql`${table.embeddingMode} in ('full','summary')`),
    index("documents_library_added_idx").on(table.libraryId, table.addedAt.desc(), table.id.desc()),
    index("documents_kind_idx").on(table.libraryId, table.kind),
    index("documents_category_idx").on(table.libraryId, table.category),
    // "every word you've read": literal search over the whole stored page.
    index("documents_fts_idx").using("gin", sql`to_tsvector('english', ${table.markdown})`),
  ],
);

// ── passages ──────────────────────────────────────────────────────────────────

/**
 * A citable span. This is where the reading harness diverges from the app's
 * `link_chunks`: every passage carries its offset and line range in the stored
 * markdown, so a citation can point at lines, not just a document.
 */
export const passages = pgTable(
  "passages",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    documentId: bigint("document_id", { mode: "number" })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    idx: smallint("idx").notNull(),
    content: text("content").notNull(),
    tokenCount: smallint("token_count").notNull().default(0),
    /** summary | prose | code — summaries are first class, code filterable. */
    unitType: text("unit_type").notNull().default("prose"),
    /** ATX heading path the passage sits under, e.g. "Exit animations › Timing". */
    heading: text("heading"),

    // line-level anchoring — the citation unit
    startOffset: integer("start_offset").notNull().default(0),
    endOffset: integer("end_offset").notNull().default(0),
    startLine: integer("start_line").notNull().default(0),
    endLine: integer("end_line").notNull().default(0),

    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  },
  (table) => [
    unique("passages_document_idx_unique").on(table.documentId, table.idx),
    index("passages_document_idx").on(table.documentId),
    index("passages_embedding_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
    index("passages_fts_idx").using("gin", sql`to_tsvector('english', ${table.content})`),
  ],
);

// ── annotations ───────────────────────────────────────────────────────────────

/**
 * Highlights and notes. Generalizes the app's `highlights` (owner-only writes):
 * here `library_id` owns the mark, `kind` splits a highlight from a note, and a
 * note can carry `body`. Anchoring is unchanged — quote + prefix/suffix +
 * occurrence — so a mark re-finds its spot after a re-read, or goes `stale`.
 */
export const annotations = pgTable(
  "annotations",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    documentId: bigint("document_id", { mode: "number" })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    libraryId: bigint("library_id", { mode: "number" })
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("highlight"),
    quote: text("quote").notNull().default(""),
    prefix: text("prefix").notNull().default(""),
    suffix: text("suffix").notNull().default(""),
    occurrence: smallint("occurrence").notNull().default(0),
    startLine: integer("start_line"),
    endLine: integer("end_line"),
    hue: smallint("hue").notNull().default(3),
    /** A note's own words. Empty for a plain highlight. */
    body: text("body").notNull().default(""),
    stale: boolean("stale").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("annotations_kind_check", sql`${table.kind} in ('highlight','note')`),
    index("annotations_document_idx").on(table.documentId),
    index("annotations_library_idx").on(table.libraryId),
  ],
);

// ── reading history & connections ──────────────────────────────────────────────

/** What you actually did: opened, progressed, finished, highlighted. */
export const readingEvents = pgTable(
  "reading_events",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    documentId: bigint("document_id", { mode: "number" })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    libraryId: bigint("library_id", { mode: "number" })
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    /** Free-form: percent read, the annotation id, the recall grade. */
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reading_events_document_idx").on(table.documentId),
    index("reading_events_library_created_idx").on(table.libraryId, table.createdAt.desc()),
  ],
);

/** An edge the agent drew between two things you read. */
export const connections = pgTable(
  "connections",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    libraryId: bigint("library_id", { mode: "number" })
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    fromDocumentId: bigint("from_document_id", { mode: "number" })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    toDocumentId: bigint("to_document_id", { mode: "number" })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    fromAnnotationId: bigint("from_annotation_id", { mode: "number" }).references(
      () => annotations.id,
      { onDelete: "set null" },
    ),
    toAnnotationId: bigint("to_annotation_id", { mode: "number" }).references(() => annotations.id, {
      onDelete: "set null",
    }),
    /** agrees | contradicts | extends | references | related */
    kind: text("kind").notNull().default("related"),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("connections_library_idx").on(table.libraryId),
    index("connections_from_idx").on(table.fromDocumentId),
    index("connections_to_idx").on(table.toDocumentId),
  ],
);

// ── collections ────────────────────────────────────────────────────────────────

export const collections = pgTable(
  "collections",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    libraryId: bigint("library_id", { mode: "number" })
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("collections_library_idx").on(table.libraryId)],
);

export const collectionDocuments = pgTable(
  "collection_documents",
  {
    collectionId: bigint("collection_id", { mode: "number" })
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    documentId: bigint("document_id", { mode: "number" })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    unique("collection_documents_unique").on(table.collectionId, table.documentId),
    index("collection_documents_document_idx").on(table.documentId),
  ],
);
