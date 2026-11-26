import { and, asc, cosineDistance, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { documents, passages } from "@/db/schema.ts";
import { embedOne } from "./embed.ts";

/**
 * search — retrieval over a document's passages.
 *
 * Ported from souravinsights.com (`src/lib/kb/search.ts`) and extended in the two
 * ways a reading harness needs:
 *
 * 1. **Line-level hits.** Every passage carries `startLine..endLine`, so a
 *    citation points at a span, not just a document.
 *
 * 2. **Hybrid retrieval.** Vectors alone miss a rare proper noun or a phrase you
 *    half-remember; the site's own explainer names the gap ("BM25 keyword search
 *    fused with vectors … not used"). Races now run over vectors (all passages,
 *    and summaries alone for a fair per-document comparison) and over full-text
 *    (passages, and whole-document markdown so even a summary-mode document is
 *    literally searchable). The four rankings are fused with Reciprocal Rank
 *    Fusion — no tuning, one constant.
 *
 * The flood guard is unchanged: one long document may contribute at most three
 * passages per race, so it cannot crowd out everything else.
 */

const CANDIDATE_PASSAGES = 200;
const MAX_PASSAGES_PER_DOC = 3;
const SUMMARY_CANDIDATES = 120;
const RRF_K = 60;

const DEFAULT_LIMIT = 8;
const DEFAULT_PASSAGES_PER_DOC = 3;

export interface SearchPassage {
  content: string;
  startLine: number;
  endLine: number;
  unitType: string;
  heading: string | null;
}

export interface SearchHit {
  documentId: number;
  externalId: string;
  url: string | null;
  title: string;
  kind: string;
  category: string | null;
  /** RRF score — higher is more relevant. Comparable within one result set only. */
  score: number;
  passages: SearchPassage[];
}

export type SearchMode = "hybrid" | "semantic" | "exact";

export interface SearchOptions {
  libraryId?: number;
  kind?: string;
  category?: string;
  limit?: number;
  passagesPerDoc?: number;
  /** Scope to one document (the reader's per-article ask). */
  documentId?: number;
  mode?: SearchMode;
}

interface Row {
  documentId: number;
  externalId: string;
  url: string | null;
  title: string;
  kind: string;
  category: string | null;
  content: string;
  startLine: number;
  endLine: number;
  unitType: string;
  heading: string | null;
}

interface DocumentRow {
  documentId: number;
  externalId: string;
  url: string | null;
  title: string;
  kind: string;
  category: string | null;
  snippet: string;
}

const meta = {
  documentId: documents.id,
  externalId: documents.externalId,
  url: documents.url,
  title: documents.title,
  kind: documents.kind,
  category: documents.category,
};

const passageCols = {
  content: passages.content,
  startLine: passages.startLine,
  endLine: passages.endLine,
  unitType: passages.unitType,
  heading: passages.heading,
};

export async function search(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const perDoc = opts.passagesPerDoc ?? DEFAULT_PASSAGES_PER_DOC;
  const mode = opts.mode ?? "hybrid";

  const queryVector = mode === "exact" ? null : await embedOne(query);

  const conditions = [isNull(documents.hiddenAt), isNull(documents.archivedAt)];
  if (opts.libraryId) conditions.push(eq(documents.libraryId, opts.libraryId));
  if (opts.kind) conditions.push(eq(documents.kind, opts.kind));
  if (opts.category) conditions.push(eq(documents.category, opts.category));
  if (opts.documentId) conditions.push(eq(documents.id, opts.documentId));
  // Dead-link exclusion is a web concern; imported documents have no health.
  conditions.push(ne(documents.readStatus, "failed"));

  const distance = queryVector
    ? sql<number>`${cosineDistance(passages.embedding, queryVector)}`
    : null;
  const tsq = sql`websearch_to_tsquery('english', ${query})`;
  const tsMatch = sql`to_tsvector('english', ${passages.content}) @@ ${tsq}`;
  const tsRank = sql<number>`ts_rank_cd(to_tsvector('english', ${passages.content}), ${tsq})`;

  const semanticRace = (onlySummaries: boolean, take: number): Promise<Row[]> => {
    if (!distance) return Promise.resolve([]);
    return db
      .select({ ...meta, ...passageCols, distance })
      .from(passages)
      .innerJoin(documents, eq(documents.id, passages.documentId))
      .where(
        and(...conditions, ...(onlySummaries ? [eq(passages.unitType, "summary")] : [])),
      )
      .orderBy(asc(distance))
      .limit(take) as unknown as Promise<Row[]>;
  };

  const ftsRace = (): Promise<Row[]> =>
    db
      .select({ ...meta, ...passageCols, rank: tsRank })
      .from(passages)
      .innerJoin(documents, eq(documents.id, passages.documentId))
      .where(and(...conditions, tsMatch))
      .orderBy(desc(tsRank))
      .limit(CANDIDATE_PASSAGES) as unknown as Promise<Row[]>;

  const docFtsRace = (): Promise<DocumentRow[]> => {
    const docTsq = sql`websearch_to_tsquery('english', ${query})`;
    const docMatch = sql`to_tsvector('english', ${documents.markdown}) @@ ${docTsq}`;
    // Default highlight tags are stripped below; empty StartSel/StopSel is
    // rejected by Postgres as an invalid parameter list.
    const snippet = sql<string>`ts_headline('english', ${documents.markdown}, ${docTsq}, 'MaxWords=40, MinWords=15')`;
    return db
      .select({ ...meta, snippet })
      .from(documents)
      .where(and(...conditions, docMatch))
      .orderBy(
        desc(sql`ts_rank_cd(to_tsvector('english', ${documents.markdown}), ${docTsq})`),
      )
      .limit(60) as unknown as Promise<DocumentRow[]>;
  };

  const wantSemantic = mode !== "exact";
  const wantFts = mode !== "semantic";

  const [allPassages, summaryPassages, passageFts, docFts] = await Promise.all([
    wantSemantic ? semanticRace(false, CANDIDATE_PASSAGES) : Promise.resolve<Row[]>([]),
    wantSemantic ? semanticRace(true, SUMMARY_CANDIDATES) : Promise.resolve<Row[]>([]),
    wantFts ? ftsRace() : Promise.resolve<Row[]>([]),
    wantFts ? docFtsRace() : Promise.resolve<DocumentRow[]>([]),
  ]);

  // ── fuse ────────────────────────────────────────────────────────────────────
  const scores = new Map<number, number>();
  const hits = new Map<number, SearchHit>();
  const passagePool = new Map<number, Map<string, SearchPassage>>();

  const ensure = (row: Omit<Row, "content" | "startLine" | "endLine" | "unitType" | "heading">) => {
    let hit = hits.get(row.documentId);
    if (!hit) {
      hit = {
        documentId: row.documentId,
        externalId: row.externalId,
        url: row.url,
        title: row.title || row.url || row.externalId,
        kind: row.kind,
        category: row.category,
        score: 0,
        passages: [],
      };
      hits.set(row.documentId, hit);
      passagePool.set(row.documentId, new Map());
    }
    return hit;
  };

  const addPassage = (documentId: number, p: SearchPassage) => {
    const pool = passagePool.get(documentId)!;
    const key = `${p.startLine}:${p.endLine}:${p.content.slice(0, 40)}`;
    if (!pool.has(key)) pool.set(key, p);
  };

  /** Add one ranked list to the RRF score. Flood guard applies per list. */
  const fuseRows = (rows: Row[]) => {
    const seen = new Set<number>();
    const perDocCount = new Map<number, number>();
    let rank = 0;
    for (const row of rows) {
      const used = perDocCount.get(row.documentId) ?? 0;
      if (used >= MAX_PASSAGES_PER_DOC) continue;
      perDocCount.set(row.documentId, used + 1);
      ensure(row);
      addPassage(row.documentId, {
        content: row.content,
        startLine: row.startLine,
        endLine: row.endLine,
        unitType: row.unitType,
        heading: row.heading,
      });
      if (!seen.has(row.documentId)) {
        seen.add(row.documentId);
        scores.set(row.documentId, (scores.get(row.documentId) ?? 0) + 1 / (RRF_K + rank + 1));
        rank++;
      }
    }
  };

  fuseRows(allPassages);
  fuseRows(summaryPassages);
  fuseRows(passageFts);

  // Whole-document FTS: a summary-mode document, or a literal phrase, ranks here
  // with no line anchor (line 0 means "the document, not a span").
  const seenDocs = new Set<number>();
  let docRank = 0;
  for (const row of docFts) {
    ensure(row);
    addPassage(row.documentId, {
      content: (row.snippet ?? "").replace(/<\/?b>/g, ""),
      startLine: 0,
      endLine: 0,
      unitType: "summary",
      heading: null,
    });
    if (!seenDocs.has(row.documentId)) {
      seenDocs.add(row.documentId);
      scores.set(row.documentId, (scores.get(row.documentId) ?? 0) + 1 / (RRF_K + docRank + 1));
      docRank++;
    }
  }

  const ranked = Array.from(hits.values())
    .map((hit) => {
      const pool = passagePool.get(hit.documentId)!;
      const passages = Array.from(pool.values())
        .sort((a, b) => (a.startLine || Number.MAX_SAFE_INTEGER) - (b.startLine || Number.MAX_SAFE_INTEGER))
        .slice(0, perDoc);
      return { ...hit, score: scores.get(hit.documentId) ?? 0, passages };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked;
}
