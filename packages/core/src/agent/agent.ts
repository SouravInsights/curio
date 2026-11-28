import {
  convertToModelMessages,
  generateText,
  stepCountIs,
  streamText,
  flushTraces,
  type UIMessage,
} from "@curio/core/observability";
import { chatModel } from "@curio/core/kb/model";
import { curioTools, MAX_STEPS } from "./tools";
import { SYSTEM_PROMPT, withProfile } from "./prompt";
import { getProfile } from "@curio/core/services/profile";
import type { Scope } from "@curio/core/services/scope";

/**
 * The agent loop. `streamText` runs it: it calls a tool, feeds the result back,
 * and repeats until the model stops calling tools or the cap hits.
 *
 * The tool output is the citation list. The UI renders citations from that
 * output — never by scanning the model's prose for links — so the model cannot
 * surface a document or span that retrieval did not return.
 */

export interface AgentHooks {
  onFinish?: (totalTokens: number) => void;
}

/**
 * One question, one answer, no streaming — the CLI and tests. Same model, same
 * tools, same prompt as the app, so what a script sees is what a reader sees.
 */
export async function askOnce(query: string, scope: Scope): Promise<string> {
  const { text } = await generateText({
    model: chatModel(),
    instructions: withProfile(SYSTEM_PROMPT, await getProfile(scope)),
    prompt: query,
    tools: curioTools(scope),
    stopWhen: stepCountIs(MAX_STEPS),
  });
  return text;
}

export async function runAgent(messages: UIMessage[], scope: Scope, hooks: AgentHooks = {}) {
  return streamText({
    model: chatModel(),
    // The AI SDK's tracing drops a prompt passed as `system`. As `instructions`
    // it appears in the trace.
    instructions: withProfile(SYSTEM_PROMPT, await getProfile(scope)),
    messages: await convertToModelMessages(messages),
    tools: curioTools(scope),
    stopWhen: stepCountIs(MAX_STEPS),
    onFinish: async (event) => {
      const usage = event as {
        totalUsage?: { totalTokens?: number };
        usage?: { totalTokens?: number };
      };
      hooks.onFinish?.(usage.totalUsage?.totalTokens ?? usage.usage?.totalTokens ?? 0);
      await flushTraces();
    },
  });
}
