import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { env } from "@curio/core/config";

/**
 * The one file that names our models. Every other KB file imports from here, so
 * swapping a model is a one-line change in one place.
 *
 * Two jobs, two models:
 *
 * 1. EMBEDDING_MODEL_ID — text → 1536 numbers. The count matches the
 *    `vector(1536)` column and `EMBEDDING_DIM`, so changing it means a schema
 *    change and a full re-embed.
 * 2. CHAT_MODEL_ID — writes answers. MUST support tool calling; the agent works
 *    by calling tools mid-answer. If the id changes, check `tools` is in the
 *    model's `supported_parameters` on OpenRouter.
 *
 * The client has two homes, chosen by env, not by code: a Sprite routes through
 * the OpenRouter connector's gateway (no key in the box), everything else uses a
 * direct key. One branch, two deploys.
 */

export const EMBEDDING_MODEL_ID = "openai/text-embedding-3-small";
export const CHAT_MODEL_ID = "deepseek/deepseek-v4.1-flash";
export const PIPELINE_MODEL_ID = "deepseek/deepseek-v4.1-flash";

function client() {
  if (env.SPRITES_GATEWAY_URL) {
    // The gateway attaches the stored OpenRouter credential; the key here is a
    // placeholder the provider requires but never sends.
    return createOpenRouter({ apiKey: "sprites-gateway", baseURL: env.SPRITES_GATEWAY_URL });
  }
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY (or SPRITES_GATEWAY_URL) is not set");
  }
  return createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
}

/** The embedding model, for turning text into vectors. */
export const embeddingModel = () => client().textEmbeddingModel(EMBEDDING_MODEL_ID);

/** The chat model, for the agent that writes answers. */
export const chatModel = () => client()(CHAT_MODEL_ID);

/** The pipeline model, for understand (classify + describe). */
export const pipelineModel = () => client()(PIPELINE_MODEL_ID);

/** Any chat model by id — the classify probe's bake-off dial. */
export const modelById = (id: string) => client()(id);
