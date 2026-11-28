"use client";

import { ArrowRight, Copy } from "@phosphor-icons/react";
import { Curio } from "@curio/ui/components/curio/mascot";
import { Markdown } from "../Markdown";
import type { AgentSource } from "@/lib/api";

export interface CurioTurn {
  role: "user" | "assistant";
  text: string;
  sources?: AgentSource[];
}

/**
 * Sources grouped by document. A citation is a span in something the reader
 * owns — an article, a book, a note — so the unit is the document and the way
 * back in is the reader, not the open web.
 */
function groupSources(sources: AgentSource[]) {
  const groups = new Map<number, { documentId: number; title: string; spans: AgentSource[] }>();
  for (const source of sources) {
    let group = groups.get(source.documentId);
    if (!group) {
      group = { documentId: source.documentId, title: source.title, spans: [] };
      groups.set(source.documentId, group);
    }
    group.spans.push(source);
  }
  return [...groups.values()];
}

/**
 * The transcript. Citations are read from tool output, never from the model's
 * prose, so a document or line retrieval did not return has nowhere to appear.
 */
export function CurioTranscript({
  turns,
  streaming,
  liveSources,
  phase,
  error,
  busy,
  onRetry,
  onOpenSource,
}: {
  turns: CurioTurn[];
  /** The answer being streamed right now, not yet a turn. */
  streaming: string;
  liveSources: AgentSource[];
  phase: string | null;
  error: string;
  busy: boolean;
  onRetry?: () => void;
  onOpenSource: (source: AgentSource) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {turns.map((turn, index) =>
        turn.role === "user" ? (
          <p
            key={index}
            className="ml-auto max-w-[85%] rounded-[var(--radius-card)] bg-foreground/[0.05] px-3.5 py-2 type-body text-foreground"
          >
            {turn.text}
          </p>
        ) : (
          <AssistantTurn
            key={index}
            text={turn.text}
            sources={turn.sources ?? []}
            onOpenSource={onOpenSource}
          />
        ),
      )}

      {streaming ? (
        <AssistantTurn text={streaming} sources={liveSources} onOpenSource={onOpenSource} live />
      ) : null}

      {busy && !streaming ? (
        <div className="flex items-center gap-2 text-faint-foreground">
          <Curio size={20} busy />
          <span className="type-caption">{phase ?? "Thinking…"}</span>
        </div>
      ) : null}

      {error ? (
        <p className="flex flex-wrap items-center gap-2 type-caption text-destructive">
          {error}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-[var(--radius-control)] border border-destructive/40 px-2 py-0.5 font-medium transition-colors hover:bg-destructive/10"
            >
              Try again
            </button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function AssistantTurn({
  text,
  sources,
  onOpenSource,
  live = false,
}: {
  text: string;
  sources: AgentSource[];
  onOpenSource: (source: AgentSource) => void;
  live?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {text ? (
        <div className="answer-prose prose prose-neutral max-w-none dark:prose-invert">
          <Markdown anchors={false}>{text}</Markdown>
        </div>
      ) : null}

      {text && sources.length ? (
        <div>
          <h3 className="type-label mb-2.5">Sources</h3>
          <ul className="flex flex-col gap-3">
            {groupSources(sources).map((group) => (
              <li key={group.documentId} className="flex flex-col gap-1.5">
                <span className="type-caption truncate text-foreground">
                  {group.title || `Document ${group.documentId}`}
                </span>
                <div className="flex flex-col gap-1.5">
                  {group.spans.map((span) => (
                    <button
                      key={`${span.documentId}:${span.startLine}:${span.endLine}`}
                      type="button"
                      onClick={() => onOpenSource(span)}
                      className="group flex items-start gap-3 rounded-[var(--radius-card)] border border-border px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.03]"
                    >
                      <span className="mt-0.5 flex-none text-[11px] tabular-nums text-faint-foreground">
                        {span.startLine > 0 ? `${span.startLine}–${span.endLine}` : "—"}
                      </span>
                      <span className="min-w-0 flex-1">
                        {span.snippet ? (
                          <span className="type-caption line-clamp-2 text-muted-foreground transition-colors group-hover:text-foreground">
                            {span.snippet}
                          </span>
                        ) : (
                          <span className="type-caption text-muted-foreground">
                            Open this passage
                          </span>
                        )}
                      </span>
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 flex-none text-faint-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {text && !live ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(text).catch(() => undefined)}
            className="flex items-center gap-1.5 rounded-[var(--radius-control)] px-2 py-1 type-caption text-faint-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The whole conversation as markdown, for pasting into a note. */
export function transcriptAsMarkdown(turns: CurioTurn[]): string {
  return turns
    .map((turn) => {
      const heading = turn.role === "user" ? "**You**" : "**Curio**";
      const sources = turn.sources?.length
        ? `\n\nSources:\n${turn.sources
            .map((s) => `- ${s.title || `Document ${s.documentId}`} (lines ${s.startLine}–${s.endLine})`)
            .join("\n")}`
        : "";
      return `${heading}\n\n${turn.text}${sources}`;
    })
    .join("\n\n---\n\n");
}
