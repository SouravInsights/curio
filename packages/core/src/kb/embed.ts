import { embedMany } from "@curio/core/observability";
import { embeddingModel } from "./model";

/**
 * Turn text into vectors via OpenRouter's embeddings endpoint.
 *
 * Two practical concerns this wraps: providers cap how many inputs fit in one
 * request, so inputs go in bounded batches; embeddings occasionally 429/5xx, so
 * we retry with backoff. The whole build is idempotent — a hard failure just
 * means "run it again".
 *
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
 * How much of a document becomes vectors. `full` chunks the whole markdown;
 * `summary` keeps only the model-written summary passage. Every document still
 * gets exactly one summary vector, so every document is answerable, chunked or
 * not.
 *
 * The decision is the reading **kind**, not a content genre: the things you read
 * end to end — articles, books, PDFs, newsletters, your own notes — deserve their
 * whole text; anything else keeps its summary.
 */
export type EmbeddingMode = "full" | "summary";

const FULL_KINDS = new Set(["article", "book", "pdf", "newsletter", "note"]);

export function embeddingModeFor(kind: string): EmbeddingMode {
  return FULL_KINDS.has(kind) ? "full" : "summary";
}
