/**
 * The model + tracing seam.
 *
 * Every file that talks to a model imports from here, not from `"ai"`. Today it
 * is a pass-through. Neatlogs (or any tracer) slots in later by wrapping these
 * once — the site's `lib/observability/neatlogs.ts` is the shape to copy — and
 * no caller changes.
 */
export {
  generateText,
  generateObject,
  streamText,
  embed,
  embedMany,
  stepCountIs,
  tool,
  convertToModelMessages,
  Output,
  type UIMessage,
  type LanguageModel,
} from "ai";

/** Flush buffered traces. A no-op until a tracer is wired. */
export async function flushTraces(): Promise<void> {}
