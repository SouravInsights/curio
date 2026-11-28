---
name: book-review
description: Draft a long-form review from a book's highlights, synthesizing it with the reader's wider library to form original arguments
---

# Book Review

Draft a long-form review from a book's highlights — not just the book, but the
reader's whole library, so the review says something the book alone does not.

The goal is a review that is more interesting than a summary: **summary +
critique + original ideas**, where the original ideas come from connecting the
book to everything else the reader has read.

## Access

Curio's tools are `search_library`, `read_passage`, `list_library`,
`search_annotations`, `get_document`, `list_topics`, `save_annotation`,
`save_document`, `save_note`, `connect`, `set_read_state`, `get_persona`,
`save_persona`. In the app they are named plainly; over MCP they are prefixed
`mcp__curio__`. From a shell, the `curio` CLI covers `search`, `ask` and
`import`. The `curio-mcp` skill has the full reference.

> **Note.** Curio stores a book as a document of kind `book` with its text and the
> reader's highlights. Dedicated book tools — chapters, progress, a proper
> reading view — are coming. This skill works with what exists today: the book's
> stored markdown and its marks.

## Setup

1. **The reader's profile.** It is already in your instructions when one exists.
   Use it to decide which connections matter and what framing reads natural.

2. **Parse the request** as a book title or a search term.

   ```
   /book-review Merchant Kings
   /book-review 7 Powers
   ```

## Phase 1 — Find the book and its marks

1. **Find it.** `search_library` for the title with `kind="book"`. If nothing,
   broaden to all kinds. If several match, list them and ask.

2. **Its marks.** `search_annotations` with `documentId`. Read every highlight
   and note. Count them. If fewer than 10, warn the reader — the review may be
   thin — and ask whether to proceed.

3. **Its text.** `read_passage` across the book for the argument, structure and
   key passages the highlights sit in. Do not build the review from the summary
   line alone.

## Phase 2 — Extract claims

Turn every highlight into an atomic claim: one present-tense declarative
sentence, under 10 words when possible. If the reader left a note, weight the
claim toward what the note focused on.

| Good claim | Bad claim |
| :--- | :--- |
| "chimney sweeps died of scrotal cancer from coal soot" | "coal mining had health consequences" |
| "monsoon winds enabled global maritime trade" | "the author discusses trade" |

After processing, review the list. Rewrite anything generic, duplicative or vague
that does not stand alone. Group the survivors by theme — that grouping is the
outline.

## Phase 3 — Search the library for related material

This is what makes the review more than a summary. For each theme cluster (aim
for 3–6):

1. `search_library` for the theme's keywords.
2. `read_passage` the strongest hits, and `search_annotations` for the reader's
   own marks on them.
3. Look for **supporting evidence**, **contradictions**, **parallel examples**
   from other domains, and the **reader's own prior thinking** in their notes.

Also `search_library` for the author's name — prior context enriches the review.

Result: the book's claims, related claims from the library mapped to the same
themes, and a sense of where the reader's reading supports, complicates or
extends the book.

## Phase 4 — Write the review

Three elements, in order:

1. **Summary** — what the book is about and why it is interesting.
2. **Critique** — an actual quality-and-agreement judgment. Without this it is
   not a review.
3. **Original ideas** — connections from the reader's library. Without this,
   nobody is impressed.

### Structure

```
[Opening: a specific fact or scene, not a vague hook.]

## [Thematic section — informative header, not clever]

[The book's argument on this theme, with block quotes from its highlights.
Then expand: bring in the related material from the library. This is where
the review becomes synthesis.]

> "Block quote from the book" — Author, *Book Title*

[Weave in the related document: how it complicates or supports the point.
Link to the original source, not the Curio URL.]

## [More themes…]

[Same pattern. Organize by theme, not by chapter. Every section advances an
argument, and every section connects to something outside the book.]

## What the Book Gets Wrong (or Misses)

[Honest critique. Use the reader's other reading as evidence.]

## Further Reading

- [Sources worth exploring that were not linked above](url)
```

### Voice

- Write **for** the reader, not as them. Do not manufacture emotion ("I was
  struck by…") or personal details. If the reader left a note, use it; otherwise
  leave `%% TODO: [what the reader should add] %%`.
- First person, since it is a draft they will edit.
- Honest about gaps. "I don't know" beats hedging.

### Length

Err long — 2,000–10,000 words for a substantial book, 1,000–2,000 if the
highlights are sparse. Depth over brevity, as long as every paragraph earns its
place.

## Phase 5 — Quality Gate

A **separate pass**. Do not combine it with writing. Re-read the draft and fix:

- **Clichés.** "delve", "landscape" (figurative), "tapestry", "testament",
  "groundbreaking", "showcase", "underscore", "vibrant", "intricate", "nestled".
  Replace each with the concrete thing.
- **Tics.** "Not just X, it's Y." The rule of three. "-ing" analysis
  ("highlighting the importance of…"). False ranges ("from X to Y"). Synonym
  cycling. "Despite challenges, the future looks bright."
- **Density.** Max 2–3 em dashes per section. No word three times in a paragraph.
- **The opening.** Does it sound like a person or a summarizer? If the latter,
  rewrite.
- **Synthesis.** Does every section connect to material beyond the book? If a
  section is pure summary, add the connection or cut it.
- **Links.** Every source has a real URL. No placeholders.

## Phase 6 — Publish

Save the review into the library with `save_note`, titled `[Book Title] — Review
Draft`, so the reader can open, edit and cite it. The note carries the source
document titles it drew from.

If `save_note` fails, output the review as markdown in the conversation so the
reader can keep it.

## Error handling

- **Book not found** — report the search terms tried; ask for the title or a
  document id.
- **Fewer than 10 highlights** — warn; ask whether to proceed.
- **No related documents** — proceed, warn it will be summary-heavy, and lean on
  the book's own text.
- **Any unexpected failure** — say what failed, what is done, and where the
  partial output is.

## What makes this different from a summary

The point of Phase 3 is that the review should contain ideas the book's author
never had. The reader's library is a unique lens:

- They read about Roman logistics *and* supply-chain management → the review
  connects them in a way neither book does alone.
- They highlighted a contradicting claim elsewhere → the review challenges the
  book with evidence they already found compelling.
- They left a note on an unrelated article that turns out to be relevant → the
  review surfaces a connection they may not have made consciously.

That is where original ideas come from. The library *is* the original thinking.
