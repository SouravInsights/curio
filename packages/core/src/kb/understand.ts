import { z } from "zod";
import { generateText, Output, type LanguageModel } from "@curio/core/observability";
import { pipelineModel } from "./model";
import { CATEGORIES, type Category } from "./categories";
import { cleanTopics } from "./topics";
import { PROMPT_VERSION, DESCRIBE_PROMPTS, classifyPrompt, describePrompt } from "./prompts";

/**
 * understand — two model calls, two jobs:
 *
 *   classify  what IS this document   → category + confidence
 *   describe  squeeze the document    → summary in the page's voice + its topics
 *
 * Evidence is bounded on purpose: classify gets the opening + heading outline +
 * counts; describe gets a word-capped body. A low-confidence answer is an
 * answer too — the document lands in `other` instead of being guessed.
 *
 */

export { PROMPT_VERSION };

const MAX_SAMPLE_WORDS = 1500;
const MAX_HEADINGS = 30;
const MAX_DESCRIBE_WORDS = 6000;

const classificationSchema = z.object({
  category: z.enum(CATEGORIES),
  confidence: z.enum(["high", "medium", "low"]),
});

const describeSchema = z.object({
  summary: z.string(),
  // No .max() here: the policy caps. A hard cap turns a chatty model into a
  // whole-batch error class.
  topics: z.array(z.string()),
});

export interface ClassifyResult {
  category: Category;
  confidence: "high" | "medium" | "low";
}

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
  category: Category;
  topics: string[];
  summary: string;
}

function sampleOf(markdown: string) {
  const words = markdown.split(/\s+/).filter(Boolean);
  const headingOutline = markdown
    .split("\n")
    .filter((line) => /^#{1,6}\s/.test(line))
    .slice(0, MAX_HEADINGS)
    .join("\n");
  const links = (markdown.match(/\]\(/g) ?? []).length;
  const images = (markdown.match(/!\[/g) ?? []).length;

  return {
    opening: words.slice(0, MAX_SAMPLE_WORDS).join(" "),
    outline: headingOutline || "(no headings)",
    stats: `${words.length} words · ${links} links · ${images} images in the markdown`,
  };
}

const cap = (markdown: string) =>
  markdown.split(/\s+/).filter(Boolean).slice(0, MAX_DESCRIBE_WORDS).join(" ");

/** classify — shared by a probe and the production build, so what is measured ships. */
export async function classifyPage(
  model: LanguageModel,
  input: Omit<UnderstandInput, "author" | "published">,
): Promise<ClassifyResult> {
  const sample = sampleOf(input.markdown);
  const { output } = await generateText({
    model,
    abortSignal: AbortSignal.timeout(120_000),
    output: Output.object({ schema: classificationSchema }),
    prompt: classifyPrompt({
      url: input.url,
      title: input.title,
      description: input.description,
      site: input.site,
      sample: `${sample.outline}\n\nOpening:\n${sample.opening}`,
      stats: sample.stats,
    }),
  });
  if (!output) throw new Error("classify produced no structured output");
  return output;
}

/** describe — summary + topics in one call, on the largest view of the page. */
export async function describePage(
  model: LanguageModel,
  input: Omit<UnderstandInput, "site"> & { category: Category },
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
      category: input.category,
      instruction: DESCRIBE_PROMPTS[input.category],
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

export async function understandPage(
  input: UnderstandInput,
  /** A category chosen by hand — skips the classifier entirely. */
  chosenCategory?: Category,
): Promise<UnderstandResult> {
  let category: Category;
  if (chosenCategory) {
    category = chosenCategory;
  } else {
    const { category: rawCategory, confidence } = await classifyPage(pipelineModel(), input);
    category = confidence === "low" ? "other" : rawCategory;
  }

  const { summary, topics } = await describePage(pipelineModel(), { ...input, category });
  return { category, topics, summary };
}
