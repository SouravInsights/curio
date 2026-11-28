---
name: build-persona
description: Build the reader's profile from their Curio library — interests, behaviour, taste — and save it so every other skill personalizes
---

# Build Persona

Write the reader's profile: a short portrait of who they are as a reader and
thinker, built from what they save, finish and highlight. Every other skill reads
it — triage pitches to it, quiz frames questions around it, surprise-me starts
from it.

## Access

Curio's tools are `search_library`, `read_passage`, `list_library`,
`search_annotations`, `get_document`, `list_topics`, `save_annotation`,
`save_document`, `save_note`, `connect`, `set_read_state`, `get_persona`,
`save_persona`. In the app they are named plainly; over MCP they are prefixed
`mcp__curio__`. From a shell, the `curio` CLI covers `search`, `ask` and
`import`. The `curio-mcp` skill has the full reference.

The profile lives in Curio. `get_persona` reads the current one; `save_persona`
replaces it. Nothing needs to be written to disk for the in-app agent — it is
already injected into your instructions.

## Welcome

> **Build Persona** · Curio
>
> I'll read your library — what you save, what you finish, what you highlight —
> and write a profile Curio keeps. Triage, quiz and the rest will use it to fit
> you.
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
- **The shape.** `list_topics` — the topics with counts. The library's own
  summary of what it is about.
- **The marks.** `search_annotations` with four broad queries that between them
  cover most reading — e.g. `"ideas strategy"`, `"learning craft"`,
  `"business growth"`, `"technology culture"` — `limit=50` each. Highlights and
  notes are the highest-signal thing in the library: what the reader chose to
  keep.

Read for patterns, not exhaustively: what they read about, how much, how long,
what they finish versus abandon, what they write in the margins.

### Phase 2 — Write the profile

Compose the profile, then `save_persona` it. Keep it short enough to be read at
the top of every session — a page, not a report. Sections:

- **Identity & role** — who they appear to be, from what they read.
- **Core interests** — the themes that recur, ranked by frequency and recency.
- **Reading personality** — how they read: finish or hoard? Long-form or links?
  Highlight heavily or sparsely? Write notes, or just mark?
- **Current obsessions** — what dominates the last 2–3 weeks.
- **Goals & aspirations** — what the reading is in service of, inferred.
- **Taste & sensibility** — the kind of thinker and writer they return to:
  practical, contrarian, technical, literary.
- **Anti-interests** — what is conspicuously absent.
- **Triage guidance** — specific instructions for pitching to this person:
  "lead with the practical payoff", "the bar is high for AI takes — flag only
  what is genuinely new", "connect new pieces to their interest in X".

Ground every claim in something you saw. A profile that could describe anyone is
worth nothing.

### Phase 3 — Return

Show the reader the profile, give a 3–5 sentence summary of who it says they are,
and ask if anything is off. If they correct something, `save_persona` the edited
version.

Then offer the deep pass: a second run over more of the library — paginate past
the first 50 per shelf, add more annotation queries informed by phase 1 — that
rewrites the profile with sharper evidence. Skip it if the quick pass already
reads true.

## Optional: a file for other agents

An external agent may want a `reader_persona.md` in its working directory. If the
reader asks for one, write the same markdown there as well. Curio remains the
source of truth.

## Rules

- Evidence, not flattery. "Reads a lot about startups" is not a profile.
- The notes matter more than the highlights; the highlights more than the saves.
- Never invent a detail. If a section has no evidence, leave it out.
- The profile is the reader's. Write it plainly enough that they can correct it.
