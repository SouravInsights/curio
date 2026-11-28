---
name: reader-recap
description: A conversational briefing on recent reading — what you finished, highlighted, and had to say about it
---

# Reader Recap

Catch the reader up on their own reading, like a well-read assistant over coffee.
Warm, specific, short. Not a data dump.

## Access

Use the Curio MCP tools (`mcp__curio__*`) or the CLI. See `curio-mcp`.

## Process

1. **Persona.** Read `reader_persona.md` if it exists, to contextualize.

2. **Gather, in parallel:**
   - `search_annotations` for their recent marks. Curio returns annotations
     newest first; a broad query like `"the"` is not useful, so run a few that
     cover the library's interests, or query the title of anything they finished.
   - `list_library` with `readState="read"`, `limit=20` — what they finished.
   - `list_library` with `readState="reading"`, `limit=10` — what is in progress.

3. **Split the marks:**
   - **Annotated** — a highlight with a note, or a note alone. The reader had
     something to say.
   - **Highlighted only** — marked but not annotated.
   - **Finished, no marks** — read without engaging. Mention in aggregate.

4. **Flag the annotations** worth following up:

   | Flag | Pattern |
   | :--- | :--- |
   | Question | a "?" or an open ask |
   | TODO | "look up", "try", "verify", "follow up" |
   | Idea | connects two concepts or proposes something |
   | Disagreement | pushes back on the source |
   | Cross-reference | names another piece or author |

5. **Write the recap.**

   - **One opening line** on the period. "A heavy week — ten articles and a book,
     mostly history and tooling."
   - **One short paragraph per annotated piece**, ordered by engagement. What it
     was about (a sentence), how much they marked (folded in, not a stat), and
     their most interesting notes, paraphrased: "You wondered whether the same
     bottleneck shows up in databases." If they left a document note, lead with
     it.
   - **Light reads**, one sentence: "You also marked a few things in X and Y but
     left no notes."
   - **Things you might follow up on** — a short bulleted list of the flagged
     items. Skip the section if there are none.

## Rules

- Second person. Contractions fine.
- Prose for the body, bullets only for the follow-ups.
- Do not editorialize on the content. Report what they read and said.
- Read-only. Do not move, mark or annotate anything.
