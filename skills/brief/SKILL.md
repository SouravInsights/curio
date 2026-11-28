---
name: brief
description: The argument of one piece, fast, with line citations — and its weakest link when asked
---

# Brief

Give the reader the argument of a piece, not a tour of it. Useful when they are
deciding whether to read something, or want to remember what it said.

## Access

Curio's tools are `search_library`, `read_passage`, `list_library`,
`search_annotations`, `get_document`, `list_topics`, `save_annotation`,
`save_document`, `save_note`, `connect`, `set_read_state`, `get_persona`,
`save_persona`. In the app they are named plainly; over MCP they are prefixed
`mcp__curio__`. From a shell, the `curio` CLI covers `search`, `ask` and
`import`. The `curio-mcp` skill has the full reference.

## Process

1. **Find the piece.** If the reader named it, `search_library` for it. If they
   are looking at one in Curio, `get_document` gives the summary and topics.
2. **Read it.** `read_passage` across the document — opening, middle, end. A
   brief built from the summary alone is a paraphrase, not a brief.
3. **Write the brief.**

   - **One sentence: the claim.** What is this piece actually arguing?
   - **Three to six claims that carry it**, one per line, in the piece's own
     order. After each, cite the span a tool returned: `(title, lines N–M)`.
   - **What it assumes, and who it is for** — only if the text shows it.
   - **The line worth remembering**, quoted exactly, with its span.

If the piece has no argument — a report, a list, a story — say what it is instead
and brief that.

## Testing the argument

When the reader asks whether the piece holds up — "steelman it", "is this
right?", "what's wrong with it?" — read it at its best, then test it:

1. **Separate claim from evidence.** What is asserted, and what is shown?
2. **State the strongest version** — the one a fair opponent would make, even if
   the author did not.
3. **Name the load-bearing assumption.** Which one, if false, takes the whole
   thing down?
4. **Name the weakest link and the strongest**, citing the lines for both.
5. **Verdict.** Does it hold? Say so plainly. A test that finds every argument
   equally flawed is not reading, it is a tic.

No strawman. Quote the author's actual words, not a convenient version. And
distinguish "wrong" from "unsupported" — most weak arguments are the second.

## Rules

- Skip the throat-clearing. Start at the claim.
- Every claim gets a span. If you cannot cite it, you cannot claim it.
- Quote the piece's own words when they are sharper than a paraphrase.
- Short is not the goal. Complete is. Cut only what the piece does not say.
