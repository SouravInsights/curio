# The harness

The same library the app reads, exposed so **your other agents** — pi, Codex,
Claude Code, Cursor — can read it and write to it mid-task. One set of tools,
two transports: MCP and a CLI. Both call `agent/actions.ts`, the same code the
in-app agent calls, so there is one retrieval path.

## Tools

| Tool | Reads/writes | What it does |
| :--- | :--- | :--- |
| `search_library` | read | hybrid / semantic / exact search; returns line spans |
| `read_passage` | read | open an exact line span |
| `list_library` | read | recent reading, by kind or state |
| `search_annotations` | read | your highlights and notes |
| `get_document` | read | metadata, summary, topics |
| `save_annotation` | write | save a highlight or note onto a span |
| `connect` | write | record that two documents agree / contradict / extend |

Every read returns citations as `{ documentId, startLine, endLine }`. A client
that renders them can jump the reader to the exact line.

## MCP — local (stdio)

For a client that runs on the same machine as the library:

```bash
bun run mcp          # or: bun run cli mcp
```

Point a client at it. For Claude Code, `~/.claude.json`:

```json
{
  "mcpServers": {
    "curio": { "command": "bun", "args": ["run", "mcp"], "cwd": "/path/to/curio" }
  }
}
```

pi, Codex and Cursor take the same `command`/`args` shape.

## MCP — remote (HTTP)

For a client that runs elsewhere (an agent on a Sprite, a cloud IDE), the server
mounts the same tools over HTTP. Auth is a better-auth bearer token — an MCP
client never holds a session cookie.

> Status: the stdio server ships now; the HTTP mount lands with the server slice.
> The tools, scope resolution and auth are already in place for it.

## CLI

Every command is scriptable and runs the exact code the app runs.

```bash
curio mcp                       # speak MCP over stdio
curio build [--limit 20]        # read → understand → embed the pending queue
curio search "how do exit animations work" [--exact]
curio ask "what did I read about sqlite WAL mode?"
curio import ~/bookmarks.html   # bookmarks / readwise csv / kindle / markdown
curio report                    # state of the library
```

`curio ask` is the honest test of the whole thing: one question through the real
model, the real tools and the real prompt.

## Auth

The harness never invents its own auth. A CLI or stdio MCP run reads
`CURIO_LIBRARY_ID` (or falls back to the first library). A remote MCP call
carries a bearer token that better-auth verifies, resolving token → user →
library. The library's owner is decided server-side; no client passes an id it
chose.

## The scope model

`Scope = { libraryId }`. Every action takes it. That is the seam that lets the
same tool run for one user in the app and a different user over HTTP without any
query learning about users.
