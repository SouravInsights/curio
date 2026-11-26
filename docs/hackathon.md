# Hacksgiving plan

## The rules (read off fly.io/hacksgiving)

| Rule | Consequence |
| :--- | :--- |
| Runs **on a Sprite** | The agent process lives in a hardware-isolated Linux VM, not on Vercel. |
| Uses **≥ 1 Sprites connector** | Model calls go through the Sprites gateway (§ deployment). |
| **Built during Nov 23–29** | The harness is new code this week. |
| Submit **code + demo + description**, post tagging @flydotio | One entry. |
| Deadline **midnight PST Sun Nov 29** | ~3.5 days from Nov 26. |

Gateway calls only succeed from inside a Sprite ("not from your laptop or CI"),
which is exactly why the agent runs there.

## The conflict, named

"Runs on a Sprite" and "Fly-agnostic" pull apart. Resolved by **portable core +
thin Sprite edge**. `src/kb/` and `src/agent/` import no host and no vendor.
`deploy/sprites/` is the only Fly-aware code, and `src/kb/model.ts` picks the
gateway by env, not by a branch in logic.

## Scope: ship vs later

| Ship this week | Tables exist, behaviour later |
| :--- | :--- |
| Line-level citations (offsets → line spans → reader flash) | spaced recall over highlights |
| Hybrid retrieval (vectors + FTS + RRF) | more import sources (EPUB, PDF, email) |
| The reading tool set + MCP + CLI | remote MCP over HTTP |
| Imports: bookmarks, Readwise, Kindle, markdown | an editor; a web reader UI |
| better-auth + a library per user | OAuth providers, teams |
| Sprites deploy + OpenRouter connector | — |

## Build order

Ordered so the two things a judge can *see* land first.

| Slot | Ship | Status |
| :--- | :--- | :--- |
| **D1** | Repo, schema, ports, better-auth, the pipeline | **done** |
| **D1** | Hybrid search with line spans | **done** |
| **D2** | Deploy to a Sprite; models through the OpenRouter connector | next |
| **D2** | Reader UI: span citations open and flash | next |
| **D3** | Inbox triage + `connect` end to end; import a real reading list | next |
| **D3.5** | Demo recorded, post published, submission sent | next |

Critical path is the Sprite deploy and the reader flash. Everything else already
compiles and type-checks.

## Demo script (60–90s)

1. Ask "why do nested rounded corners look wrong?" — the answer cites exact lines.
2. Click a citation — the reader opens and the line flashes.
3. Exact search for a rare proper noun; then the same idea in different words.
4. "What connects what I read about sandboxes and long-running agents?"
5. Import a reading list → triage files it → it is searchable seconds later.

## Submission

- **Code**: this repo.
- **Demo**: 60–90s screen recording of the five beats above.
- **Description**: one or two sentences — "a reading app with an agent over
  everything you've read, with line-level citations, and an MCP harness so your
  other agents can search the same library."
- Post on X / Bluesky / LinkedIn / Reddit, tag @flydotio.
