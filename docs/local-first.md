# Local-first

How Curio should read and write data so the UI never waits on the network. This
is a spec, not a description of the build — the build still ships the persisted
query cache in `apps/web/src/lib/persist.ts`. The migration is at the bottom.

Two references:

- **Matter** — the object-store layout, read from its running IndexedDB
  (`docs/tmp.txt`). A per-user library DB (`items`, `annotations`, `notes`,
  `bodies`, `bodyMeta`, `outbox`, `tags`) plus a separate content DB
  (`MatterDexie`). `items` is a denormalized read model with a sort-key index per
  view; `outbox` is a durable write queue.
- **Linear** — [`how-is-linear-so-fast…`](./how-is-linear-so-fast-a-technical-breakdown.md).
  The server is a sync target, not the source of truth for the UI; mutations
  apply locally and reconcile in the background; heavy tables lazy-hydrate.

We copy the mechanism, not the product. Curio is a single-user reading app, so
none of this needs CRDTs, WebSocket deltas, or per-field observables.

## The one idea

Split the data by **who owns it**, and give each half its own store:

| Class | Examples | Owner | Local strategy |
| :--- | :--- | :--- | :--- |
| **Derived content** — heavy, server-produced, immutable | `markdown`, `passages`, summary, topics, embeddings | server pipeline | cache per document, lazy, evictable |
| **User state** — small, mutable, hand-authored | annotations, `readState`, `favorite`, collections | the client | local truth + outbox |
| **Read model** — a projection for lists and counts | library rows, counts | derived | IndexedDB indexes, built locally |

Today all three are one thing: a TanStack Query cache serialized to a single
`cache` row (`curio` DB). That is why the DevTools tree is empty and every
filter is a network round trip wrapped in optimistic paint. One owner per datum
removes the confusion and most of the code.

```mermaid
flowchart TB
    subgraph W["Web (browser)"]
        UI["React"] --> LR["local read<br/>Dexie useLiveQuery"]
        UI --> SR["server read<br/>TanStack Query (search · ask · topics)"]
        MUT["mutation"] --> LDB[("curio-&lt;uid&gt;<br/>items · annotations · outbox · meta")]
        LDB --> SYNC["sync loop"]
    end
    SYNC -->|push outbox| API["Fastify /api/v1/sync"]
    API -->|pull since cursor| SYNC
    API --> PG[("Postgres<br/>source of truth")]
    LR --> LDB
    LR --> CDB[("curio-content<br/>bodies")]
    CDB -.->|miss| API
```

## Two databases (from Matter)

Matter runs two DBs because the two halves have opposite lifecycles: the library
must never be evicted, content should be. Same split here.

### `curio-<userId>` — the library, local truth

```
items        keyPath id          readState, favorite, kind, category, addedAt,
                                 lastReadAt, tags* , topics*        (* multiEntry)
annotations  keyPath id          documentId, createdAt
collections  keyPath id
outbox       keyPath ++seq       entityType, entityId
meta         keyPath key         userId · cursor · schemaVersion
```

`items` is the denormalized row the list and every filter read: one row per
document, carrying both server fields (title, author, summary) and user fields
(`readState`, `favorite`). Every view is an index scan; counts come from
`store.count()`, not the server.

Per-user DB name (Matter's `matter-u341500`) over clear-on-sign-out: the data
literally cannot belong to the wrong identity.

### `curio-content` — derived content, cache

```
bodies       keyPath documentId   (the stored markdown)
```

Fetched lazily when a document is opened, evicted on quota pressure. A document
opened once is readable offline; one never opened falls back to the API.

## Documents are server-created; marks are client-created

This is the simplification that keeps the engine small. A document cannot be
created offline — reading the page needs the server pipeline (`get → read →
understand → embed`). Annotations can, and that is the only thing the user
authors by hand.

So `documents.id` stays a Postgres `bigint`. **Annotations and collections move
to client-generated ids** (`crypto.randomUUID()`), which is what makes an
offline create durable: the row has a stable identity before the server has ever
seen it. The server accepts the client id and stores it.

## The outbox (from Matter)

Every local mutation writes the store and appends one row. The store is the
truth; the outbox is the retry log.

```ts
interface OutboxRow {
  seq?: number;                 // autoIncrement — the local order
  id: string;                   // client uuid — the idempotency key
  entityType: "annotation" | "document" | "collection";
  entityId: string;
  op: "create" | "patch" | "delete";
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
}
```

Flush: batch (≤100) → `POST /api/v1/sync/push` → server applies idempotently by
`id` → returns applied ids and the new cursor → delete those rows. On failure,
increment `attempts` and back off; the row survives reload, which is the whole
point. Triggers: on mutation, on `online`, on a 30s interval.

Idempotency is the robustness property. A retried push must not double-create,
so the server upserts on the client id.

## The pull (simpler than Linear's)

Single user, thousands of documents — a change feed is enough; no WebSocket.

```
GET /api/v1/sync/pull?since=<cursor>
→ { cursor, changed: { items, annotations, collections }, deleted: [...] }
```

Cursor is `(updatedAt, id)`, monotonic per row. Every table needs `updatedAt`;
deletes need a tombstone (`deletedAt`) so the client learns about them — the one
schema cost of this design. A `library_events` table written by a trigger is the
robust upgrade when app-code writes get forgotten; not needed yet.

Boot is Linear's order, not the conventional one:

1. Read `items` from IndexedDB → render the library. No spinner.
2. Kick off `pull?since=cursor` in the background → apply deltas.
3. The first sync that 401s → sign out. Auth is assumed from local state and
   verified by the request that follows, never by a blocking `/me`.

## What we keep versus retire

| Keep | Retire |
| :--- | :--- |
| TanStack Query for **server-only** reads: search, topics, ask, connections | `@tanstack/react-query-persist-client` and `apps/web/src/lib/persist.ts` |
| Radix, the design system, the shell | the single serialized `cache` row |
| Postgres as source of truth | the four hand-written optimistic `onMutate`/`onError`/`onSettled` triples |

Local entities are read with Dexie's `useLiveQuery`, so a write repaints the
component without an `invalidateQueries` dance. Server-only reads stay in Query
and stay unpersisted.

## Deliberately not copied

- **CRDTs / Yjs / WebSocket deltas.** Linear needs multi-client realtime; Curio
  has one reader. `pull` on focus is enough.
- **Per-property observables.** MobX exists to re-render one cell in a 50-issue
  list. A reading list is coarse-grained; React re-render is fine.
- **MobX as the store.** Dexie is already the dependency and already the
  IndexedDB base. A second store is not justified.

## Migration

Each step ships alone.

1. **Spec** — this file. Update `ARCHITECTURE.md` to point at it.
2. **Schema** — `client_id uuid unique` + `updated_at` on annotations; `deletedAt`
   tombstones on annotations and collections. (Documents already have `updatedAt`
   and soft-delete columns.)
3. **API** — `POST /api/v1/sync/push` (batch, idempotent), `GET /api/v1/sync/pull`.
   Add to `packages/api-client`.
4. **Web store** — two Dexie DBs, the outbox, the sync loop. Convert the library
   list, counts, and annotations to `useLiveQuery`. Leave search/ask on Query.
5. **Retire** `persist.ts` and the persist providers.
6. **Offline shell** — service worker with a precache manifest and the app-shell
   CSS inlined in the document (Linear). Separate PR; not required for 1–5.

Steps 1–4 already deliver: instant cold start, offline reads of opened
documents, durable offline highlights, and local filtering.
