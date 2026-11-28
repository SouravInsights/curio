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
| `search_annotations` | read | one document's marks, or by text, or the newest |
| `get_document` | read | metadata, summary, topics |
| `list_topics` | read | topics with counts |
| `get_persona` | read | the reader's profile |
| `save_annotation` | write | save a highlight or note onto a span |
| `connect` | write | record that two documents agree / contradict / extend |
| `set_read_state` | write | mark a document unread / reading / read / archived |
| `save_document` | write | add a URL and read it |
| `save_note` | write | write a note into the library as a document |
| `save_persona` | write | replace the reader's profile |

Every read returns citations as `{ documentId, startLine, endLine }`. A client
that renders them can jump the reader to the exact line.

## Reading skills

A skill is a playbook for a kind of request, authored as
`skills/<name>/SKILL.md` with YAML frontmatter — the portable agent-skills
format. The in-app agent loads one with `use_skill`; an MCP client sees each as
a prompt (`skill_triage`, …); a CLI verb runs one.

| Skill | What it does |
| :--- | :--- |
| `build-persona` | read the library, write the reader's profile the others use |
| `triage` | walk the unread pile one at a time |
| `quiz` | graded recall, one question at a time |
| `brief` | the argument of one piece, with citations |
| `connect` | place a piece against the library; record the edges |
| `book-review` | a long-form review synthesized with the wider library |
| `reader-recap` · `surprise-me` | recent reading, and its patterns |
| `curio-mcp` · `curio-cli` | the tool surface, for any agent |

```bash
curio skills            # list them
curio skill triage      # print one playbook
curio ask "clear my pile" --skill triage
```

### Install them into another agent

The directory is plain markdown, so it drops into any harness that speaks skills
(pi, Claude Code, Codex, Cursor). The repo carries the plugin manifest:

- `.claude-plugin/` — the marketplace and plugin definitions, skills at `skills/`.
- `.mcp.json` — the Curio MCP server, so the client that installs the skills can
  also call the tools.

```bash
npx skills add SouravInsights/curio        # any agent, via the skills CLI
```

Or copy `skills/` into the agent's skills path. The `curio-mcp` skill teaches the
client the tool surface; the rest teach the reading.

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
mounts the same tools over HTTP at `POST /mcp`. Auth is a better-auth bearer
token — an MCP client never holds a session cookie.

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
