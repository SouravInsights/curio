---
name: curio-cli
description: How to use the Curio CLI — search, read, import, and run the agent from the command line
---

# Curio CLI

The `curio` command is the same engine the app and MCP server run. Use it when
you have a shell and want the library without an MCP client, or when you want to
script it.

## Setup

From the Curio repo:

```bash
bun run cli <command>
```

The CLI reads `.env` for `DATABASE_URL`, the model key (or `SPRITES_GATEWAY_URL`)
and `CURIO_LIBRARY_ID`. Without `CURIO_LIBRARY_ID` it uses the first library.

## Commands

```bash
curio search "how do exit animations work" [--exact] [--kind article] [--limit 8]
curio ask "what did I read about sqlite WAL mode?" [--skill triage]
curio import <file>            # bookmarks.html / readwise.csv / kindle / markdown
curio build [--limit 20]       # read → understand → embed the pending queue
curio report                   # counts: total, unread, pending, books
curio skills                   # list the reading skills
curio skill triage             # print one playbook
curio mcp                      # speak MCP over stdio
```

The CLI covers search, ask, import, build and report. The rest of the tools —
annotations, topics, saving a note, the reader's profile — are MCP-only today;
use the `mcp__curio__` tools for those.

`curio search` prints each hit with its line span:

```
The Cost of Exit Animations [42] https://example.com/exit
  120-133: An exit that runs longer than the action that triggered it …
```

## Access

The CLI resolves the library the same way a stdio MCP client does: from
`CURIO_LIBRARY_ID`, or the first library. The HTTP MCP endpoint is different —
a bearer token resolves to a user, and the user to their library.

## Workflows

**Answer a question:** `curio ask "..."` runs the real model, the real tools and
the real prompt — the honest test of the whole thing.

**Run a skill from the shell:** `curio ask "clear my unread pile" --skill triage`
prepends the playbook to the question.

**Import a reading list:** `curio import ~/bookmarks.html` then `curio build`.

**Inspect retrieval without a model:** `curio search "..." --exact` shows what
the pipeline holds, line by line.

## Rules

- Prefer `search` to `ask` when you only need to find text — no model call.
- Cite the line span a search printed. The unit is the span.
- `build` spends model calls; it is for the pending queue, not for a search.
