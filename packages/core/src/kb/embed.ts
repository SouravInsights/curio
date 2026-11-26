import { embedMany } from "@curio/core/observability";
import { embeddingModel } from "./model";
import type { Category } from "./categories";

/**
 * Turn text into vectors via OpenRouter's embeddings endpoint.
 *
 * Two practical concerns this wraps: providers cap how many inputs fit in one
 * request, so inputs go in bounded batches; embeddings occasionally 429/5xx, so
 * we retry with backoff. The whole build is idempotent — a hard failure just
 * means "run it again".
 *
 * Ported from souravinsights.com (`src/lib/kb/embed.ts`).
 */

const BATCH_SIZE = 100;
const MAX_RETRIES = 4;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function embedBatch(values: string[]): Promise<number[][]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { embeddings } = await embedMany({
        model: embeddingModel(),
        values,
        abortSignal: AbortSignal.timeout(60_000),
      });
      return embeddings;
    } catch (error) {
      lastError = error;
      await sleep(2 ** attempt * 500 + Math.floor(Math.random() * 250));
    }
  }

  throw lastError;
}

/** Embed many values, in bounded batches. Order matches the input. */
export async function embedTexts(values: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    out.push(...(await embedBatch(values.slice(i, i + BATCH_SIZE))));
  }
  return out;
}

/** Embed a single value — used at query time to embed the question. */
export async function embedOne(value: string): Promise<number[]> {
  const [vector] = await embedTexts([value]);
  return vector!;
}

/**
 * How much of a document becomes vectors, by category. `full` chunks the whole
 * markdown; `summary` keeps only the model-written summary passage. Every
 * document still gets exactly one summary vector, so every document is
 * answerable, chunked or not.
 */
export type EmbeddingMode = "full" | "summary";

export const EMBEDDING_MODE: Record<Category, EmbeddingMode> = {
  article: "full",
  tool: "full",
  other: "full",
  learning: "summary",
  people: "summary",
  publication: "summary",
  inspiration: "summary",
  directory: "summary",
};

/**
 * Books, PDFs and newsletters are documents you read end to end — their whole
 * text deserves vectors regardless of how the page classifier read the landing
 * page. `kind` overrides the category map for these.
 */
export function embeddingModeFor(kind: string, category: Category | null): EmbeddingMode {
  if (kind === "book" || kind === "pdf" || kind === "newsletter") return "full";
  return category ? EMBEDDING_MODE[category] : "summary";
}
