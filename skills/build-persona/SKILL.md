---
name: build-persona
description: Build a personalized reading profile from a Curio library, written to reader_persona.md and read by the other skills
---

# Build Persona

Build a `reader_persona.md` from the user's Curio library. Other skills — triage,
quiz, connect — read that file to personalize their pitches, questions and
grading. Without it, they still work; they just know less about the reader.

## Access

Use the Curio MCP tools (`mcp__curio__*`) or the CLI. Read the `curio-mcp` or
`curio-cli` skill if you have not.

## Welcome

> **Build Persona** · Curio
>
> I'll read your library — what you save, what you finish, what you highlight —
> and write a `reader_persona.md` in the current directory. Triage, quiz and the
> rest will use it to fit you.
>
> Quick pass first (~1–2 min). You can ask for a deeper one after.

## Process

If you can launch a subagent (Claude Code, pi, Codex), do the gathering there and
keep this conversation clean. If you cannot, do it inline.

### Phase 1 — Quick pass

Gather in one parallel batch:

- **The shelves.** `list_library` once per state — `readState="read"`,
  `"reading"`, `"unread"`, `"archived"` — with `limit=50`. These show what they
  finish, what they start, what they hoard, and what they drop.
- **The marks.** `search_annotations` with four broad queries that between them
  cover most reading — e.g. `"ideas strategy"`, `"learning craft"`,
  `"business growth"`, `"technology culture"` — `limit=50` each. Highlights and
  notes are the highest-signal thing in the library: they are what the reader
  chose to keep.
- **The shape.** From the shelf rows, note `kind`, `category`, `topics`,
  `wordCount`, `site`, `author`, `addedAt`.

Read the results for patterns, not exhaustively. You are looking for: what they
read about, how much, how long, what they finish versus abandon, what they write
in the margins.

### Phase 2 — Write the file

Write `reader_persona.md` to the current working directory. Keep it short enough
to be read at the top of every session — a page, not a report. Sections:

- **Identity & role** — who they appear to be, from what they read.
- **Core interests** — the themes that recur, ranked by frequency and recency.
- **Reading personality** — how they read: do they finish, or hoard? Long-form or
  links? Highlight heavily or sparsely? Write notes, or just mark?
- **Current obsessions** — what dominates the last 2–3 weeks.
- **Goals & aspirations** — what the reading is in service of, inferred.
- **Taste & sensibility** — the kind of thinker and writer they return to:
  practical, contrarian, technical, literary.
- **Anti-interests** — what is conspicuously absent.
- **Triage guidance** — specific instructions for pitching to this person:
  "lead with the practical payoff", "the bar is high for AI takes — flag only
  what is genuinely new", "connect new pieces to their interest in X".

Ground every claim in something you saw. A persona that could describe anyone is
worth nothing.

### Phase 3 — Return

Tell the user the absolute path to `reader_persona.md`, give a 3–5 sentence
summary of who the persona says they are, and ask if anything is off. Edit the
file from their feedback.

Then offer the deep pass: a second run over more of the library — paginate past
the first 50 per shelf, add more annotation queries informed by phase 1 — that
rewrites the persona with sharper evidence. Skip it if the quick pass already
reads true.

## Rules

- Evidence, not flattery. "Reads a lot about startups" is not a persona.
- The notes matter more than the highlights; the highlights more than the saves.
- Never invent a detail. If a section has no evidence, leave it out.
- The persona is the reader's file. Write it plainly enough that they can edit it.
