---
name: reader-recap
description: A conversational briefing on recent reading — what you finished, highlighted, and had to say about it
---

# Reader Recap

Catch the reader up on their own reading, like a well-read assistant over coffee.
Warm, specific, short. Not a data dump.

## Access

Curio's tools are `search_library`, `read_passage`, `list_library`,
`search_annotations`, `get_document`, `list_topics`, `save_annotation`,
`save_document`, `save_note`, `connect`, `set_read_state`, `get_persona`,
`save_persona`. In the app they are named plainly; over MCP they are prefixed
`mcp__curio__`. From a shell, the `curio` CLI covers `search`, `ask` and
`import`. The `curio-mcp` skill has the full reference.

## Setup

1. **The reader's profile.** It is already in your instructions when one exists.
   Use it to add context — "this connects to your interest in X". Without it, the
   recap works fine.

2. **Gather, in parallel:**
   - `search_annotations` for recent marks. With no `query` and no `documentId`,
     it returns the newest first.
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

## The briefing

1. **One opening line** on the period. "A heavy week — ten articles and a book,
   mostly history and tooling."
2. **One short paragraph per annotated piece**, ordered by engagement. What it
   was about (a sentence), how much they marked (folded in, not a stat line), and
   their most interesting notes, paraphrased. If they left a document note, lead
   with it.
3. **Light reads**, one sentence: "You also marked a few things in X and Y but
   left no notes."
4. **Things you might follow up on** — a short bulleted list of the flagged
   items. Skip the section if there are none.

### Example

```
Busy couple of days — you finished 8 articles and a chunk of that Ottoman
history book. Most of your attention went to the logistics stuff.

You were really into Sarah Chen's piece on supply chain resilience. 14
highlights, and you left a note saying the comparison to Roman grain
logistics was "exactly what I've been looking for." You also flagged a
question — whether the same bottleneck pattern shows up in databases.

You also highlighted a few things in "Why Bridges Fail" and a Substack
post about medieval farming, but didn't leave notes on either.

**Things you might want to follow up on:**
- Does the supply-chain bottleneck pattern apply to databases?
- Verify the Ottoman succession-rate claim
```

## Handling responses

- **"go deeper on N"** — read that piece's passages and expand the paragraph.
- **"what did I say about X"** — `search_annotations` with `query="X"`.
- **"nothing else"** — end with a one-line summary of the period.

## Notes

- This skill is **read-only**. It does not move, mark or annotate anything.
- Second person. Contractions fine. Prose for the body, bullets only for the
  follow-ups.
- Do not editorialize on the content. Report what they read and said.
- Curio's history is by read state, not a precise timestamp. "Recent" means
  recently added or recently finished, not a strict window.
