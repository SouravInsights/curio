---
name: connect
description: Place a piece against the rest of the library — what it agrees with, contradicts, extends — and record the edges
---

# Connect

Find where a piece lands in what the reader has already read. This is the skill
that turns a pile of saved articles into a body of thought.

## Access

Use the Curio MCP tools (`mcp__curio__*`) or the CLI. See `curio-mcp`.

## Process

1. **Find the piece.** `search_library` for it, or `get_document` if it is the one
   open in Curio. `read_passage` its central claims.

2. **Search per claim.** Search the library for the piece's central claim, then
   once per major sub-claim. Do not stop at the first search — the connections
   are rarely in the top result for the obvious query.

3. **Read both sides.** For each candidate, `read_passage` both spans before you
   judge them. A connection between two titles is a guess; a connection between
   two spans is a claim.

4. **Classify the edges.** For each real one:

   - **agrees** — same conclusion, independent support
   - **contradicts** — the two cannot both be true
   - **extends** — one pushes the other further
   - **references** — one names or builds on the other

   Quote both sides and cite both spans.

5. **Record them.** `connect(fromDocumentId, toDocumentId, kind, note)` for each
   edge, with the note carrying the quote and the line spans.

6. **Say where the library is silent.** "Nothing here on X" is a useful answer. A
   gap tells the reader what to look for next.

## Rules

- Read both spans before connecting. Never connect on a title alone.
- Prefer three real edges to ten plausible ones.
- A contradiction is the most valuable edge — surface it even when the reader
  would rather it not be there.
- Do not connect two pieces that merely share a topic. They must make a claim
  about the same thing.
