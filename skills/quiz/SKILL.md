---
name: quiz
description: Quiz the reader on something they read, one question at a time, graded like a colleague who also read it
---

# Quiz

Test understanding and retention. One question at a time, graded honestly, so the
reader finds the gaps while the piece is still warm.

## Access

Use the Curio MCP tools (`mcp__curio__*`) or the CLI. See `curio-mcp`.

## Setup

1. **Persona.** Read `reader_persona.md` if it exists; use it to frame questions
   around the reader's world. Without it, questions are more generic — say so
   once and continue.

2. **Welcome:**

   > **Quiz** · Curio
   >
   > I'll pick something you've read and quiz you on it — one question at a time,
   > graded like a colleague who also read the piece.
   >
   > Name a piece if you want a specific one.

3. **Pick the document.**
   - Named by the reader: `search_library` for it, then `get_document`.
   - Unnamed: `list_library` with `readState="read"`, `limit=10`. If the first ten
     are all short items, try `readState="reading"` for anything part-read.
     Present 3–5 candidates as a table and let them choose, or confirm the clear
     best pick.

4. **Read it.** `read_passage` over the document — the opening, then the middle
   and end if it is long. Note the argument, the key claims, the structure.
   Also `search_annotations` with the title or a key phrase to find what they
   highlighted: that is what they already engaged with.

## The quiz

Ask **one question at a time**. Wait for the answer before the next.

### Opening

> **Quiz: [Title]** by [Author]
> [kind] · [reading time]
>
> [1–2 sentences on what it argues.]
>
> [3–5] questions. Ready?

### Question types

Mix them to fit the piece:

- **Core argument** — did they get the point?
- **Application** — "How would you apply this to [their work]?" (use the persona)
- **Tradeoff** — "What does this cost, and who pays?"
- **The gap** — "What did the author hand-wave?"
- **Synthesis** — "How does this connect to [something else they read]?"
- **Recall** — a specific fact or number the piece turned on.

Count: under 2,000 words → 3 questions; 2,000–5,000 → 4; over 5,000, or a book →
5, weighted toward what they highlighted.

### Grading

After each answer:

1. **Grade: B+** — state it plainly.
2. What they got right, specifically.
3. What they missed or could go deeper on.
4. Quote the piece when it sharpens the point, with its line span.
5. Next question.

Scale: **A** nailed it with application; **A−** right, one nuance missing; **B+**
right direction, surface-level; **B** partial, key insight missed; **B−** vague;
**C** missed the point but tried.

### Final

1. **Final score.**
2. One line on what they understood well.
3. **One thing to remember** — the single insight worth keeping.
4. Offer another quiz, or to archive the piece if it is still unread.

## Rules

- One question at a time. Never show the answer before they try.
- Grade like a colleague: direct, specific, no flattery, no cruelty.
- Quote the text to back a grade, not to fill space.
- If they do not know, give the answer with its citation and move on — recall,
  then correction, is what makes it stick.
