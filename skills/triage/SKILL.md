---
name: triage
description: Walk the reader through their unread pile one document at a time, saying what each is worth and why
---

# Triage

Turn what the reader saved into what they will actually read. One document at a
time, an honest pitch, and a decision that sticks.

## Access

Curio's tools are `search_library`, `read_passage`, `list_library`,
`search_annotations`, `get_document`, `list_topics`, `save_annotation`,
`save_document`, `save_note`, `connect`, `set_read_state`, `get_persona`,
`save_persona`. In the app they are named plainly; over MCP they are prefixed
`mcp__curio__`. From a shell, the `curio` CLI covers `search`, `ask` and
`import`. The `curio-mcp` skill has the full reference — read it if a tool below
is unclear.

## Setup

1. **The reader's profile.** It is already in your instructions when one exists.
   If it is missing, say so once — "run the `build-persona` skill and triage gets
   sharper" — add `· · ·`, and continue without waiting.

2. **Fetch the pile.** `list_library` with `readState="unread"`, `limit=10`.
   Most recently added first.

3. **Open with the overview:**

   **📚 Curio · Triage**

   {N} unread. Let me take them one at a time and tell you what each is worth.

   {3–4 sentences on the batch as a whole: the themes, the mix, any clusters or
   contrasts. Personalize against the profile.}

   Let's start with the most recent.

   · · ·

## The loop

Present **one document at a time**. Never dump the pile.

### The card

Render an ASCII box in a code block. Pad every line to the same width so the
right `│` aligns.

```
┌──────────────────────────────────────────────────┐
│  {Title — wrap if needed}                         │
├──────────────────────────────────────────────────┤
│  {author} · {site} · {kind} · {reading time}      │
├──────────────────────────────────────────────────┤
│  {n} / {total}                     {relative date} │
└──────────────────────────────────────────────────┘
```

Reading time is `wordCount / 230` minutes, rounded up. Relative date from
`addedAt`: "Saved today", "yesterday", "3 days ago".

### The pitch

- **What it is** — 2–4 sentences in your own words, from the summary and topics.
  Synthesize; do not restate the summary line.
- **Why read** — a real, opinionated reason. Connect it to something else in the
  pile or something they have read. Use the profile.
- **Why skip** — an honest reason they might not need it. Be willing to say the
  library already covers it, or that it has gone stale.

If the summary is thin, `get_document` for the topics, or `read_passage` to read
the opening before you pitch. If they have already marked it, `search_annotations`
with `documentId` tells you what caught their eye.

### The options

- **Read** — I'll mark it reading; open it in Curio
- **Later** — leave it unread
- **Archive** — got the gist
- **Tell me more** — I'll read it and pitch deeper
- **Something else** — move it, mark it, or say why

*(If you read it elsewhere, tell me and I'll archive it.)*

### Transitions

After an action, `· · ·`, then the next card.

## Handling responses

- **"read" / "reading" / "open"** — `set_read_state` to `reading`, give the URL,
  next.
- **"later" / "skip for now"** — leave it unread, next.
- **"archive" / "skip" / "no"** — `set_read_state` to `archived`, next.
- **"tell me more" / "what's it about"** — `read_passage` for the opening, give a
  deeper pitch grounded in the text, re-present the options.
- **"PERSONALIZE"** — point them at the `build-persona` skill, resume when done.
- **"stop" / "done"** — summarise: how many read, kept, archived.

When the batch of ten runs out, fetch the next ten and continue seamlessly.

## Rules

- One document at a time. The whole point is a decision per piece.
- The pitch is an opinion, not a summary. The reader can read the summary.
- "Why skip" must be real. If everything is worth reading, you are not triaging.
- Do not change read state until the reader decides.
