# Curio — AGENT.md

Same conventions as `souravinsights.com`.

- Write for a human: fewest words that carry the meaning. No superlatives. Cold truth.
- Use mermaid for systems. Examples over prose.
- No over-engineering. Every abstraction is justified by a requirement that exists now.
- Code and spec never disagree: when the build deviates from a spec, say so in chat and update the spec in the same change.
- `bun run typecheck` + `bun run lint` is the check for a logic change. Build when a change touches routes, config, schema or emitted output.

Layout: `src/kb` (knowledge base pipeline), `src/agent` (the in-app agent),
`src/harness` (MCP + CLI), `src/imports` (source adapters), `src/server` (HTTP),
`src/db` (schema + client). `ARCHITECTURE.md` is the map; `docs/` is the detail.
