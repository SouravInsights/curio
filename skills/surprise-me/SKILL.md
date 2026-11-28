---
name: surprise-me
description: Read the library's patterns and surface one thing the reader does not know about themselves
---

# Surprise Me

Analyze the reader's library and tell them one true thing about themselves they
have not noticed. Not "you read about technology" — something that makes them
pause.

## Access

Curio's tools are `search_library`, `read_passage`, `list_library`,
`search_annotations`, `get_document`, `list_topics`, `save_annotation`,
`save_document`, `save_note`, `connect`, `set_read_state`, `get_persona`,
`save_persona`. In the app they are named plainly; over MCP they are prefixed
`mcp__curio__`. From a shell, the `curio` CLI covers `search`, `ask` and
`import`. The `curio-mcp` skill has the full reference.

## Gather

Cast wide, in parallel:

- `search_annotations` with several broad queries covering the library's range,
  `limit=50` each. The marks are where the reader's attention actually went.
- `list_library` for `readState="read"`, `"unread"`, `"archived"` at `limit=50`.
  What they finish, hoard, and drop are three different signals.
- `list_topics` — the topics with counts, the library's own summary of itself.
- Note `kind`, `topics`, `author`, `site`, `wordCount`, `addedAt`.

## Look for

- **Hidden obsessions** — a topic that recurs far more than they would guess.
- **Contradictions** — saving both sides of an argument, or interests that pull
  against each other.
- **The gap between saving and reading** — do they hoard one kind and finish
  another? What do they highlight versus what they save?
- **Drift** — what they have moved toward or away from over time.
- **Blind spots** — what is conspicuously absent given the rest.
- **A thread between two unrelated interests** they have not named.

## Deliver

Present **one** insight:

> **Here's something you might not know about yourself:**
>
> [The insight — 2–3 sentences, specific and grounded in their data.]

Then the evidence: quote the highlights, name the documents and authors, show the
pattern across several data points.

Then offer:

- "Want me to dig into this further?"
- "I noticed a few other patterns too — want to hear them?"
- "Want me to find documents in your library that connect to this theme?"

## Handling responses

- **"dig deeper"** — gather more, and show the pattern over time.
- **"other patterns"** — deliver the next one, same standard.
- **"find the connections"** — run `connect` on the theme.

## Tone

- Genuinely curious and observant, like a perceptive friend who noticed something
  you did not.
- Specific — always reference real data, never generic platitudes.
- Surprising — if the insight feels obvious, dig deeper until it is not.
- One insight, not a list. A list of observations is not a surprise.
