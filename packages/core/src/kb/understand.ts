import { z } from "zod";
import { generateText, Output, type LanguageModel } from "@curio/core/observability";
import { pipelineModel } from "./model";
import { cleanTopics } from "./topics";
import { PROMPT_VERSION, DESCRIBE_INSTRUCTION, describePrompt } from "./prompts";

/**
 * understand — one model call, one job:
 *
 *   describe  squeeze the document → summary in the page's voice + its topics
 *
 * There is no classifier. A reading library's shape is the **kind** (article,
 * book, newsletter, PDF, note) the reader filed it under, and its subjects are
 * the **topics**. A content-genre category added a second taxonomy that fought
 * the first, so it is gone.
 *
 * Evidence is bounded on purpose: describe gets a word-capped body.
 */

export { PROMPT_VERSION };

const MAX_DESCRIBE_WORDS = 6000;

const describeSchema = z.object({
  summary: z.string(),
  // No .max() here: the policy caps. A hard cap turns a chatty model into a
  // whole-batch error class.
  topics: z.array(z.string()),
});

export interface UnderstandInput {
  url: string;
  title: string;
  description: string;
  site: string;
  author: string;
  published: string;
  markdown: string;
  knownTopics: string[];
  winningSpellings?: Record<string, string>;
}

export interface UnderstandResult {
  topics: string[];
  summary: string;
}

const cap = (markdown: string) =>
  markdown.split(/\s+/).filter(Boolean).slice(0, MAX_DESCRIBE_WORDS).join(" ");

/** describe — summary + topics in one call, on the largest view of the page. */
export async function describePage(
  model: LanguageModel,
  input: Omit<UnderstandInput, "site">,
) {
  const { output } = await generateText({
    model,
    abortSignal: AbortSignal.timeout(120_000),
    output: Output.object({ schema: describeSchema }),
    prompt: describePrompt({
      url: input.url,
      title: input.title,
      author: input.author,
      published: input.published,
      instruction: DESCRIBE_INSTRUCTION,
      markdown: cap(input.markdown),
      knownTopics: input.knownTopics,
    }),
  });
  if (!output) throw new Error("describe produced no structured output");
  return {
    summary: output.summary.trim(),
    topics: cleanTopics(output.topics, input.winningSpellings ?? {}),
  };
}

export async function understandPage(input: UnderstandInput): Promise<UnderstandResult> {
  const { summary, topics } = await describePage(pipelineModel(), input);
  return { topics, summary };
}
