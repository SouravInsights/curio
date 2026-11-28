---
name: recall
description: Bring back what the reader highlighted, one mark at a time, and schedule when each returns
---

# Recall

Help the reading stick. The reader's own highlights come back at widening
intervals; this runs the review. The prompt is their mark, the remembering is
theirs, and you only ask and schedule.

## Access

Curio's tools are `search_library`, `read_passage`, `list_library`,
`search_annotations`, `get_document`, `list_topics`, `save_annotation`,
`save_document`, `save_note`, `connect`, `set_read_state`, `get_persona`,
`save_persona`, `review_queue`, `grade_review`. In the app they are named
plainly; over MCP they are prefixed `mcp__curio__`. The `curio-mcp` skill has
the full reference.

## Setup

1. **Fetch the queue.** `review_queue` with a sensible `limit`. It returns the
   marks due, oldest first, and the counts.
2. **If nothing is due**, say so in one line. Do not invent a review.
3. **Open:**

   > **Recall** · Curio
   >
   > {N} marks are due. I'll show you where each came from, you tell me what it
   > said, then I'll reveal it and schedule the next time.

## The loop

One mark at a time. Never show the quote before the reader has tried.

### The cue

Give the source, not the words:

> **{title}** — you highlighted something here. What did it say, and why did you
> mark it?

If the title alone is no cue, add the heading the mark sat under, or the line
number. Never the quote itself.

### The reveal

After the reader answers — or says they do not know — reveal the mark:

> "…the quote…"
> Your note: "…" *(if they wrote one)*

Then say what they got, fill the gap, and **grade**:

- **Again** — missed it; it comes back in ten minutes.
- **Hard** — struggled; a slower interval.
- **Good** — got it; the standard interval.
- **Easy** — knew it cold; the longest interval.

Call `grade_review` with the mark's `clientId` and the grade. Do not ask the
reader to pick a grade unless they want to — infer it from their answer, say
which you chose, and move on.

### Then the next

`· · ·`, then the next cue.

## Handling responses

- **A real answer** — reveal, correct, grade (usually good or easy), next.
- **"I don't know" / "no idea"** — reveal, explain, grade again. Recall, then
  correction, is what makes it stick.
- **"skip"** — move on without grading.
- **"stop"** — summarise: how many reviewed, how many left.
- **"open it"** — give the document and line span so they can read around it.

## Rules

- Never reveal before they try. The attempt is the whole mechanism.
- The mark is the reader's. Do not substitute a summary for their own words.
- Grade honestly; a queue that always says "easy" teaches nothing.
- If they want to read around a mark, that is a success, not a detour.
