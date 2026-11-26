# Imports

Everything you read, from wherever it lives, normalized into one `documents`
row and one `passages` set. The pipeline after the import is identical for a
bookmark, an EPUB chapter, a newsletter issue and an essay.

## The contract

An adapter turns a file into documents; the pipeline does the rest.

```ts
interface ImportedDocument {
  kind: "article" | "newsletter" | "book" | "pdf" | "note" | "video" | "thread" | "other";
  externalId: string;      // `<source>:<id>` — identity within the library
  url?: string;            // present when the text must be fetched
  title?: string;
  author?: string;
  markdown?: string;       // present when the text is already known
}
```

Two paths, decided by whether `markdown` is set:

- **Fetch** (a bookmark, a reading-list URL): stored as `kind` + URL, then
  `get → read` fetches and extracts the page.
- **Direct** (an EPUB, a Kindle clip, a markdown file): the text is already in
  hand, so `understand → chunk → embed` runs and the network is never touched.

Dedupe is `(library_id, external_id)`, enforced by the database. Import a list
twice and it is a no-op; a bookmark that is also an article stays one row.

## Sources

| Source | Kind | Identity | Status |
| :--- | :--- | :--- | :--- |
| Drop a URL (on-site or `curio import`) | article | normalized URL | built (single URL) |
| Browser bookmarks (Netscape HTML) | article | normalized URL | **built** |
| Readwise CSV (articles + books) | article / book | URL or title | **built** |
| Kindle `My Clippings.txt` | book | title | **built** (own text) |
| Markdown / text files | note | file label | **built** (own text) |
| RSS / Atom feeds | article | entry URL | next (a fetch loop over `get`+`read`) |
| Instapaper / Pocket / Raindrop CSV | article | normalized URL | next (same parser as Readwise) |
| Newsletter by email (forward to an inbox) | newsletter | `Message-ID` | next (parse HTML body → `read`) |
| EPUB | book | OPF identifier | next (chapter → passage, TOC in `heading`) |
| PDF | pdf | file hash / DOI | next (text layer → markdown) |
| Browser extension / share sheet | article | normalized URL | next (POST to `/api/import`) |

Each "next" row is a parser plus an `addDocument` call — the schema, the
pipeline and retrieval already accept the result. Nothing downstream changes.

## Why the shape is source-agnostic

The site this is ported from was link-centric: `url_key` was the identity, a
`channel` recorded the intake, and a health ladder watched URLs die. None of that
survives a book. So:

- identity is `(library_id, external_id)`, and a URL is one kind of external id;
- `sources` records *where* a document came from, as data, not as schema;
- `kind` carries what the reading is;
- the health ladder is a web concern and runs only for rows with a URL.

## Books and highlights

A book is two things: its text (passages, so the agent can search and cite it)
and your marks (annotations). Kindle and Readwise exports today carry the marks;
the book text arrives with an EPUB or is fetched from the landing page.

Highlights are anchored by `quote + prefix + suffix + occurrence`, the same
mechanism the site uses, so a re-read that changes the text does not lose a mark
— it marks it `stale`. A Kindle location is not a character offset, so an
imported highlight re-finds its `startLine` by matching its quote against the
book's markdown.

## Adding a source

1. Write a parser in `src/imports/parsers.ts` returning `ImportedDocument[]`.
2. Wire the extension or a command in `src/harness/cli.ts`.
3. Run `curio import <file>`.

That is the whole surface. If the source is a sync (RSS, a mailbox) rather than a
file, the only extra is a loop and a `sources` row.
